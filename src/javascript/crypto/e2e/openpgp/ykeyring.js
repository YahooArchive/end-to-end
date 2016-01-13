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

goog.require('e2e.coname.Client');
goog.require('e2e.openpgp.KeyRing');
goog.require('goog.functions');



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
 * Creates and initializes the CONAME client and KeyRing object with an
 *    unlocked storage.
 * @param {!e2e.openpgp.LockableStorage} lockableStorage persistent
 *    storage mechanism. Storage must already be unlocked, otherwise this method
 *    will return a {@link e2e.openpgp.error.MissingPassphraseError}.
 * @param {?string=} opt_keyServerUrl ignored, as we'll use coname
 * @return {!goog.async.Deferred.<!e2e.openpgp.KeyRing>} The initialized
 *    keyring.
 * @override
 */
e2e.openpgp.yKeyRing.launch = function(lockableStorage, opt_keyServerUrl) {
  var keyRing = new e2e.openpgp.yKeyRing(lockableStorage);
  var returnKeyRing = goog.functions.constant(keyRing);
  return /** @type {!goog.async.Deferred.<!e2e.openpgp.KeyRing>} */ (
      keyRing.initialize().addCallback(function() {
        this.keyClient_ = new e2e.coname.Client();
        return this.keyClient_.initialize();
      }).addCallback(returnKeyRing));
};

