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


/**
 * @fileoverview This almost implmented the interface as defined in
 *     {@link e2e.openpgp.providers.PublicKeyProvider}, but is slightly
 *     modified to (e.g., return transferablekeys instead) to fit the needs of
 *     yContextImpl.
 */

goog.provide('e2e.coname.KeyProvider');

goog.require('e2e.async.Result');
goog.require('e2e.coname');
goog.require('e2e.coname.Client');
goog.require('e2e.openpgp.block.factory');
goog.require('goog.array');
goog.require('goog.async.DeferredList');
goog.require('goog.functions');
goog.require('goog.object');
goog.require('goog.structs');
goog.require('goog.structs.Map');


goog.scope(function() {



/**
 * Constructor for the coname key provider.
 * @constructor
 */
e2e.coname.KeyProvider = function() {
  this.client_ = new e2e.coname.Client();
};

var ConameKeyProvider = e2e.coname.KeyProvider;


/**
 * Imports public key to the key server.
 * @param {!Array.<e2e.openpgp.block.TransferablePublicKey>} keys The keys to
 *     import.
 * @param {string=} opt_uid The default user id
 * @return {!goog.async.Deferred.<boolean>} True if empty key or at least one
 *     of the keys are successfully updated according to the specified uids.
 */
ConameKeyProvider.prototype.importKeys = function(keys, opt_uid) {
  return e2e.coname.Client.initialize().
      addCallback(function() {
        var emailKeyMap = {};
        return goog.async.DeferredList.gatherResults(
            goog.array.map(keys, function(key) {
              return key.processSignatures().
                  addCallbacks(function() {
                    // validate a proper email is present in the uids
                    goog.array.forEach(key.getUserIds(), function(uid) {
                      var email = e2e.coname.getSupportedEmailByUid(uid);
                      if (email !== null) {
                        if (!emailKeyMap[email]) {
                          emailKeyMap[email] = new goog.structs.Map();
                        }
                        // De-duplicate keys
                        emailKeyMap[email].set(
                            key.keyPacket.fingerprint, key.serialize());
                      }
                    });
                  }, function(err) {
                    // Discard invalid keys.
                    return null;
                  });
            })).addCallback(goog.functions.constant(emailKeyMap));
      }).
      addCallback(function(emailKeyMap) {
        var email;
        if (goog.structs.isEmpty(emailKeyMap)) {
          if (opt_uid &&
              (email = e2e.coname.getSupportedEmailByUid(opt_uid))) {
            // update to set empty keys for the opt_uid user
            return this.client_.update(email, null).
                    addCallback(function(result) { return [result]; });
          }
          return [true]; // meaning no keys will be uploaded
        }

        return goog.async.DeferredList.gatherResults(
            goog.array.map(goog.object.getKeys(emailKeyMap), function(email) {
              var keyData = goog.array.flatten(emailKeyMap[email].getValues());
              return this.client_.update(email, keyData);
            }, this));
      }, this).
      addCallback(function(importedKeys) {
        // Return true if it was imported for some emails.
        // Not necessarily all as user may not have authenticated all accts
        return goog.array.some(importedKeys, function(keys) {
          return keys !== null;
        });
      }, this);
};


/**
 * Searches public keys based on an email.
 * @param {!string} email The email to search for the remote public keys.
 * @return {!goog.async.Deferred.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *    The public keys correspond to the email or [] if not found.
 */
ConameKeyProvider.prototype.getTrustedPublicKeysByEmail = function(email) {
  if (e2e.coname.getSupportedEmailByUid(email) === null) {
    return e2e.async.Result.toResult([]);
  }

  return e2e.coname.Client.initialize().
      addCallback(function() {
        return this.client_.lookup(email);
      }, this).
      addCallback(function(lookupResult) {
        // no key found for that email
        if (lookupResult === null || lookupResult.keyData === null) {
          return [];
        }

        var keySerialization = lookupResult.keyData;

        /** @type
            {!Array<!e2e.async.Result<?e2e.openpgp.block.TransferableKey>>} */
        var pendingValidations = goog.array.map(
            e2e.openpgp.block.factory.parseByteArrayAllTransferableKeys(
                keySerialization, true), function(key) {
                  return key.processSignatures().addCallback(function() {
                    return key;
                  }).addErrback(function(err) {
                    // Discard invalid keys.
                    return null;
                  });
                });

        return goog.async.DeferredList.gatherResults(pendingValidations);
      }, this).
      addCallback(function(keys) {
        return goog.array.filter(keys, function(key) {
          return key !== null;
        });
      });
};


/**
 * Returns public keys that have a key packet with a given OpenPGP key ID.
 * Used for signature verification purposes only.
 * TODO: CONAME needs support to lookup using keyid
 *
 * @see https://tools.ietf.org/html/rfc4880#section-5.1
 * @param {!e2e.openpgp.KeyId} keyId The key ID.
 * @return {!goog.async.Deferred.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *     The resulting trusted keys that are once looked up using
 *     {#getTrustedPublicKeysByEmail}.
 */
ConameKeyProvider.prototype.getVerificationKeysByKeyId = function(keyId) {
  throw new Error('CONAME keyserver does not support ' +
      'getVerificationKeysByKeyId yet');
};

});  // goog.scope
