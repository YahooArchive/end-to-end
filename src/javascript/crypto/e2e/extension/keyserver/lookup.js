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

goog.provide('e2e.ext.keyserverV2');
goog.provide('e2e.ext.keyserverV2.Client');

goog.require('e2e.ecc.Ed25519');
goog.require('e2e.ecc.PrimeCurve');
goog.require('goog.array');
goog.require('goog.crypt');
goog.require('goog.net.jsloader');
goog.require('goog.object');
goog.require('goog.proto2.Serializer');
goog.require('proto2.ClientReply');
goog.require('proto2.Profile');
goog.require('proto2.Profile.PublicKey');
goog.require('proto2.SignedServerMessage');
goog.require('proto2.SignedServerMessage.ServerMessage');


goog.scope(function() {
var ext = e2e.ext;
var keyserver = e2e.ext.keyserverV2;


/**
 * @private {number}
 * @const
 */
keyserver.PAD_TO_ = 4 << 10;


/**
 * Map of server identifiers to public keys. TODO: Hard-code this.
 * @typedef {Object.<string, proto2.Profile.PublicKey>}
 * @private
 */
keyserver.verifier_;


/**
 * Maximum validity period for user profiles, in seconds.
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

  /**
   * @private {boolean}
   */
  this.initialized_ = false;
};


/**
 * Initializes the external protobuf dependency.
 * @param {function()} callback The function to call when protobuf is loaded.
 * @param {function()} errback The error callback.
 */
keyserver.Client.prototype.initialize = function(callback, errback) {
  var pbURL = chrome.runtime.getURL('ProtoBuf.js');
  var bbURL = chrome.runtime.getURL('ByteBufferAB.js');
  if (window.dcodeIO && window.dcodeIO.ByteBuffer && window.dcodeIO.ProtoBuf) {
    this.initialized_ = true;
    callback();
    return;
  }
  // Load the ByteBuffer dependency for ProtoBuf
  // XXX: jsloader has spurious timeout errors, so set it to 0 for no timeout.
  goog.net.jsloader.load(bbURL, {timeout: 0}).addCallback(function() {
    if (window.dcodeIO && window.dcodeIO.ByteBuffer) {
      // Load ProtoBuf
      goog.net.jsloader.load(pbURL, {timeout: 0}).addCallback(function() {
        if (window.dcodeIO && window.dcodeIO.ProtoBuf) {
          // Success
          this.initialized_ = true;
          callback();
        } else {
          return new Error('Missing protobuf!');
        }
      }, this).addErrback(errback, this);
    } else {
      return new Error('Missing bytebuffer!');
    }
  }, this).addErrback(errback, this);
};


/**
 * Looks up a profile given some data from the keyserver.
 * @param {string} name The name that was looked up
 * @param {string} data The raw data returned by the keyserver.
 * @return {proto2.Profile}
 */
keyserver.Client.prototype.lookup = function(name, data) {
  var reply = /** @type {proto2.ClientReply} */ (this.serializer_.deserialize(
      (new proto2.ClientReply()).getDescriptor(), data));
  return this.lookupFromReply_(name, reply);
};


/**
 * Looks up a profile from a keyserver ClientReply.
 * @param {string} name The name that was looked up.
 * @param {proto2.ClientReply} reply The keyserver's reply.
 * @return {proto2.Profile}
 * @private
 */
keyserver.Client.prototype.lookupFromReply_ = function(name, reply) {
  var root;

  // Check for consensus
  try {
    root = this.verifyConsensus_(reply.stateConfirmationsArray());
  } catch (ex) {
    return null;
  }

  if (!root) {
    return null;
  }

  // Check that the entry is in the tree and correctly mapped
  var profile = this.verifyResolveAgainstRoot_(root, name,
                                               reply.lookupNodesArray());
  if (profile === null) {
    return null;
  }

  // Check that the profile is not expired. XXX: Why is MAX_VALIDITY_PERIOD
  // here? Also need to make sure expiration time is a base 10 string.
  if (this.isExpired_(window.parseInt(profile.getExpirationTime(), 10) -
                      keyserver.MAX_VALIDITY_PERIOD / 2 * 10E9)) {
    throw new Error('This profile is out of date.');
  }

  return profile;
};


/**
 * Checks whether a set of statements made by the servers is sufficient for the
 * state contained by them to be canonical. Returns the root hash if so,
 * otherwise null.
 * @param {Array.<proto2.SignedServerMessage>} signedMsgs The signed messages
 *     from the server.
 * @return {?e2e.ByteArray}
 * @private
 */
keyserver.Client.prototype.verifyConsensus_ = function(signedMsgs) {
  var rootHash = null;
  var consensusServers = {};
  var freshnessServers = {};

  goog.array.forEach(signedMsgs, goog.bind(function(signedMsg) {
    var message = /** @type {?string} */ (signedMsg.getMessage());
    var signature = /** @type {?string} */ (signedMsg.getSignature());

    if (!message || !signature) {
      return;
    }

    // Unmarshal the signed part of the message
    var serverMessage = /** @type {proto2.SignedServerMessage.ServerMessage} */
        (this.serializer_.deserialize(
            (new proto2.SignedServerMessage.ServerMessage()).getDescriptor(),
            message));

    // Find the public key that was used to sign the message
    var server = /** @type {?string} */ (serverMessage.getServer());
    if (!server) {
      return;
    }
    var pubKey = this.getPubKey_(server);
    if (!pubKey) {
      return;
    }

    // Verify the signature
    var messageToVerify = goog.crypt.stringToByteArray('msg\x00' + message);
    if (!this.verifySignature_(pubKey, messageToVerify,
                               goog.crypt.stringToByteArray(signature))) {
      return;
    }

    // Find the supposed root hash of the tree
    if (rootHash === null) {
      rootHash = serverMessage.getHashOfState();
      if (rootHash === null) {
        // TODO: Define a new error type for this.
        throw new Error('verifyConsensus: hash is null');
      }
    } else if (rootHash !== serverMessage.getHashOfState()) {
      throw new Error('verifyConsensus: state hashes differ.');
    }

    // Record state hash consensus from the server
    consensusServers[server] = true;

    // Record freshness state from the server
    if (!this.isExpired_(window.parseInt(serverMessage.getTime(), 10) +
                         this.freshnessThreshold_)) {
      freshnessServers[server] = true;
    }
  }, this));

  if (goog.object.getCount(consensusServers) <
      this.consensusSignaturesRequired_) {
    throw new Error('verifyConsensus: not enough consensus signatures.');
  }
  if (goog.object.getCount(freshnessServers) <
      this.freshnessSignaturesRequired_) {
    throw new Error('verifyConsensus: not enough freshness signatures.');
  }

  return rootHash ?
      goog.crypt.stringToByteArray(/** @type {string} */ (rootHash)) : null;
};


/**
 * Checks whether we are past the expiration time.
 * @param {number} expirationTime The time to check, in nanoseconds.
 * @return {boolean}
 * @private
 */
keyserver.Client.prototype.isExpired_ = function(expirationTime) {
  var now = (new Date().getTime()) * 10E6;  // Nanoseconds
  return (expirationTime < now);
};


/**
 * Gets a public key for a given server or null if none is found.
 * @param {string} server
 * @return {?e2e.ByteArray}
 * @private
 */
keyserver.Client.prototype.getPubKey_ = function(server) {
  var profile = /** @type {(proto2.Profile.PublicKey|undefined)} */ (
      keyserver.verifier_[server]);
  if (!profile) {
    return null;
  }
  var key = profile.getEd25519();
  if (!key) {
    return null;
  }
  return goog.crypt.stringToByteArray(key);
};


/**
 * Verify a Ed25519 signature.
 * @param {!e2e.ByteArray} pubKey The public key.
 * @param {!e2e.ByteArray} msg The message.
 * @param {!e2e.ByteArray} sig The signature.
 * @return {boolean}
 * @private
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
 * @param {!Array.<!proto2.ClientReply.MerklemapNode>} proof The proof.
 * @return {proto2.Profile}
 * @private
 */
keyserver.Client.prototype.verifyResolveAgainstRoot_ = function(rootHash,
                                                                name,
                                                                proof) {
  // TODO: Fill this out.
  return null;
};

});  // goog.scope
