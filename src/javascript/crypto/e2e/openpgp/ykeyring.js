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

goog.require('e2e.async.Result');
goog.require('e2e.coname.Client');
goog.require('e2e.ext.utils.Error');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.KeyRing');
goog.require('e2e.openpgp.block.TransferablePublicKey');
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
 * the coname client
 * @type {e2e.coname.Client}
 * @private
 */
e2e.openpgp.yKeyRing.conameClient_ = null;


/**
 * Creates and initializes the CONAME client and KeyRing object with an
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
      !Boolean(chrome.runtime.getURL) ||
      !Boolean(chrome.runtime.getURL(e2e.coname.Client.PROTO_FILE_PATH))) {
    return e2e.openpgp.KeyRing.launch(lockableStorage, opt_keyServerUrl);
  }

  var keyRing = new e2e.openpgp.yKeyRing(lockableStorage);
  var returnKeyRing = goog.functions.constant(keyRing);
  return /** @type {!goog.async.Deferred.<!e2e.openpgp.KeyRing>} */ (
      keyRing.initialize().addCallback(function() {
        /** @suppress {accessControls} */
        this.conameClient_ = new e2e.coname.Client();
        return this.conameClient_.initialize();
      }, keyRing).addCallback(returnKeyRing));
};


/** @override */
e2e.openpgp.yKeyRing.prototype.generateKey = function(uid,
                                                     keyAlgo,
                                                     keyLength,
                                                     subkeyAlgo,
                                                     subkeyLength,
                                                     opt_keyLocation) {

  // TODO: key management on updates (conameClient may fail)
  if (this.searchKey(uid, e2e.openpgp.KeyRing.Type.PRIVATE)) {
    return e2e.async.Result.toError(new e2e.ext.utils.Error(
        'There is already a key for this address in the keyring. ' +
        'Please BACKUP and remove it before using a new one.',
        'duplicateKeyWarning'));
  }

  var generateKey_ = goog.base(this, 'generateKey', uid, keyAlgo, keyLength,
      subkeyAlgo, subkeyLength, opt_keyLocation);

  // use the original generateKey if no conameClient_ exists
  if (this.conameClient_ === null) {
    return generateKey_;
  }

  return generateKey_.addCallback(function(keys) {

    // only one public key will be seen, upload it. delete the key when error
    for (var i = 0, n = keys.length; i < n; i++) {
      if (keys[i] instanceof e2e.openpgp.block.TransferablePublicKey) {
        return this.conameClient_.importPublicKey(keys[i]).addCallbacks(
            goog.functions.constant(keys),
            function() { this.deleteKey(uid); },
            this);
      }
    }

  }, this);
};


// /** @override */
// e2e.openpgp.yKeyRing.prototype.importKey = function(
//     keyBlock, opt_passphrase) {

//   return goog.base(this, 'importKey', keyBlock, opt_passphrase).
//     addCallback(function (returnedKeyBlock) {
//       var uids = returnedKeyBlock.getUserIds();
//       goog.array.removeDuplicates(uids);


//       if (keyBlock instanceof e2e.openpgp.block.TransferablePublicKey) {


//       return e2e.async.Result.toResult(returnedKeyBlock);
//     });

//   var result = e2e.async.Result.toResult(undefined);
//   return result.addCallback(function() {
//     var keys = [keyBlock.keyPacket].concat(keyBlock.subKeys);
//     var keyRing;
//     if (keyBlock instanceof e2e.openpgp.block.TransferablePublicKey) {
//       keyRing = this.pubKeyRing_;
//     } else if (keyBlock instanceof e2e.openpgp.block.TransferableSecretKey) {
//       keyRing = this.privKeyRing_;
//     } else {
//       return false;
//     }
//     // This will throw on signature verification failures.
//     keyBlock.processSignatures();
//     var uids = keyBlock.getUserIds();
//     goog.array.removeDuplicates(uids);
//     var importedKeysResults = goog.async.DeferredList.gatherResults(
//         goog.array.map(uids, function(uid) {
//           return this.importKey_(uid, keyBlock, keyRing, opt_passphrase);
//         }, this));
//     return importedKeysResults.addCallback(function(importedKeys) {
//       // Return the key only if it was imported for all the uids.
//       return (importedKeys.indexOf(false) == -1) ? keyBlock : null;
//     });
//   }, this);
// };


/**
 * Searches a public or private key for a User ID asynchronously. The search is
 * first performed locally. If we're searching for public key, then searches
 * and appends the public key from the http key server. Do not import the found
 * key to the local keyring.
 * @param {string} uid User ID to search for, or empty to search all.
 * @param {e2e.openpgp.KeyRing.Type=} opt_type Key type to search for.
 * @return {!e2e.async.Result.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *    An array of keys for the given User ID or [] if not found.
 * @override
 */
e2e.openpgp.yKeyRing.prototype.searchKeyLocalAndRemote = function(uid,
    opt_type) {
  var resultKeys = new e2e.async.Result();

  // use extractValidEmail instead in case server allows non-yahoo addresses
  var email = e2e.ext.utils.text.extractValidEmail(uid);

  var localKeys;

  if (uid === email && email !== null) {
    localKeys = this.searchKeysByUidMatcher(function(uid_) {
      return goog.string.caseInsensitiveContains(
          uid_,
          /** @type {string} */ (email));
    }, opt_type);
  } else {
    localKeys = this.searchKey(uid, opt_type);
  }

  // localKeys could be null if none is found
  if (localKeys === null) {
    localKeys = [];
  }

  // append remote public keys, if any
  /** @suppress {accessControls} */
  if (opt_type != e2e.openpgp.KeyRing.Type.PUBLIC ||
      this.conameClient_ === null ||
      goog.string.isEmptySafe(email)) {
    resultKeys.callback(localKeys);
  } else {
    this.conameClient_.searchPublicKey(email).addCallback(function(pubKeys) {
      if (pubKeys.length > 0) {
        var allKeys = localKeys.concat(pubKeys);
        // deduplicate local and remote keys
        goog.array.removeDuplicates(allKeys);
        resultKeys.callback(allKeys);
      } else {
        resultKeys.callback(localKeys);
      }
    });
  }

  return resultKeys;
};
