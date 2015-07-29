/**
 * @license
 * Copyright 2015 Yahoo Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview V2 keyserver lookups.
 */

goog.provide('e2e.ext.keyserver.v2');
goog.provide('e2e.ext.keyserver.v2.Client');

goog.require('e2e.ecc.Ed25519');
goog.require('e2e.ecc.PrimeCurve');
goog.require('e2e.ext.keyserver.v2.messages');
goog.require('e2e.random');
goog.require('goog.array');
goog.require('goog.crypt');
goog.require('goog.object');
goog.require('goog.proto2');


goog.scope(function() {
var ext = e2e.ext;
var keyserver = ext.keyserver.v2;
var messages = ext.keyserver.v2.messages;


/**
 * @private {number}
 * @const
 */
keyserver.PAD_TO_ = 4 << 10;


/**
 * @typedef {{name: string, pk: !e2e.ByteArray}}
 * @private
 */
keyserver.verifier_;


/**
 * @type {number}
 * @const
 */
keyserver.MAX_VALIDITY_PERIOD = 60 * 60 * 24 * 365;  // seconds

/**
 * Constructor for the lookup client.
 * @param {number} freshnessThreshold The client's allowed freshness threshold
 *     in nanoseconds.
 * @param {number} freshnessSignaturesRequired The number of signatures needed
 *     to satisfy the freshness requirement.
 * @param {number} consensusSignaturesRequired The number of signatures needed
 *     to satisfy the consensus requirement.
 * @constructor
 */
keyserver.Client = function(freshnessThreshold,
                            freshnessSignaturesRequired,
                            consensusSignaturesRequired) {
  /**
   * Freshness threshold in nanoseconds.
   * @private {number}
   */
  this.freshnessThreshold_ = freshnessThreshold;

  /**
   * @private {number}
   */
  this.freshnessSignaturesRequired_ = freshnessSignaturesRequired;

  /**
   * @private {number}
   */
  this.consensusSignaturesRequired_ = consensusSignaturesRequired;

  /**
   * @private {goog.proto2.Serializer}
   */
  this.serializer_ = new goog.proto2.Serializer();
};


/**
 * Looks up a profile from a keyserver reply.
 * @param {string} name The name that was looked up.
 * @param {messages.ClientReply} reply The keyserver's reply.
 * @return {messages.Profile}
 */
keyserver.Client.prototype.lookupFromReply = function(name, reply) {
  var root;

  // Check for consensus
  try {
    root = this.verifyConsensus(reply.get('StatedConfirmations'));
  } catch(ex) {
    return null;
  }

  if (!root) {
    return null;
  }

  // Check that the entry is in the tree and correctly mapped
  var profile = this.verifyResolveAgainstRoot(root, name,
                                              reply.get('LookupNodes'));
  if (profile === null) {
    return null;
  }

  // Check that the profile is not expired
  var expiration = profile.get('ExpirationTime');  // nanoseconds
  if (expiration <
      ((new Date()).getTime() +
       keyserver.MAX_VALIDITY_PERIOD * 1000 / 2) * 1000) {
    throw new Error('This profile is out of date.');
  }

  return profile;
};


/**
 * Checks whether a set of statements made by the servers is sufficient for the
 * state contained by them to be canonical.
 * @param {Array.<messages.SignedServerMessage>} signedMsgs The signed messages
 *     from the server.
 * @return {e2e.ByteArray}
 */
keyserver.Client.prototype.verifyConsensus = function(signedMsgs) {
  var rootHash = null;
  var consensusServers = {};
  var freshnessServers = {};

  goog.array.forEach(signedMsgs, goog.bind(function(signedMsg) {
    var message = signedMsg.get('Message');
    var signature = signedMsg.get('Signature');

    if (!message || !signature) {
      return;
    }

    var deserialized = this.serializer_.deserialize(signedMsg.getDescriptor(),
                                                    message);
    var pubKey = this.getPubKey_(deserialized);
    var messageToVerify =
        goog.crypt.stringToByteArray('msg\x00').concat(message);

    if (!pubKey ||
        !this.verifySignature_(pubKey, messageToVerify, signature)) {
      return;
    }

    if (rootHash === null) {
      rootHash = deserialized.get('HashOfState');
    } else if (!goog.array.equals(rootHash, deserialized.get('HashOfState'))) {
      // TODO: Define a new error type for this.
      throw new Error('verifyConsensus: state hashes differ.');
    }

    // TODO: This might not be consistent with the definition of
    // 'serialized'...
    consensusServers[deserialized.get('Server')] = true;

    var now = (new Date().getTime()) * 1000;

    if (deserialized.get('Time') < (now + this.freshnessThreshold)) {
      freshnessServers[deserialized.get('Server')] = true;
    }
  }));

  if (goog.object.getCount(consensusServers) <
      this.consensusSignaturesRequired_) {
    throw new Error('verifyConsensus: not enough consensus signatures.');
  }
  if (goog.object.getCount(freshnessServers) <
      this.freshnessSignaturesRequired_) {
    throw new Error('verifyConsensus: not enough freshness signatures.');
  }
  return rootHash;
};


/**
 * Gets a public key from a deserialzed server signed message.
 * @param {Object} deserialized
 * @return {!e2e.ByteArray}
 */
keyserver.Client.prototype.getPubKey_ = function(deserialized) {
  // TODO: Fill this out.
};


/**
 * Verify a Ed25519 signature.
 * @param {!e2e.ByteArray} pubKey The public key.
 * @param {!e2e.ByteArray} msg The message.
 * @param {!e2e.ByteArray} sig The signature.
 * @return {boolean}
 */
keyserver.Client.prototype.verifySignature_ = function(pubKey, msg, sig) {
  var protocol = new e2e.ecc.Ed25519(e2e.ecc.PrimeCurve.ED_25519,
                                     {pubKey: pubKey, privKey: []});
  return protocol.verify(msg, sig);
};


/**
 * Verifies proof that a name is in a Merkle tree with the given root hash.
 * Returns the profile mapped to the name.
 * @param {!e2e.ByteArray} rootHash The root hash of the tree.
 * @param {string} name The name to prove for.
 * @param {Array.<Object>} proof The proof.
 * @return {Object}
 */
keyserver.Client.prototype.verifyResolveAgainstRoot = function(rootHash,
                                                               name,
                                                               proof) {
  // TODO: Fill this out.
};

});  // goog.scope
