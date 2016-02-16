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
 * @fileoverview A dialog to confirm key imports.
 */

goog.provide('e2e.ext.ui.dialogs.SyncConfirmation');

goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.templates.dialogs.syncconfirmation');
goog.require('goog.events.EventType');
goog.require('goog.string');

goog.scope(function() {
var ui = e2e.ext.ui;
var constants = e2e.ext.constants;
var dialogs = e2e.ext.ui.dialogs;
var templates = e2e.ext.ui.templates.dialogs.syncconfirmation;



/**
 * Constructor for the sync confirmation dialog.
 * @param {string} uid The user id being handled
 * @param {!e2e.openpgp.Keys} localOnlyKeys The keys that are local only.
 * @param {!e2e.openpgp.Keys} commonKeys The keys that are common to local and
 *     remote.
 * @param {!e2e.openpgp.Keys} remoteOnlyKeys The keys that are remote only.
 * @param {!function(string=)} callback The callback where the user's
 *     input must be passed.
 * @param {boolean=} opt_isOverride Whether to show Update instead of Add Key.
 * @constructor
 * @extends {dialogs.Generic}
 */
dialogs.SyncConfirmation = function(
    uid, localOnlyKeys, commonKeys, remoteOnlyKeys, callback, opt_isOverride) {

  var keyImportId = constants.ElementId.KEYRING_IMPORT;
  var remoteOnlyKeysLabel = goog.string.htmlEscape(
      chrome.i18n.getMessage('remoteOnlyKeysLabel')).replace(
          /#import#([^#]*)#/, '<label for="' + keyImportId + '">$1</label>');

  this.callback_ = callback;

  goog.base(
      this,
      templates.syncKeysConfirm({
        promptSyncKeyLabel: chrome.i18n.getMessage(
            'promptMatchRemoteKeysMessage'),
        uid: uid,
        localOnlyKeys: localOnlyKeys,
        commonKeys: commonKeys,
        remoteOnlyKeys: remoteOnlyKeys,
        localOnlyKeysLabel: chrome.i18n.getMessage('localOnlyKeysLabel'),
        commonKeysLabel: chrome.i18n.getMessage('commonKeysLabel'),
        remoteOnlyKeysLabel: soydata.VERY_UNSAFE.ordainSanitizedHtml(
            remoteOnlyKeysLabel),
        secretKeyDescription: chrome.i18n.getMessage('secretKeyDescription'),
        publicKeyDescription: chrome.i18n.getMessage('publicKeyDescription'),
        keyFingerprintLabel: chrome.i18n.getMessage('keyFingerprintLabel')
      }),
      callback,
      dialogs.InputType.CHECKBOX,
      chrome.i18n.getMessage('giveUpRemoteKeyCheckboxLabel'),
      chrome.i18n.getMessage(opt_isOverride === true ?
          'actionOverwriteRemoteKeys' : 'actionAddNewKey'),
      chrome.i18n.getMessage('actionCancelPgpAction'));
};
goog.inherits(dialogs.SyncConfirmation, dialogs.Generic);


/** @override */
dialogs.SyncConfirmation.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  this.getHandler().listen(
      this.getElement(),
      goog.events.EventType.CLICK,
      goog.bind(function(e) {
        if (e.target instanceof HTMLLabelElement) {
          this.callback_('');
        }
      }, this));
};

});  // goog.scope
