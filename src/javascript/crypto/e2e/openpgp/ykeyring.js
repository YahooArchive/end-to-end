/**
 * @license
 * Copyright 2013 Google Inc. All rights reserved.
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
 * @fileoverview Implements a key ring that exposes basic key management
 *    features such as generating, searching, importing, exporting keys, etc.
 *    The key ring shall be stored in Chrome's local storage, and shall be
 *    encrypted if the user provides a passphrase.
 */

goog.provide('e2e.openpgp.yKeyRing');

goog.require('e2e');
goog.require('e2e.async.Result');
goog.require('e2e.coname.KeyProvider');
goog.require('e2e.coname.CachedKeyProvider');
goog.require('e2e.coname.getRealmByEmail');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.KeyRing');
goog.require('e2e.openpgp.block.factory');
goog.require('goog.array');
goog.require('goog.functions');
goog.require('goog.string');



/**
 * Implements a key ring that exposes basic key management features such as
 * generating, searching, importing, exporting keys, etc. The key ring shall
 * be stored in browser's local storage, and shall be encrypted if the user
 * provides a passphrase.
 * @param {!e2e.openpgp.LockableStorage} lockableStorage persistent
 *    storage mechanism.
 * @extends {e2e.openpgp.KeyRing}
 * @constructor
 */
e2e.openpgp.yKeyRing = function(lockableStorage) {
  goog.base(this, lockableStorage);
};
goog.inherits(e2e.openpgp.yKeyRing, e2e.openpgp.KeyRing);


/**
 * the coname KeyProvider
 * @type {e2e.coname.KeyProvider}
 * @private
 */
e2e.openpgp.yKeyRing.prototype.conameKeyProvider_ = null;


/**
 * Creates and initializes the CONAME KeyProvider and KeyRing object with an
 *    unlocked storage.
 * @param {!e2e.openpgp.LockableStorage} lockableStorage persistent
 *    storage mechanism. Storage must already be unlocked, otherwise this method
 *    will return a {@link e2e.openpgp.error.MissingPassphraseError}.
 * @param {string=} opt_keyServerUrl The optional http key server url. If not
 *    specified then only support key operation locally.
 * @return {!goog.async.Deferred.<!e2e.openpgp.KeyRing>} The initialized
 *    keyring.
 * @override
 */
e2e.openpgp.yKeyRing.launch = function(lockableStorage, opt_keyServerUrl) {

  // back to regular KeyRing when opt_keyServerUrl is specified or during tests
  if (opt_keyServerUrl ||
      !Boolean(chrome.runtime.getURL)) {
    return e2e.openpgp.KeyRing.launch(lockableStorage, opt_keyServerUrl);
  }

  var keyRing = new e2e.openpgp.yKeyRing(lockableStorage);
  return /** @type {!goog.async.Deferred.<!e2e.openpgp.KeyRing>} */ (
      keyRing.initialize().addCallback(function() {
        this.conameKeyProvider_ = new e2e.coname.CachedKeyProvider();
        return this;
      }, keyRing));
};


/**
 * //@yahoo if uid has an email, search all uids that contain such email
 * Searches a public or private key associated with a User ID.
 * @param {string} uid User ID to search for, or empty to search all.
 * @param {e2e.openpgp.KeyRing.Type=} opt_type Key type to search for.
 * @return {?Array.<!e2e.openpgp.block.TransferableKey>} An array of keys
 *     matching the criteria.
 * @override
 */
e2e.openpgp.yKeyRing.prototype.searchKey = function(uid, opt_type) {
  var email = e2e.ext.utils.text.extractValidEmail(uid);
  return (email === null) ?
      goog.base(this, 'searchKey', uid, opt_type) :
      this.searchKeysByUidMatcher(
          goog.bind(this.emailUidMatcher_, this, email), opt_type);
};


/**
 * The standard matcher to look up any uids that contains the email
 * @param {!string} email Email address
 * @param {!string} uid User ID
 * @return {!boolean}
 * @private
 */
e2e.openpgp.yKeyRing.prototype.emailUidMatcher_ = function(email, uid) {
  return goog.string.caseInsensitiveContains(uid, email);
};


/**
 * Upload the local public keys for the user id
 * @param {string} uid The uid
 * @return {!goog.async.Deferred.<boolean>} True if at least one of the keys
 *     are successfully uploaded according to the specified uids.
 */
e2e.openpgp.yKeyRing.prototype.uploadKeys = function(uid) {
  return this.conameKeyProvider_.importKeys(this.searchKey(uid) || [], uid);
};


/**
 * Searches a public or private key for a User ID asynchronously. The search is
 * first performed locally. If we're searching for public key, then searches
 * and appends the public key from the http key server. If the server does not
 * respond properly, proceed with the local keys if any. Otherwise, propagate
 * the server-returned error. In no case, the remote keys are imported into the
 * local keyring.
 * @param {string} uid User ID to search for, or empty to search all.
 * @param {e2e.openpgp.KeyRing.Type=} opt_type Key type to search for.
 * @return {!e2e.async.Result.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *    An array of keys for the given User ID or [] if not found.
 * @override
 */
e2e.openpgp.yKeyRing.prototype.searchKeyLocalAndRemote = function(uid,
    opt_type) {
  var email = e2e.ext.utils.text.extractValidEmail(uid);
  // localKeys could be null if none is found
  var localKeys = this.searchKey(uid, opt_type) || [];

  // append remote public keys, if any
  if ((opt_type && opt_type === e2e.openpgp.KeyRing.Type.PRIVATE) ||
      this.conameKeyProvider_ === null ||
      email === null) {
    return e2e.async.Result.toResult(localKeys);
  }

  var result = new e2e.async.Result;

  this.conameKeyProvider_.getTrustedPublicKeysByEmail(email).
      addCallbacks(function(pubKeys) {
        if (pubKeys.length === 0) {
          result.callback(localKeys);
          return;
        }

        // De-duplicate keys
        var allKeys = localKeys.concat(pubKeys);
        goog.array.removeDuplicates(allKeys, null, function(key) {
          return key.keyPacket.fingerprint.join(',');
        });
        result.callback(allKeys);

      }, function(err) {
        // TODO: revisit this to see if we want to ignore other errors
        localKeys.length === 0 && err.messageId === 'conameConnectionError' ?
            result.errback(err) :
            result.callback(localKeys); // proceed with just the local keys
      });

  return result;
};


/**
 * Obtains a key block corresponding to the given key object or null.
 * @param {!e2e.openpgp.Key} keyObject
 * @return {!e2e.async.Result<?e2e.openpgp.block.TransferableKey>}
 * @override
 */
e2e.openpgp.yKeyRing.prototype.getKeyBlock = function(keyObject) {
  // Obtains a key block from local keyring
  return goog.base(this, 'getKeyBlock', keyObject).
      addCallback(function(localKeyBlock) {

        // always prefer local private key. for public keys, use local if any
        if (keyObject.key.secret || localKeyBlock !== null ||
            !keyObject.serialized || keyObject.serialized.length === 0) {
          return localKeyBlock;
        }

        // in case not found in local, use the serialized one if it is present
        // this serialized blob is fetched from keyserver
        var pubKey = e2e.openpgp.block.factory.
                parseByteArrayTransferableKey(keyObject.serialized);
        return pubKey.processSignatures().
            addCallback(goog.functions.constant(pubKey));

      });
};


/**
 * Obtains a key block having a key with the given key ID locally and remotely
 * or null.
 * @param {!e2e.ByteArray} keyId
 * @param {boolean=} opt_secret Whether to search the private key ring.
 * @return {!e2e.async.Result<?e2e.openpgp.block.TransferableKey>}
 * @override
 */
e2e.openpgp.yKeyRing.prototype.getKeyBlockById = function(keyId,
    opt_secret) {
  // Obtains a key block from local keyring
  return goog.base(this, 'getKeyBlockById', keyId, opt_secret).
      addCallback(function(localKeyBlock) {

        // always prefer local private key. for public keys, use local if any
        if (opt_secret || localKeyBlock !== null) {
          return localKeyBlock;
        }

        return this.conameKeyProvider_.getVerificationKeysByKeyId(keyId).
            addCallback(function(keys) {
              return keys[0] || null;
            });
      }, this);
};


/**
 * Compare local keys with the remote key provider
 * @param {string} uid The uid for remote sync check
 * @return {!goog.async.Deferred}
 */
e2e.openpgp.yKeyRing.prototype.compareWithRemote = function(uid) {

  var email = e2e.ext.utils.text.extractValidEmail(uid);

  // search for the local public keys
  var localKeys = this.searchKey(uid, e2e.openpgp.KeyRing.Type.PUBLIC) || [];


  if (email === null || e2e.coname.getRealmByEmail(email) === null) {
    return e2e.async.Result.toResult({
      syncManaged: false,
      localOnly: [],
      common: localKeys.map(function(k) {return k.toKeyObject();}),
      remoteOnly: []
    });
  }

  return this.conameKeyProvider_.getTrustedPublicKeysByEmail(email).
      addCallback(function(remoteKeys) {

        var localOnly = goog.array.filter(localKeys, function(l) {
          var lFingerprint = l.keyPacket.fingerprint;
          return goog.array.every(remoteKeys, function(r) {
            return !e2e.compareByteArray(
                lFingerprint, r.keyPacket.fingerprint);
          });
        });

        var common = goog.array.filter(localKeys, function(l) {
          var lFingerprint = l.keyPacket.fingerprint;
          return goog.array.every(localOnly, function(r) {
            return !e2e.compareByteArray(
                lFingerprint, r.keyPacket.fingerprint);
          });
        });

        var remoteOnly = goog.array.filter(remoteKeys, function(l) {
          var lFingerprint = l.keyPacket.fingerprint;
          return goog.array.every(localKeys, function(r) {
            return !e2e.compareByteArray(
                lFingerprint, r.keyPacket.fingerprint);
          });
        });

        return {
          syncManaged: true,
          localOnly: localOnly.map(function(k) {return k.toKeyObject();}),
          common: common.map(function(k) {return k.toKeyObject();}),
          remoteOnly: remoteOnly.map(function(k) {return k.toKeyObject();})
        };

      }, this);
};
