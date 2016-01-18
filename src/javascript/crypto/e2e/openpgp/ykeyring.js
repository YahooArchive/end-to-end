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
goog.require('e2e.openpgp.KeyRing');
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
 * //@yahoo this is intended, as we want to use the coname client
 * @type {e2e.coname.Client}
 * @private
 * @suppress {accessControls}
 */
e2e.openpgp.yKeyRing.keyClient_ = null;


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
 * @suppress {checkTypes}
 */
e2e.openpgp.yKeyRing.prototype.searchKeyLocalAndRemote = function(uid,
    opt_type) {
  var resultKeys = new e2e.async.Result();

  // use extractValidEmail instead in case server allows non-yahoo addresses
  var email = e2e.ext.utils.text.extractValidEmail(uid);

  var uidOrMatcher = uid === email && email !== null ? function (uid_) {
    return goog.string.caseInsensitiveContains(uid_, email);
  } : uid;
  
  var localKeys = this.searchKey(uidOrMatcher, opt_type);
  
  // append remote public keys, if any
  /** @suppress {accessControls} */
  if (opt_type != e2e.openpgp.KeyRing.Type.PUBLIC ||
      this.conameClient_ == null ||
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
