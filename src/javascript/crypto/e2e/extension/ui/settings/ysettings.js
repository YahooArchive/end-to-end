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
 * @fileoverview Provides the UI for the extension's settings page.
 */
goog.provide('e2e.ext.ui.ySettings');

goog.require('e2e.async.Result');
goog.require('e2e.cipher.Algorithm');
goog.require('e2e.coname.getRealmByEmail');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.Settings');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.templates.dialogs.importconfirmation');
goog.require('e2e.ext.ui.templates.dialogs.syncconfirmation');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.signer.Algorithm');
goog.require('goog.dom');
goog.require('goog.string');


goog.scope(function() {
var ext = e2e.ext;
var constants = e2e.ext.constants;
var dialogs = e2e.ext.ui.dialogs;
var messages = e2e.ext.messages;
var panels = e2e.ext.ui.panels;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;
var syncTemplates = e2e.ext.ui.templates.dialogs.syncconfirmation;
var importTemplates = e2e.ext.ui.templates.dialogs.importconfirmation;



/**
 * Constructor for the yahoo settings page.
 * @constructor
 * @extends {e2e.ext.ui.Settings}
 */
ui.ySettings = function() {
  goog.base(this);
};
goog.inherits(ui.ySettings, ui.Settings);


/**
 * Sync Keys
 * @param {string} keyUid The key UID to sync
 * @param {string} action The action, keygen or import
 * @param {boolean=} opt_overrideRemote Whether the user has acknowledged to
 *     override remote keys with local keyring.
 * @return {!e2e.async.Result.<{needsKeyGen: boolean, keysToKeep:
 *     ?e2e.openpgp.Keys, keysToImport: ?e2e.openpgp.Keys}>} The sync results
 * @private
 * @suppress {accessControls}
 */
ui.ySettings.prototype.syncKeys_ = function(
    keyUid, action, opt_overrideRemote) {
  return this.pgpContext_.syncKeys(keyUid, action,
      goog.bind(this.renderAuthCallback_, this),
      goog.bind(this.renderKeepExistingKeysCallback_, this),
      goog.bind(this.renderIgnoreMissingPrivateKeysCallback_, this),
      opt_overrideRemote === true ?
      undefined :
      goog.bind(this.renderOverrideRemoteKeysCallback_, this)).
    addErrback(this.displayFailure_, this);
};


/**
 * Renders a new PGP key into the settings page.
 * @param {string} keyUid The key UID to render.
 * @param {boolean=} opt_isKeyGen Whether the user has acknowledged to
 *     override remote keys with local keyring.
 * @suppress {accessControls}
 * @override
 */
ui.ySettings.prototype.renderNewKey_ = function(keyUid, opt_isKeyGen) {
  var ctx = this.pgpContext_;
  ctx.searchLocalKey(keyUid) // expected to return only local keys
      .addCallback(function(pgpKeys) {
        this.keyringMgmtPanel_.addNewKey(keyUid, pgpKeys);
        this.renderPanels_();


        // sync with remote only if such a keyUid has a private key
        var email = e2e.ext.utils.text.extractValidEmail(keyUid);
        if (email === null ||
            e2e.coname.getRealmByEmail(email) === null ||
            ctx.searchPrivateKey(keyUid).length === 0) {
          return;
        }

        this.syncKeys_(keyUid,
            opt_isKeyGen ? 'keygen' : 'import',
            opt_isKeyGen).
        addCallbacks(function(isInSync) {
          isInSync && utils.showNotification(
              chrome.i18n.getMessage('keyUpdateSuccessMsg'),
              goog.nullFunction);
        }, this.displayFailure_, this);

      }, this)
      .addErrback(this.displayFailure_, this);
};


// TODO: support updating empty key to keyserver
// /**
//  * Removes a PGP key.
//  * @param {string} keyUid The ID of the key to remove.
//  * @suppress {accessControls}
//  * @override
//  */
// ui.ySettings.prototype.removeKey_ = function(keyUid) {
//   this.pgpContext_
//       .searchPrivateKey(keyUid)
//       .addCallback(/** @this {ui.Settings} */ (function(privateKeys) {
//         // TODO(evn): This message should be localized.
//         var prompt = 'Deleting all keys for ' + keyUid;
//         if (privateKeys && privateKeys.length > 0) {
//           prompt += '\n\nWARNING: This will delete some private keys!';
//         }
//         if (window.confirm(prompt)) {
//           this.pgpContext_.deleteKey(keyUid).addCallback(function() {
//             this.keyringMgmtPanel_.removeKey(keyUid);
//             this.renderPanels_();
//           }, this);
//         }
//       }), this)
//       .addErrback(this.displayFailure_, this);
// };


/**
 * Generates a new PGP key using the information that is provided by the user.
 * Same as Settings.prototype.generateKey_ except added overrideRemote
 * @param {panels.GenerateKey} panel The panel where the user has provided the
 *     information for the new key.
 * @param {string} name The name to use.
 * @param {string} email The email to use.
 * @param {string} comments The comments to use.
 * @param {number} expDate The expiration date to use.
 * @private
 * @return {goog.async.Deferred}
 * @suppress {accessControls}
 */
ui.ySettings.prototype.generateKeyAndOverrideRemote_ = function(
    panel, name, email, comments, expDate) {
  var defaults = constants.KEY_DEFAULTS;
  return this.pgpContext_.generateKey(e2e.signer.Algorithm[defaults.keyAlgo],
      defaults.keyLength, e2e.cipher.Algorithm[defaults.subkeyAlgo],
      defaults.subkeyLength, name, comments, email, expDate)
      .addCallback(goog.bind(function(key) {
        this.renderNewKey_(key[0].uids[0], true); //@yahoo overrideRemote
        panel.reset();
      }, this)).addErrback(this.displayFailure_, this);
};


/**
 * Generate keys only after user acknowledges to add or override any existing
 * keys uploaded to the keyserver.
 * @suppress {accessControls}
 * @override
 * @private
 */
ui.ySettings.prototype.generateKey_ = function(
    panel, name, email, comments, expDate) {

  email = goog.string.trim(email);
  if (email === '') {
    return e2e.async.Result.toResult(undefined);
  }

  var uid = '<' + email + '>';
  var ctx = this.pgpContext_;

  return this.syncKeys_(uid, 'keygen').addCallbacks(function(needsNewKey) {
    if (needsNewKey) {
      // generate a new key and update the panel
      return this.generateKeyAndOverrideRemote_(
          panel, name, email, comments, expDate);
    }
    return [];
  }, this.displayFailure_, this);
};


/**
 * Prompt a login window
 * @param {string} email The email address used for coname query
 * @return {!e2e.async.Result} A promise
 * @private
 */
ui.ySettings.prototype.renderAuthCallback_ = function(email) {
  var result = new e2e.async.Result;

  // TODO: url now hardcoded
  var authUrl = 'https://by.bouncer.login.yahoo.com/login?url=' +
                encodeURIComponent(
                  'https://alpha.coname.corp.yahoo.com:25519/auth/cookies');

  chrome.windows.create({
    url: authUrl,
    // url: e2e.coname.getRealmByEmail(email).addr +
    //         '/auth?email=' + encodeURIComponent(email),
    width: 500,
    height: 640,
    type: 'popup'
  }, goog.bind(function(win) {

    var onClose_ = goog.bind(function(closedWinId) {
      if (win.id === closedWinId) {
        chrome.windows.onRemoved.removeListener(onClose_);
        result.callback();
      }
    }, this);
    chrome.windows.onRemoved.addListener(onClose_);

  }, this));

  return result;
};


/**
 * Renders the UI elements needed for adding or replacing new keys
 * @param {string} uid The user id being handled
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} keysToKeep
 * @return {!e2e.async.Result<string>} A promise
 * @private
 */
ui.ySettings.prototype.renderKeepExistingKeysCallback_ = function(
    uid, keysToKeep) {

  // skip the dialog if we have nothing to keep, for a new registration
  if (keysToKeep.length === 0) {
    return e2e.async.Result.toResult('true');
  }

  var result = new e2e.async.Result();
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  var dialog = new dialogs.Generic(
      importTemplates.importKeyConfirm({
        promptImportKeyConfirmLabel: chrome.i18n.getMessage(
            'promptAddReplaceKeysConfirmMessage'),
        keys: keysToKeep,
        secretKeyDescription: chrome.i18n.getMessage('secretKeyDescription'),
        publicKeyDescription: chrome.i18n.getMessage('publicKeyDescription'),
        keyFingerprintLabel: chrome.i18n.getMessage('keyFingerprintLabel')
      }),
      function(decision) {
        goog.dispose(dialog);
        result.callback(decision);
      },
      dialogs.InputType.CHECKBOX,
      chrome.i18n.getMessage('replaceKeyCheckboxLabel'),
      chrome.i18n.getMessage('promptOkActionLabel'),
      chrome.i18n.getMessage('actionCancelPgpAction'));

  this.addChild(dialog, false);
  dialog.render(popupElem);
  return result;
};


/**
 * Renders the UI elements needed for recommending users to make new keys in
 * case the private keys are not imported to match the existing ones.
 * @param {string} uid The user id being handled
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} localOnlyKeys
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} commonKeys
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} remoteOnlyKeys
 * @return {!e2e.async.Result<boolean>} A promise
 * @private
 */
ui.ySettings.prototype.renderIgnoreMissingPrivateKeysCallback_ = function(
    uid, localOnlyKeys, commonKeys, remoteOnlyKeys) {
  var result = new e2e.async.Result();
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  var dialog = new dialogs.Generic(
      syncTemplates.syncKeysConfirm({
        promptSyncKeyConfirmLabel: chrome.i18n.getMessage(
            'promptIgnoreMissingPrivateKeysConfirmMessage'),
        uid: uid,
        localOnlyKeys: localOnlyKeys,
        commonKeys: commonKeys,
        remoteOnlyKeys: remoteOnlyKeys,
        localOnlyKeysLabel: chrome.i18n.getMessage('localOnlyKeysLabel'),
        commonKeysLabel: chrome.i18n.getMessage('commonKeysLabel'),
        remoteOnlyKeysLabel: chrome.i18n.getMessage('remoteOnlyKeysLabel'),
        secretKeyDescription: chrome.i18n.getMessage('secretKeyDescription'),
        publicKeyDescription: chrome.i18n.getMessage('publicKeyDescription'),
        keyFingerprintLabel: chrome.i18n.getMessage('keyFingerprintLabel')
      }),
      function(decision) {
        goog.dispose(dialog);
        result.callback(goog.isDef(decision));
      },
      dialogs.InputType.NONE,
      '',
      chrome.i18n.getMessage('actionIgnoreMissingPrivateKeys'),
      chrome.i18n.getMessage('actionCancelPgpAction'));

  this.addChild(dialog, false);
  dialog.render(popupElem);
  return result;
};


/**
 * Renders the UI elements needed for requesting the user consent to override
 * remote keys with local copy.
 * @param {string} uid The user id being handled
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} localOnlyKeys
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} commonKeys
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} remoteOnlyKeys
 * @return {!e2e.async.Result<boolean>} A promise
 * @private
 */
ui.ySettings.prototype.renderOverrideRemoteKeysCallback_ = function(
    uid, localOnlyKeys, commonKeys, remoteOnlyKeys) {
  var result = new e2e.async.Result();
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  var dialog = new dialogs.Generic(
      syncTemplates.syncKeysConfirm({
        promptSyncKeyConfirmLabel: chrome.i18n.getMessage(
            'promptOverrideRemoteKeysConfirmMessage'),
        uid: uid,
        localOnlyKeys: localOnlyKeys,
        commonKeys: commonKeys,
        remoteOnlyKeys: remoteOnlyKeys,
        localOnlyKeysLabel: chrome.i18n.getMessage('localOnlyKeysLabel'),
        commonKeysLabel: chrome.i18n.getMessage('commonKeysLabel'),
        remoteOnlyKeysLabel: chrome.i18n.getMessage('remoteOnlyKeysLabel'),
        secretKeyDescription: chrome.i18n.getMessage('secretKeyDescription'),
        publicKeyDescription: chrome.i18n.getMessage('publicKeyDescription'),
        keyFingerprintLabel: chrome.i18n.getMessage('keyFingerprintLabel')
      }),
      function(decision) {
        goog.dispose(dialog);
        result.callback(goog.isDef(decision));
      },
      dialogs.InputType.NONE,
      '',
      chrome.i18n.getMessage('actionOverrideRemoteKeys'),
      chrome.i18n.getMessage('actionCancelPgpAction'));

  this.addChild(dialog, false);
  dialog.render(popupElem);
  return result;
};


});  // goog.scope
