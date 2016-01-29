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
goog.require('e2e.coname.Client');
goog.require('e2e.ext.utils.text');
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
 * Initializes the external protobuf dependency.
 * @return {!e2e.async.Result.<?Object<string,*>>} The deferred Coname protocol
 */
ConameKeyProvider.prototype.initialize = function() {
  return this.client_.initialize();
};


/**
 * Imports public key to the key server.
 * @param {!Array.<e2e.openpgp.block.TransferablePublicKey>} keys The keys to
 *     import.
 * @return {!goog.async.Deferred.<boolean>} True if at least one of the keys
 *     are successfully uploaded according to the specified uids.
 */
ConameKeyProvider.prototype.importKeys = function(keys) {
  var emailKeyMap = {};

  goog.array.forEach(keys, function(key) {
    try {
      // validate the keys
      key.processSignatures();

      // validate a proper email is present in the uids
      goog.array.forEach(key.getUserIds(), function(uid) {
        // TODO: use extractValidEmail() instead for non-yahoo email address?
        var yEmail = e2e.ext.utils.text.extractValidYahooEmail(uid);
        if (yEmail !== null) {
          if (!emailKeyMap[yEmail]) {
            emailKeyMap[yEmail] = new goog.structs.Map();
          }
          // De-duplicate keys
          emailKeyMap[yEmail].set(key.keyPacket.fingerprint, key.serialize());
        }
      });
    } catch (any) {
      // Discard invalid keys, and those not having a uid with yahoo address
    }
  });

  // it's considered success if nothing needs to be uploaded
  if (goog.object.isEmpty(emailKeyMap)) {
    return e2e.async.Result.toResult(true);
  }

  var importedKeysResults = goog.async.DeferredList.gatherResults(
      goog.array.map(goog.object.getKeys(emailKeyMap), function(email) {
        var keyData = goog.array.flatten(emailKeyMap[email].getValues());
        return this.client_.update(email, keyData);
      }, this));

  return importedKeysResults.addCallback(function(importedKeys) {
    // Return true if it was imported for some emails.
    // Not necessarily all as user may not have authenticated with all emails
    return goog.array.some(importedKeys, function(keys) {
      return keys !== null;
    });
  });
};


/**
 * Searches public keys based on an email.
 * @param {string} email The email which is used to search for the
 *    corresponding public keys.
 * @return {!e2e.async.Result.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *    The public keys correspond to the email or [] if not found.
 */
ConameKeyProvider.prototype.getTrustedPublicKeysByEmail = function(email) {
  // TODO: relax key lookup for non-yahoo email address?
  if (e2e.ext.utils.text.extractValidYahooEmail(email) === null) {
    return e2e.async.Result.toResult([]);
  }

  var result = new e2e.async.Result;
  this.client_.lookup(email).addCallbacks(function(lookupResult) {

    // no key found for that email
    if (lookupResult === null || lookupResult.keyData === null) {
      result.callback([]);
      return;
    }

    var parsedKeys = e2e.openpgp.block.factory.
        parseByteArrayAllTransferableKeys(lookupResult.keyData);
    result.callback(goog.array.filter(parsedKeys, function(key) {
      try {
        // validate the keys
        key.processSignatures();

        // maintain a history mapping of keyId to email
        this.keyIdEmailMap_.set(key.keyPacket.keyId, email);
        key.subKeys && goog.array.forEach(key.subKeys, function(subKey) {
          this.keyIdEmailMap_.set(subKey.keyId, email);
        }, this);

        return true;
      } catch (any) {}
      // Discard those keys without proper signatures
      return false;
    }));

  }, function(e) {
    // TODO: let user override?
    // any errors will be considered as having no key
    result.callback([]);
  }, this);

  return result;
};


/**
 * Returns public keys that have a key packet with a given OpenPGP key ID.
 * Used for signature verification purposes only.
 * TODO: CONAME needs support to lookup using keyid
 *
 * @see https://tools.ietf.org/html/rfc4880#section-5.1
 * @param {!e2e.openpgp.KeyId} id The key ID.
 * @return {!e2e.async.Result.<!Array.<!e2e.openpgp.block.TransferableKey>>}
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
