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
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.Settings');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.templates.dialogs.importconfirmation');
goog.require('e2e.ext.ui.templates.dialogs.syncconfirmation');
goog.require('goog.array');
goog.require('goog.async.DeferredList');
goog.require('goog.dom');


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
      width: 640,
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
 * Override to add email validity and priv key duplicate check
 * @suppress {accessControls}
 * @override
 * @private
 */
ui.ySettings.prototype.generateKey_ = function(
    panel, name, email, comments, expDate) {

  var uid = '<' + email + '>';
  var ctx = this.pgpContext_;

  return ctx.syncKeys(uid,
      goog.bind(this.renderAuthCallback_, this),
      goog.bind(this.renderIgnoreMissingPrivateKeysCallback_, this),
      goog.bind(this.renderOverrideRemoteKeysCallback_, this)).
      addCallbacks(function(syncResults) {
        syncResults = /** @type {{shouldAddKey: boolean, keysToKeep:
          ?e2e.openpgp.Keys, keysToImport: ?e2e.openpgp.Keys}} */(syncResults);
        if (!syncResults.shouldAddKey) {
          return;
        }

        return this.renderKeepExistingKeysCallback_(
            uid, syncResults.keysToKeep || []).
        addCallback(function(preferKeep) {
          var defer;
          switch (preferKeep) {
            case '': return;
            case 'false':
              defer = ctx.deleteKey(uid);
              break;
            case 'true':
              defer = goog.async.DeferredList.gatherResults(goog.array.map(
                  syncResults.keysToImport || [], function(keyObject) {
                    return ctx.importKey(
                                goog.nullFunction, keyObject.serialized);
                  }));
              break;
          }
          return defer.
              addCallback(function() {
                return ui.Settings.prototype.generateKey_.call(this,
                    panel, name, email, comments, expDate);
              }, this).
              addCallback(function(newKeys) {
                // to trigger uploading the local key ring
                return ctx.syncKeys(uid, 
                  goog.bind(this.renderAuthCallback_, this));
              }, this);
        }, this);

      }, this.displayFailure_, this);
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
