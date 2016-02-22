/**
 * @license
 * Copyright 2016 Yahoo Inc. All rights reserved.
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
goog.provide('e2e.coname.KeyProvider');

goog.require('e2e.async.Result');
goog.require('e2e.coname');
goog.require('e2e.coname.Client');
goog.require('e2e.openpgp.block.factory');
goog.require('goog.array');
goog.require('goog.async.DeferredList');
goog.require('goog.object');
goog.require('goog.structs.Map');


goog.scope(function() {



/**
 * Constructor for the coname key provider.
 * @constructor
 */
e2e.coname.KeyProvider = function() {
  this.client_ = new e2e.coname.Client();

  /** @private */
  this.keyIdEmailMap_ = new goog.structs.Map();
};


var ConameKeyProvider = e2e.coname.KeyProvider;


/**
 * Imports public key to the key server.
 * @param {!Array.<e2e.openpgp.block.TransferablePublicKey>} keys The keys to
 *     import.
 * @param {string=} opt_uid The default user id
 * @return {!goog.async.Deferred.<boolean>} True if at least one of the keys
 *     are successfully uploaded according to the specified uids.
 */
ConameKeyProvider.prototype.importKeys = function(keys, opt_uid) {

  var email, emailKeyMap = {};

  goog.array.forEach(keys, function(key) {
    try {
      // validate the keys
      key.processSignatures();

      // validate a proper email is present in the uids
      goog.array.forEach(key.getUserIds(), function(uid) {

        email = e2e.coname.getSupportedEmailByUid(uid);
        if (email !== null) {
          if (!emailKeyMap[email]) {
            emailKeyMap[email] = new goog.structs.Map();
          }
          // De-duplicate keys
          emailKeyMap[email].set(
              key.keyPacket.fingerprint, key.serialize());
        }
      });
    } catch (any) {
      // Discard invalid keys, and those lacking a uid with yahoo address
    }
  });

  return this.client_.initialize().
      addCallback(function() {

        if (goog.object.isEmpty(emailKeyMap)) {
          if (opt_uid && (email = e2e.coname.getSupportedEmailByUid(opt_uid))) {
            // update to set empty keys for the opt_uid user
            return this.client_.update(email, null).
                    addCallback(function(result) { return [result]; });
          }
          return e2e.async.Result.toResult([true]);
        }

        return goog.async.DeferredList.gatherResults(
          goog.array.map(goog.object.getKeys(emailKeyMap), function(email) {
            var keyData = goog.array.flatten(emailKeyMap[email].getValues());
            return this.client_.update(email, keyData);
          }, this));
      }, this).
      addCallbacks(function(importedKeys) {
        // Return true if it was imported for some emails.
        // Not necessarily all as user may not have authenticated all accts
        return goog.array.some(importedKeys, function(keys) {
          return keys !== null;
        });
      }, function(error) {
        // TODO: prompt a relevant error if no rights to update
        return false;
      }, this);
};


/**
 * Searches public keys based on an email.
 * @param {string} email The email which is used to search for the remote
 *    public keys.
 * @return {!goog.async.Deferred.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *    The public keys correspond to the email or [] if not found.
 */
ConameKeyProvider.prototype.getTrustedPublicKeysByEmail = function(email) {
  if (e2e.coname.getSupportedEmailByUid(email) === null) {
    return e2e.async.Result.toResult([]);
  }

  return this.client_.initialize().
      addCallback(function() {
        return this.client_.lookup(email);
      }, this).
      addCallback(function(lookupResult) {
        // no key found for that email
        if (lookupResult === null || lookupResult.keyData === null) {
          return [];
        }

        var parsedKeys = e2e.openpgp.block.factory.
          parseByteArrayAllTransferableKeys(lookupResult.keyData);

        return goog.array.filter(parsedKeys, function(key) {
          try {
            // validate the keys
            key.processSignatures();

            // maintain a history mapping of keyId to email
            this.keyIdEmailMap_.set(key.keyPacket.keyId, email);
            key.subKeys && goog.array.forEach(key.subKeys, function(subKey) {
              this.keyIdEmailMap_.set(subKey.keyId, email);
            }, this);

            return true;
          } catch (any) {
            // Discard those keys without proper signatures
            return false;
          }
        }, this);
      }, this);
};


/**
 * Returns public keys that have a key packet with a given OpenPGP key ID.
 * Used for signature verification purposes only.
 * TODO: CONAME needs support to lookup using keyid
 *
 * @see https://tools.ietf.org/html/rfc4880#section-5.1
 * @param {!e2e.openpgp.KeyId} id The key ID.
 * @return {!goog.async.Deferred.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *     The resulting trusted keys that are once looked up using
 *     {#getTrustedPublicKeysByEmail}.
 */
ConameKeyProvider.prototype.getVerificationKeysByKeyId = function(id) {
  if (!this.keyIdEmailMap_.containsKey(id)) {
    return e2e.async.Result.toResult([]);
  }

  // resolve the email that has the keyid associated, then look up the key
  return this.getTrustedPublicKeysByEmail(this.keyIdEmailMap_.get(id)).
      addCallback(function(pubKeys) {
        return goog.array.filter(pubKeys, function(keyBlock) {
          return keyBlock.hasKeyById(id);
        });
      });
};



});  // goog.scope
