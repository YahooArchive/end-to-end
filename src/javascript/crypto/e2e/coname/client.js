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
 * @fileoverview coname client.
 */

goog.provide('e2e.coname.Client');

goog.require('e2e');
goog.require('e2e.async.Result');
goog.require('e2e.coname');
goog.require('e2e.coname.ProtoBuf');
goog.require('e2e.coname.sha3');
goog.require('e2e.coname.verifyLookup');
goog.require('e2e.random');
goog.require('goog.array');
goog.require('goog.crypt.base64');
goog.require('goog.net.ErrorCode');
goog.require('goog.net.XhrIo');



/**
 * Constructor for the coname client.
 * @param {!function(): !e2e.async.Result} authCallback Callback to
 *     authenticate the AJAX calls
 * @param {string=} opt_keyName The key name of the keyData Map
 * @constructor
 */
e2e.coname.Client = function(authCallback, opt_keyName) {
  /**
   * @type {?Object<string,*>}
   */
  this.proto = null;

  /**
   * The key name being referenced in the key data blob
   * @type {string}
   * @private
   */
  this.keyName_ = opt_keyName || '25519';

  /**
   * The Callback for authentication
   * @type {!function(): !e2e.async.Result}
   */
  this.authCallback_ = authCallback;
};


/** @const {string} */
e2e.coname.Client.PROTO_FILE_PATH = 'coname-client.proto.json';


/**
 * Initializes the external protobuf dependency.
 * @return {!e2e.async.Result.<?Object<string,*>>} The deferred Coname protocol
 */
e2e.coname.Client.prototype.initialize = function() {

  if (this.proto) {
    return e2e.async.Result.toResult(/** @type {?Object<string,*>} */
        (this.proto));
  }

  var result = new e2e.async.Result;

  new e2e.coname.ProtoBuf().initialize().addCallbacks(function(ProtoBuf) {

    ProtoBuf.loadJsonFile(
        chrome.runtime.getURL(e2e.coname.Client.PROTO_FILE_PATH),
        goog.bind(function(err, builder) {
          if (err) {
            result.errback(err);
            return;
          }
          this.proto = builder.build('proto');
          result.callback(this.proto);
        }, this));
  }, goog.bind(result.errback, result), this);

  return result;
};


/**
 * @private
 * Parse, decode, and transform a lookup response
 * @param {Object<string,*>} proto The initialized protobuf object
 * @param {string} jsonString The lookup message to decode
 * @return {e2e.coname.ServerResponse} The lookup response
 */
e2e.coname.decodeLookupMessage_ = function(proto, jsonString) {
  var lookupProof = JSON.parse(jsonString);
  var b64decode = goog.crypt.base64.decodeStringToByteArray;
  var profile, entry, tree = lookupProof.tree_proof;

  // a lot of convertions before they can be verified
  // TODO: except the use of encodeAB(), may be better to move them to server
  lookupProof.index = b64decode(lookupProof.index);
  lookupProof.index_proof = b64decode(lookupProof.index_proof);

  tree.neighbors = tree.neighbors ?
      goog.array.map(tree.neighbors, function(n) {return b64decode(n)}) :
      [];
  if (tree.existing_index) {
    tree.existing_index = b64decode(tree.existing_index);
  }
  if (tree.existing_entry_hash) {
    tree.existing_entry_hash = b64decode(tree.existing_entry_hash);
  }

  goog.array.forEach(lookupProof.ratifications, function(r) {
    var id, encoding = b64decode(r.head), rHH;

    r.head = proto['TimestampedEpochHead'].decode(encoding);
    rHH = r.head.head;
    rHH.encoding = new Uint8Array(rHH.encodeAB());
    rHH.previous_summary_hash = new Uint8Array(
        rHH.previous_summary_hash.toBuffer());
    rHH.root_hash = new Uint8Array(rHH.root_hash.toBuffer());
    // drop nanos; seconds can be well represented by Number (max 2^53-1)
    rHH.issue_time = rHH.issue_time.seconds.toNumber();
    r.head.encoding = encoding;

    for (id in r.signatures) {
      r.signatures[id] = b64decode(r.signatures[id]);
    }
  });

  if (lookupProof.entry) {
    entry = b64decode(lookupProof.entry);
    lookupProof.entry = proto['Entry'].decode(entry);
    lookupProof.entry.profile_commitment = new Uint8Array(
        lookupProof.entry.profile_commitment.toBuffer());
    lookupProof.entry.encoding = entry;
  }

  if (lookupProof.profile) {
    profile = b64decode(lookupProof.profile);
    lookupProof.profile = proto['Profile'].decode(profile);
    lookupProof.profile.encoding = profile;
  }

  return /** @type {e2e.coname.ServerResponse} */ (lookupProof);
};


/**
 * @private
 * Encode the update request message
 * @param {Object<string,*>} proto The initialized protobuf object
 * @param {string} email The email address
 * @param {?e2e.ByteArray} key OpenPGP key to send
 * @param {e2e.coname.RealmConfig} realm The RealmConfig
 * @param {e2e.coname.ServerResponse} oldProof The lookup proof just obtained
 * @param {string} keyName The key name being referenced in the key data blob
 * @return {Object<string,*>} The update message
 */
e2e.coname.encodeUpdateRequest_ = function(
    proto, email, key, realm, oldProof, keyName) {

  var keys = {}, hProfile, profile, entry;

  // if a current profile exists
  if (oldProof.profile) {
    // clone the old key set
    keys = proto['Profile'].decode(oldProof.profile.encoding).keys;
    // update only the pgp key
    key === null ?
        keys.delete(keyName) :
        keys.set(keyName, goog.crypt.base64.encodeByteArray(key));
  } else if (key !== null) {
    keys[keyName] = new Uint8Array(key);
  }

  profile = proto['Profile'].encode({
    nonce: new Uint8Array(e2e.random.getRandomBytes(16)),
    keys: keys
  });

  hProfile = new Uint8Array(
      e2e.coname.sha3.shake256(64).update(
      new Uint8Array(profile.toBuffer())).digest());

  // if a current entry exists
  if (oldProof.entry) {
    entry = proto.Entry.decode(oldProof.entry.encoding); // clone
    entry.version = entry.version.add(1);
    entry.profile_commitment = hProfile;
  } else {
    entry = proto.Entry.encode({
      index: new Uint8Array(oldProof.index),
      version: 0, // version starts at 0 at registration
      // TODO: support other update_policy
      update_policy: {quorum: {}},
      profile_commitment: hProfile
    });
  }

  return {
    update: {
      new_entry: entry.toBase64(),
      signatures: {}
    },
    profile: profile.toBase64(),
    lookup_parameters: {
      user_id: email,
      quorum_requirement: realm.verification_policy.quorum
    }
    // TODO: disable DKIM for now
    // dkim_proof: null
  };

};


/**
 * Send the data over AJAX
 * @param {string} method The HTTP method to use, such as "GET", "POST", "PUT",
 *                        "DELETE", etc. Ignored for non-HTTP(S) URLs
 * @param {string} url The URL to send the request to
 * @param {number} timeout The number of milliseconds a request can take before
 *                         automatically being terminated. A value of 0 (which
 *                         is the default) means there is no timeout.
 * @param {Object} data The data to be JSON stringified and sent as the HTTP
 *                      request body
 * @return {e2e.async.Result.<string>} The raw response text iff the server
 *                                          responds 200 OK
 * @private
 */
e2e.coname.Client.prototype.getAJAX_ = function(
    method, url, timeout, data) {
  var dataString = '';
  try {
    dataString = JSON.stringify(data);
  } catch (e) {
    return e2e.async.Result.toError(e);
  }

  var result = new e2e.async.Result;
  goog.net.XhrIo.send(url, goog.bind(function(e) {
    var xhr = e.target;
    if (xhr.getLastErrorCode() === goog.net.ErrorCode.NO_ERROR) {
      result.callback(xhr.getResponseText());
    } else if (xhr.getStatus() === 401) {
      // invoke the authCallback, and make the AJAX call again
      this.authCallback_().
          addCallbacks(function() {
            this.getAJAX_(method, url, timeout, data).addCallbacks(
                result.callback, result.errback, result);
          }, function() {
            result.errback(new Error(
                'Error connecting to keyserver: ' + xhr.getLastError()));
          }, this);
    } else {
      result.errback(new Error(
          'Error connecting to keyserver: ' + xhr.getLastError()));
    }
  }, this), method, dataString, {}, timeout);
  return result;
};


/**
 * Lookup and validate public keys for an email address
 * @param {string} email The email address to look up a public key
 * @param {boolean=} opt_skipVerify whether skip the verify step
 * @return {!e2e.async.Result.<null>|!e2e.async.Result.<!e2e.coname.KeyData>}
 *    The result if there has a key associated with the email, and it is
 *    validated. The result is null when no realms. The key in KeyData is null
 *    if verified for having no key.
 */
e2e.coname.Client.prototype.lookup = function(email, opt_skipVerify) {
  // normalize the email address
  email = email.toLowerCase();

  var result = new e2e.async.Result;
  var realm, realm_ = e2e.coname.getRealmByEmail(email);

  // no realm, no keys
  if (realm_ === null) {
    return e2e.async.Result.toResult(null);
  }
  realm = /** @type {e2e.coname.RealmConfig} */(realm_);

  var data = {
    user_id: email,
    quorum_requirement: realm.verification_policy.quorum
  };

  // TODO: make this possible for polling/retries
  this.getAJAX_('POST', realm.addr + '/lookup', 30000, data).
      addCallbacks(function(responseText) {
        var pf = e2e.coname.decodeLookupMessage_(this.proto, responseText),
            profile = pf['profile'],
            keyByteArray;

        try {
          !opt_skipVerify && e2e.coname.verifyLookup(realm, email, pf);
        } catch (e) {
          result.errback(e);
          return;
        }

        keyByteArray = profile && profile.keys &&
            profile.keys.has(this.keyName_) ?
            /** @type {e2e.ByteArray} */ (
            Array.prototype.slice.call(new Uint8Array(profile.keys.get(
            this.keyName_).toBuffer()))) :
            null;

        result.callback({keyData: keyByteArray, proof: pf});

      }, goog.bind(result.errback, result), this);

  return result;
};


/**
 * Update or add public keys for an email address
 * @param {!string} email The email address
 * @param {?e2e.ByteArray} keyData The key blob to upload. Use null to remove
 *     the specific key field.
 * @return {!e2e.async.Result.<null>|!e2e.async.Result.<!e2e.coname.KeyData>}
 *    The result if there has a key associated with the email, and it is
 *    validated. The result is null when no realms. The key in KeyData is null
 *    if verified for having no key.
 */
e2e.coname.Client.prototype.update = function(email, keyData) {
  // normalize the email address
  email = email.toLowerCase();
  var realm, realm_ = e2e.coname.getRealmByEmail(email);
  var oldKey, newProfileBase64;

  // no realm, no keys
  if (realm_ === null) {
    return e2e.async.Result.toResult(null);
  }
  realm = /** @type {e2e.coname.RealmConfig} */(realm_);

  // TODO: save persistently the key in case update fails in the mid way
  return this.lookup(email, true).
      addCallback(function(oldResult) {
        oldKey = oldResult.key;

        var data = e2e.coname.encodeUpdateRequest_(
           this.proto, email, keyData, realm, oldResult.proof, this.keyName_);

        newProfileBase64 = data.profile;

        // set 1m timeout
        return this.getAJAX_('POST', realm.addr + '/update', 60000, data);

      }, this).
      addCallback(function(responseText) {
        var pf = e2e.coname.decodeLookupMessage_(this.proto, responseText),
           profile = pf.profile,
           keyByteArray;

        if (newProfileBase64 !== profile.toBase64()) {
          throw new Error('server rejected the new profile/key');
        }
        if (!e2e.coname.verifyLookup(realm, email, pf)) {
          // TODO: poll the server until the update can be verified
          throw new Error('the keys cannot be validated');
        }

        keyByteArray = profile && profile.keys &&
            profile.keys.has(this.keyName_) ?
            /** @type {e2e.ByteArray} */ (
            Array.prototype.slice.call(new Uint8Array(profile.keys.get(
                this.keyName_).toBuffer()))) :
            null;

        return {keyData: keyByteArray, proof: pf};

      }, this);
};
