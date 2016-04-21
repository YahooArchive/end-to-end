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
goog.require('e2e.ext.config');
goog.require('e2e.openpgp.block.factory');
goog.require('goog.array');
goog.require('goog.async.Deferred');
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
  this.client_ = new e2e.coname.Client(this.authenticate);

  /**
   * Maps key id to the email (might be deferred)
   * @type {goog.structs.Map.<string, !string|!e2e.async.Result<?string>>}
   * @private
   */
  this.keyIdEmailMap_ = new goog.structs.Map();
};

var ConameKeyProvider = e2e.coname.KeyProvider;


/**
 * Upon HTTP error 401, prompt the user for authentication to the keyserver.
 * Invokes the callback when the user has successfully authenticated.
 * @return {!e2e.async.Result<boolean>} Whether it is authenticated.
 */
ConameKeyProvider.prototype.authenticate = function() {
  if (this.authResult_) {
    return this.authResult_;
  }

  this.authResult_ = new e2e.async.Result;

  // TODO: url now hardcoded. support openid type
  var authUrl = 'https://by.bouncer.login.yahoo.com/login?url=' +
      encodeURIComponent(
          e2e.ext.config.CONAME.realms[0].addr + '/auth/cookies');

  chrome.windows.create({
    url: authUrl,
    width: 500,
    height: 640,
    type: 'popup'
  }, goog.bind(function(win) {

    var onClose_ = goog.bind(function(closedWinId) {
      if (win.id === closedWinId) {
        chrome.windows.onRemoved.removeListener(onClose_);
        this.authResult_.callback(true);
        this.authResult_ = null;
      }
    }, this);
    chrome.windows.onRemoved.addListener(onClose_);

  }, this));

  return this.authResult_;
};


/**
 * Imports public key to the key server.
 * @param {!Array.<e2e.openpgp.block.TransferablePublicKey>} keys The keys to
 *     import.
 * @param {string=} opt_uid The default user id
 * @return {!goog.async.Deferred.<boolean>} True if empty key or at least one
 *     of the keys are successfully updated according to the specified uids.
 */
ConameKeyProvider.prototype.importKeys = function(keys, opt_uid) {
  return this.client_.initialize().
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
          if (goog.isNull(key)) {
            return false;
          }

          // maintain a history mapping of keyId to email
          var allKeyPackets = key.subKeys ?
              key.subKeys.concat(key.keyPacket) :
              [key.keyPacket.keyId];
          goog.array.forEach(allKeyPackets, function(kp) {
            var result = this.keyIdEmailMap_.get(kp.keyId);
            // notify those pending asks
            if (result && result instanceof goog.async.Deferred) {
              result.callback(email);
            }
          }, this);

          return true;
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
  var map = this.keyIdEmailMap_,
      result = map.get(id),
      returnResult = new e2e.async.Result;

  // if no mapping exists, wait to see if getTrustedPublicKeysByEmail() answers
  if (!result) {
    result = new e2e.async.Result;
    map.set(id, result);

    // say null if no one answers after lookup request timeout
    setTimeout(function() {
      var result = map.get(id);
      if (result && result instanceof goog.async.Deferred) {
        result.callback(null);
      }
    }, e2e.coname.Client.LOOKUP_REQUEST_TIMEOUT);

  }
  // give the answer if the mapping has been resolved
  else if (!(result instanceof goog.async.Deferred)) {
    result = e2e.async.Result.toResult(result);
  }

  // resolve the email that has the keyid associated
  result.addCallback(function(email) {
    // if timeout happened, return empty keys and forget the mapping
    if (goog.isNull(email)) {
      map.remove(id);
      return [];
    }

    // update the mapping by specifying the correnspoding email
    map.set(id, email);

    // look up the key
    return this.getTrustedPublicKeysByEmail(email);
  }, this).
  addCallback(function(pubKeys) {
    return goog.array.filter(pubKeys, function(keyBlock) {
      return keyBlock.hasKeyById(id);
    });
  }).addCallback(returnResult.callback, returnResult);

  return returnResult;
};



});  // goog.scope
