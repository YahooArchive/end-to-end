/**
 * @license
 * Copyright 2014 Google Inc. All rights reserved.
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
 * @fileoverview Provides a minimized version of the keyring management UI.
 */

goog.provide('e2e.ext.ui.panels.KeyringMgmtMini');

goog.require('e2e.ext.actions.Executor');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.dialogs.BackupKey');
goog.require('e2e.ext.ui.dialogs.RestoreKey');
goog.require('e2e.ext.ui.templates.panels.keyringmgmt');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.object');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('goog.ui.KeyboardShortcutHandler');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var panels = e2e.ext.ui.panels;
var dialogs = e2e.ext.ui.dialogs;
var messages = e2e.ext.messages;
var templates = e2e.ext.ui.templates.panels.keyringmgmt;



/**
 * Constructor for the minimized version of the keyring management UI.
 * @param {!function()} exportCallback The callback to invoke when the keyring
 *     is to be exported.
 * @param {!function((!File|string))} importCallback The callback to invoke
 *     when an existing keyring is to be imported.
 * @param {!function(string)} updatePassphraseCallback The callback to invoke
 *     when the passphrase to the keyring is to be updated.
 * @param {!function(string)=} opt_restoreKeyringCallback The callback to invoke
 *     when the keyring is restored.
 * @param {!function()=} opt_cancelCallback Callback to invoke when the action
 *     is cancelled.
 * @param {string=} opt_content Content to show at the top of the panel.
 * @param {string=} opt_cancelLabel Optional custom label for the cancel button
 * @constructor
 * @extends {goog.ui.Component}
 */
panels.KeyringMgmtMini =
    function(exportCallback, importCallback, updatePassphraseCallback,
    opt_restoreKeyringCallback, opt_cancelCallback, opt_content,
    opt_cancelLabel) {
  goog.base(this);

  /**
   * The PGP context used by the extension.
   * @type {e2e.openpgp.Context}
   * @private
   */
  this.pgpContext_ = null;

  /**
   * The callback to invoke when the keyring is to be exported.
   * @type {!function()}
   * @private
   */
  this.exportCallback_ = exportCallback;

  /**
   * The callback to invoke when an existing keyring is to be imported.
   * @type {!function((!File|string))}
   * @private
   */
  this.importCallback_ = importCallback;

  /**
   * The callback to invoke when the passphrase to the keyring is to be updated.
   * @type {!function(string)}
   * @private
   */
  this.updatePassphraseCallback_ = updatePassphraseCallback;

  /**
   * The callback to invoke when the keyring is restored.
   * @type {!function(string)}
   * @private
   */
  this.restoreKeyringCallback_ = opt_restoreKeyringCallback ||
      goog.nullFunction;

  /**
   * The callback to invoke when the cancel button is clicked.
   * @type {!function()}
   * @private
   */
  this.cancelCallback_ = opt_cancelCallback || goog.nullFunction;

  /**
   * Label for the cancel button.
   * @type {string}
   * @private
   */
  this.cancelLabel_ = opt_cancelLabel ||
      chrome.i18n.getMessage('actionCancelPgpAction');

  /**
   * Optional content to show at the top of the panel.
   * @type {string}
   * @private
   */
  this.content_ = opt_content || '';

  /**
   * Executor for the End-to-End actions.
   * @type {!e2e.ext.actions.Executor}
   * @private
   */
  this.actionExecutor_ = new e2e.ext.actions.Executor();
};
goog.inherits(panels.KeyringMgmtMini, goog.ui.Component);


/**
 * @define {boolean} Whether backup code UI is enabled
 */
panels.KeyringMgmtMini.ENABLE_BACKUP_CODE = true;


/** @override */
panels.KeyringMgmtMini.prototype.createDom = function() {
  goog.base(this, 'createDom');
  this.decorateInternal(this.getElement());
};


/** @override */
panels.KeyringMgmtMini.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  soy.renderElement(elem, templates.manageKeyring, {
    importKeyringLabel: chrome.i18n.getMessage('keyMgmtImportKeyringLabel'),
    exportKeyringLabel: chrome.i18n.getMessage('keyMgmtExportKeyringLabel'),
    backupKeyringLabel: chrome.i18n.getMessage('keyMgmtBackupKeyringLabel'),
    restoreKeyringLabel: chrome.i18n.getMessage('keyMgmtRestoreKeyringLabel'),
    importCancelButtonTitle: chrome.i18n.getMessage('actionCancelPgpAction'),
    changePassphraseLabel:
        chrome.i18n.getMessage('keyMgmtChangePassphraseLabel'),
    changePassphrasePlaceholder:
        chrome.i18n.getMessage('keyMgmtChangePassphrasePlaceholder'),
    passphraseChangeActionButtonTitle:
        chrome.i18n.getMessage('keyMgmtChangePassphraseActionLabel'),
    passphraseChangeCancelButtonTitle:
        chrome.i18n.getMessage('actionCancelPgpAction'),
    confirmPassphrasePlaceholder:
        chrome.i18n.getMessage('keyMgmtConfirmPassphrasePlaceholder'),
    passphraseConfirmActionButtonTitle:
        chrome.i18n.getMessage('keyMgmtConfirmPassphraseActionLabel'),
    content: this.content_,
    cancelLabel: this.cancelLabel_,
    fbImportLabel: chrome.i18n.getMessage('keyMgmtFbImportLabel'),
    fbDescription: chrome.i18n.getMessage('keyMgmtFbImport')
  });

  var refreshOptions = true;

  // Only show buttons if they have defined callbacks
  if (this.exportCallback_ === goog.nullFunction) {
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_EXPORT),
        constants.CssClass.HIDDEN);
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.FB_IMPORT),
        constants.CssClass.HIDDEN);
  }
  if (this.updatePassphraseCallback_ === goog.nullFunction) {
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_PASSPHRASE_CHANGE),
        constants.CssClass.HIDDEN);
  }
  if (this.importCallback_ === goog.nullFunction) {
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_IMPORT),
        constants.CssClass.HIDDEN);
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.FB_IMPORT),
        constants.CssClass.HIDDEN);
  }
  if (this.cancelCallback_ === goog.nullFunction) {
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_CANCEL),
        constants.CssClass.HIDDEN);
  }
  if (this.restoreKeyringCallback_ === goog.nullFunction) {
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_RESTORE),
        constants.CssClass.HIDDEN);
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_BACKUP),
        constants.CssClass.HIDDEN);
    refreshOptions = false;
  }

  if (refreshOptions) {
    this.actionExecutor_.execute(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.LIST_KEYS,
      content: 'public'
    }), this, goog.bind(function(keys) {
      this.refreshOptions(!goog.object.isEmpty(keys));
    }, this));
  }

  if (!panels.KeyringMgmtMini.ENABLE_BACKUP_CODE) {
    goog.style.setElementShown(
        this.getElementByClass(constants.CssClass.KEYRING_BACKUP), false);
    goog.style.setElementShown(
        this.getElementByClass(constants.CssClass.KEYRING_RESTORE), false);
  }
};


/** @override */
panels.KeyringMgmtMini.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  var importDiv = this.getChildById_(
      constants.ElementId.KEYRING_IMPORT_DIV);
  var fbImportDiv = this.getChildById_(
      constants.ElementId.FB_IMPORT_DIV);
  var passphraseChangeDiv = this.getChildById_(
      constants.ElementId.KEYRING_PASSPHRASE_CHANGE_DIV);
  var passphraseConfirmDiv = this.getChildById_(
      constants.ElementId.KEYRING_PASSPHRASE_CONFIRM_DIV);

  var keyboardHandler = new goog.ui.KeyboardShortcutHandler(fbImportDiv);
  keyboardHandler.registerShortcut('enter', goog.events.KeyCodes.ENTER);

  this.getHandler().
      listen(
          this.getElementByClass(constants.CssClass.KEYRING_IMPORT),
          goog.events.EventType.CLICK,
          goog.partial(
              this.showKeyringMgmtForm_,
              constants.ElementId.KEYRING_IMPORT_DIV)).
      listen(
          this.getElementByClass(constants.CssClass.FB_IMPORT),
          goog.events.EventType.CLICK,
          goog.partial(
            this.showKeyringMgmtForm_,
            constants.ElementId.FB_IMPORT_DIV)).
      listen(
          this.getElementByClass(constants.CssClass.KEYRING_EXPORT),
          goog.events.EventType.CLICK,
          this.exportCallback_).
      listen(
          this.getElementByClass(constants.CssClass.KEYRING_BACKUP),
          goog.events.EventType.CLICK,
          this.showBackupWindow_).
      listen(
          this.getElementByClass(constants.CssClass.KEYRING_RESTORE),
          goog.events.EventType.CLICK,
          this.showRestoreWindow_).
      listen(
          this.getElementByClass(
              constants.CssClass.KEYRING_PASSPHRASE_CHANGE),
          goog.events.EventType.CLICK,
          goog.partial(
              this.showKeyringMgmtForm_,
              constants.ElementId.KEYRING_PASSPHRASE_CHANGE_DIV)).
      listen(
          this.getElementByClass(constants.CssClass.KEYRING_CANCEL),
          goog.events.EventType.CLICK,
          this.cancelCallback_).
      listen(
          goog.dom.getElementByClass(constants.CssClass.CANCEL, importDiv),
          goog.events.EventType.CLICK,
          goog.partial(
              this.showKeyringMgmtForm_,
              constants.ElementId.KEYRING_OPTIONS_DIV)).
      listen(
          goog.dom.getElementByClass(constants.CssClass.CANCEL, fbImportDiv),
          goog.events.EventType.CLICK,
          goog.partial(
              this.showKeyringMgmtForm_,
              constants.ElementId.KEYRING_OPTIONS_DIV)).
      listen(
          goog.dom.getElementByClass(constants.CssClass.ACTION, importDiv),
          goog.events.EventType.CHANGE,
          this.importKeyring_).
      listen(
          goog.dom.getElementByClass(constants.CssClass.ACTION, fbImportDiv),
          goog.events.EventType.CLICK,
          this.fbImportKey_).
      listen(
          goog.dom.getElementByClass(
              constants.CssClass.CANCEL, passphraseChangeDiv),
          goog.events.EventType.CLICK,
          goog.partial(
              this.showKeyringMgmtForm_,
              constants.ElementId.KEYRING_OPTIONS_DIV)).
      listen(
          goog.dom.getElementByClass(
              constants.CssClass.ACTION, passphraseChangeDiv),
          goog.events.EventType.CLICK,
          this.confirmKeyringPassphrase_).
      listen(
          goog.dom.getElementByClass(
              constants.CssClass.ACTION, passphraseConfirmDiv),
          goog.events.EventType.CLICK,
          this.updateKeyringPassphrase_).
      listen(
          goog.dom.getElementByClass(
              constants.CssClass.CANCEL, passphraseConfirmDiv),
          goog.events.EventType.CLICK,
          goog.partial(
              this.showKeyringMgmtForm_,
              constants.ElementId.KEYRING_OPTIONS_DIV)).
      listen(
          keyboardHandler,
          goog.ui.KeyboardShortcutHandler.EventType.SHORTCUT_TRIGGERED,
          this.fbImportKey_);

      // Hide overlays when user clicks outside them
      window.document.addEventListener('click', goog.bind(function(e) {
        if (e.target.nodeName === 'BUTTON') {
          return;
        }
        var overlays = goog.dom.getElementsByClass('overlayDialog');
        goog.array.forEach(overlays, function(elem) {
          goog.style.setElementShown(elem, false);
        });
      }, this));
};


/**
 * Shows the selected keyring management form and hides all other such forms.
 * @param {string} formId The ID of the form to show.
 * @private
 */
panels.KeyringMgmtMini.prototype.showKeyringMgmtForm_ = function(formId) {
  goog.array.forEach(
      this.getElement().querySelectorAll('div[id]'), function(elem) {
        goog.dom.classlist.add(elem, constants.CssClass.HIDDEN);
      });

  goog.dom.classlist.remove(
      this.getChildById_(formId), constants.CssClass.HIDDEN);

  if (formId == constants.ElementId.KEYRING_PASSPHRASE_CHANGE_DIV ||
      formId == constants.ElementId.KEYRING_PASSPHRASE_CONFIRM_DIV) {
    var inputElem = this.getChildById_(formId).querySelector('input');
    inputElem.value = '';
    inputElem.focus();

    // Pressing Enter triggers the next step.
    var keyboardHandler = new goog.ui.KeyboardShortcutHandler(inputElem);
    keyboardHandler.registerShortcut('enter', goog.events.KeyCodes.ENTER);
    this.getHandler().listenOnce(
        keyboardHandler,
        goog.ui.KeyboardShortcutHandler.EventType.SHORTCUT_TRIGGERED,
        ((formId == constants.ElementId.KEYRING_PASSPHRASE_CHANGE_DIV) ?
            this.confirmKeyringPassphrase_ : this.updateKeyringPassphrase_));
  }
};


/**
 * Handles requests from the user to import an existing keyring.
 * @private
 */
panels.KeyringMgmtMini.prototype.importKeyring_ = function() {
  var importDiv = this.getChildById_(
      constants.ElementId.KEYRING_IMPORT_DIV);
  var fileInput = importDiv.querySelector('input');

  if (fileInput.files.length > 0) {
    this.importCallback_(fileInput.files[0]);
  }
};


/**
 * Handles requests from the user to import a key from Facebook.
 * @private
 */
panels.KeyringMgmtMini.prototype.fbImportKey_ = function() {
  var importDiv = this.getChildById_(
      constants.ElementId.FB_IMPORT_DIV);
  var username = importDiv.querySelector('input').value;
  var errDiv = document.getElementById(constants.ElementId.ERROR_DIV);
  errDiv.textContent = '';
  if (!username) {
    errDiv.textContent = chrome.i18n.getMessage('keyMgmtFbInvalid');
    return;
  }
  username = goog.string.urlEncode(goog.string.trim(username));
  this.sendFbRequest_(username, this.importCallback_, function() {
    errDiv.textContent = chrome.i18n.getMessage('keyMgmtFbFail', username);
  });
};


/**
 * Sends a public key request to Facebook.
 * @param {string} username The username to get a key for.
 * @param {!function(string)} cb The callback to call with the response text.
 * @param {!function()} errback The error callback.
 * @private
 */
panels.KeyringMgmtMini.prototype.sendFbRequest_ = function(username, cb,
                                                           errback) {
  var url = ['https://www.facebook.com', username, 'publickey',
    'download?_rdr=p'].join('/');
  var xhr = new XMLHttpRequest();
  xhr.timeout = 2000;
  xhr.open('GET', url, true);
  xhr.send();

  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        cb(xhr.responseText);
      } else {
        errback();
      }
    }
  };
};


/**
 * Handles requests from the user to update the keyring's passphrase.
 * @private
 */
panels.KeyringMgmtMini.prototype.updateKeyringPassphrase_ = function() {
  var passphrases = goog.array.map(
      this.getElementsByClass(constants.CssClass.PASSPHRASE), function(elem) {
        return elem.value;
      });

  if (this.hasMatchingPassphrases_(passphrases)) {
    this.showKeyringMgmtForm_(constants.ElementId.KEYRING_OPTIONS_DIV);
    this.updatePassphraseCallback_(passphrases[0]);
  } else {
    window.alert(chrome.i18n.getMessage('keyMgmtPassphraseMismatchLabel'));
    // Show the form again to create listeners and clear the input.
    this.showKeyringMgmtForm_(
        constants.ElementId.KEYRING_PASSPHRASE_CONFIRM_DIV);
  }
};


/**
 * Returns true if the provided passphrases match.
 * @param {!Array.<string>} passphrases The passphrases to check.
 * @return {boolean} True if the provided passphrases match.
 * @private
 */
panels.KeyringMgmtMini.prototype.hasMatchingPassphrases_ =
    function(passphrases) {
  if (passphrases.length < 2) {
    return false;
  }

  var masterPassphrase = passphrases[0];
  return goog.array.every(passphrases, function(passphrase) {
    return masterPassphrase == passphrase;
  });
};


/**
 * Asks the user to confirm the new passphrase for the existing keyring.
 * @private
 */
panels.KeyringMgmtMini.prototype.confirmKeyringPassphrase_ = function() {
  this.showKeyringMgmtForm_(constants.ElementId.KEYRING_PASSPHRASE_CONFIRM_DIV);
};


/**
 * Shows the backup window.
 * @private
 */
panels.KeyringMgmtMini.prototype.showBackupWindow_ = function() {
  new dialogs.BackupKey().setVisible(true);
};


/**
 * Shows the restore window.
 * @private
 */
panels.KeyringMgmtMini.prototype.showRestoreWindow_ = function() {
  new dialogs.RestoreKey(goog.bind(function() {
    this.refreshOptions.apply(this, arguments);
    this.restoreKeyringCallback_.apply(this, arguments);
  }, this)).setVisible(true);
};


/**
 * Updates the button to set the keyring's passphrase according to whether the
 * keyring is encrypted or not.
 * @param {boolean} encrypted True if the keyring is encrypted.
 */
panels.KeyringMgmtMini.prototype.setKeyringEncrypted = function(encrypted) {
  var button = this.getElementByClass(
      constants.CssClass.KEYRING_PASSPHRASE_CHANGE);
  button.textContent = encrypted ?
      chrome.i18n.getMessage('keyMgmtChangePassphraseLabel') :
      chrome.i18n.getMessage('keyMgmtAddPassphraseLabel');
};


/**
 * Resets the appearance of the panel.
 */
panels.KeyringMgmtMini.prototype.reset = function() {
  this.getChildById_(constants.ElementId.KEYRING_IMPORT_DIV)
      .querySelector('input').value = '';
  this.showKeyringMgmtForm_(constants.ElementId.KEYRING_OPTIONS_DIV);
};


/**
 * Refresh options when available keys have been updated
 * @param {boolean} hasKeys Whether there are keys in the keyring
 */
panels.KeyringMgmtMini.prototype.refreshOptions = function(hasKeys) {
  this.getElementByClass(constants.CssClass.KEYRING_EXPORT).disabled = !hasKeys;
  if (hasKeys) {
    goog.dom.classlist.remove(
        this.getElementByClass(constants.CssClass.KEYRING_BACKUP),
        e2e.ext.constants.CssClass.HIDDEN);
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_RESTORE),
        e2e.ext.constants.CssClass.HIDDEN);
  } else {
    goog.dom.classlist.add(
        this.getElementByClass(constants.CssClass.KEYRING_BACKUP),
        e2e.ext.constants.CssClass.HIDDEN);
    goog.dom.classlist.remove(
        this.getElementByClass(constants.CssClass.KEYRING_RESTORE),
        e2e.ext.constants.CssClass.HIDDEN);
  }
};


/**
 * Gets a child by its ID or null if none is found. Useful because this
 * component may be rendered twice in the same document. :(
 * @param {string} id The ID to get
 * @return {Element}
 * @private
 */
panels.KeyringMgmtMini.prototype.getChildById_ = function(id) {
  return this.getElement().querySelector('#' + id);
};


});  // goog.scope
