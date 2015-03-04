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
 * @fileoverview Renders the setup page of the extension.
 */

goog.provide('e2e.ext.ui.Setup');

goog.require('e2e.cipher.Algorithm');
goog.require('e2e.ext.actions.Executor');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.dialogs.BackupKey');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.panels.GenerateKey');
goog.require('e2e.ext.ui.panels.KeyringMgmtMini');
goog.require('e2e.ext.ui.templates.setup');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.action');
goog.require('e2e.signer.Algorithm');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events.EventType');
goog.require('goog.object');
goog.require('goog.ui.Component');
goog.require('soy');

goog.scope(function() {
var ui = e2e.ext.ui;
var constants = e2e.ext.constants;
var dialogs = e2e.ext.ui.dialogs;
var messages = e2e.ext.messages;
var templates = ui.templates.setup;
var utils = e2e.ext.utils;



/**
 * Constructor for the welcome page.
 * @constructor
 * @extends {goog.ui.Component}
 */
ui.Setup = function() {
  goog.base(this);

  /**
   * Executor for the End-to-End actions.
   * @type {!e2e.ext.actions.Executor}
   * @private
   */
  this.actionExecutor_ = new e2e.ext.actions.Executor(
      goog.bind(this.displayFailure_, this));
};
goog.inherits(ui.Setup, goog.ui.Component);


/**
 * The form where novice users can add their email address to get set up.
 * @type {ui.panels.GenerateKey}
 * @private
 */
ui.Setup.prototype.genKeyForm_ = null;


/**
 * A component to let the user set up the extension's keyring.
 * @type {ui.panels.KeyringMgmtMini}
 * @private
 */
ui.Setup.prototype.keyringMgmt_ = null;


/** @override */
ui.Setup.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  var tutorialSection = {
    title: chrome.i18n.getMessage('welcomeBasicsTitle'),
    subsections: [
      {text: ''},
      {frame: {
        width: '100%'
      }}
    ],
    id: 'tutorial'
  };

  var noviceSection = {
    title: chrome.i18n.getMessage('welcomeNoviceTitle'),
    subsections: [],
    id: 'generate-key'
  };

  var advancedSection = {
    title: chrome.i18n.getMessage('welcomeAdvancedTitle'),
    subsections: [],
    id: 'restore-key'
  };

  var introSection = {
    title: 'Generate keys',
    subsections: [],
    id: 'intro'
  };

  var backupSection = {
    title: 'Your key backup code',
    subsections: [],
    id: 'backup-key'
  };

  var passphraseSection = {
    title: 'Set a passphrase',
    subsections: [],
    id: 'set-passphrase'
  };

  soy.renderElement(elem, templates.setup, {
    headerText: chrome.i18n.getMessage('welcomeHeader'),
    introSection: introSection,
    tutorialSection: tutorialSection,
    noviceSection: noviceSection,
    advancedSection: advancedSection,
    backupSection: backupSection,
    passphraseSection: passphraseSection
  });

  var styles = elem.querySelector('link');
  styles.href = chrome.runtime.getURL('setup_styles.css');
  goog.dom.getElement('welcome-byline').textContent =
      chrome.i18n.getMessage('welcomeBasicsLine1');

  // Start the setup wizard when the big button is clicked
  goog.dom.getElement('setup-button').onclick = goog.bind(function() {
    goog.style.setElementShown(goog.dom.getElement('setup-button'), false);
    this.showPage_('intro');
  }, this);

  // Render the "do you want to generate keys?" page
  var introDialog =
      new dialogs.Generic(chrome.i18n.getMessage('setupIntroText'),
                          goog.bind(function(result) {
                            if (typeof result === 'undefined') {
                              // User clicked "no"
                              this.showPage_('restore-key');
                            } else {
                              // Default action: generate a new key
                              this.showPage_('generate-key');
                            }
                          }, this),
                          dialogs.InputType.NONE, undefined,
                          chrome.i18n.getMessage('setupIntroYes'),
                          chrome.i18n.getMessage('setupIntroNo'),
                          'setup-intro-content',
                          chrome.i18n.getMessage('setupIntroHint'));
  this.addChild(introDialog, false);
  introDialog.render(goog.dom.getElement(
      constants.ElementId.WELCOME_CONTENT_INTRO));

  // Render the "keep your backup code safe" page
  this.getBackupPhrase_().addCallback(goog.bind(function(phrase) {
    var backupDialog =
        new dialogs.Generic(chrome.i18n.getMessage('setupBackupText'),
                            goog.bind(function(result) {
                              this.showPage_('set-passphrase');
                            }, this),
                            dialogs.InputType.NONE, undefined,
                            chrome.i18n.getMessage('setupBackupDone'), '',
                            'setup-backup-content', phrase);
    this.addChild(backupDialog, false);
    backupDialog.render(goog.dom.getElement(
        constants.ElementId.WELCOME_CONTENT_BACKUP));
  }, this));

  // Render the "set a keyring passphrase" page
  var passphraseDialog = new ui.panels.KeyringMgmtMini(
    goog.nullFunction, goog.nullFunction,
    this.updateKeyringPassphrase_, goog.nullFunction,
    goog.bind(this.showPage_, this, 'tutorial'),
    chrome.i18n.getMessage('setupPassphraseText'),
    chrome.i18n.getMessage('setupSkip'));
  this.addChild(passphraseDialog, false);
  passphraseDialog.render(goog.dom.getElement(
      constants.ElementId.WELCOME_CONTENT_PASSPHRASE));

  // Render the genkey page
  this.genKeyForm_ = new ui.panels.GenerateKey(
      goog.bind(this.generateKey_, this), true);
  this.addChild(this.genKeyForm_, false);
  this.genKeyForm_.render(
      goog.dom.getElement(constants.ElementId.WELCOME_CONTENT_NOVICE));

  // Render the restore key page
  this.keyringMgmt_ = new ui.panels.KeyringMgmtMini(
      goog.nullFunction,
      goog.bind(this.importKeyring_, this),
      goog.nullFunction,
      goog.bind(this.afterRestoreKeyring_, this),
      goog.bind(this.showPage_, this, 'intro'),
      chrome.i18n.getMessage('setupRestoreText'));
  this.addChild(this.keyringMgmt_, false);
  this.keyringMgmt_.render(
      goog.dom.getElement(constants.ElementId.WELCOME_CONTENT_ADVANCED));
};


/**
 * Show the next page of the setup wizard
 * @param {string} id The element ID of the page to show
 * @private
 */
ui.Setup.prototype.showPage_ = function(id) {
  var pages = this.getElementsByClass('setup-page');
  goog.array.forEach(pages, function(page) {
    page.style.display = 'none';
  });
  goog.dom.getElement(id).style.display = 'block';
};


/**
 * Generates a new PGP key using the information that is provided by the user.
 * @param {ui.panels.GenerateKey} panel The panel where the user has provided
 *     the information for the new key.
 * @param {string} name The name to use.
 * @param {string} email The email to use.
 * @param {string} comments The comments to use.
 * @param {number} expDate The expiration date to use.
 * @private
 */
ui.Setup.prototype.generateKey_ =
    function(panel, name, email, comments, expDate) {
  var normalizedEmail = utils.text.extractValidYahooEmail(email);
  if (!normalizedEmail) {
    alert(chrome.i18n.getMessage('invalidEmailWarning'));
    return null;
  }
  var defaults = constants.KEY_DEFAULTS;
  utils.action.getContext(
      /** @type {!function(!e2e.openpgp.ContextImpl)} */ (function(pgpCtx) {
        pgpCtx.generateKey(e2e.signer.Algorithm[defaults.keyAlgo],
            defaults.keyLength, e2e.cipher.Algorithm[defaults.subkeyAlgo],
            defaults.subkeyLength, name, comments, email, expDate).
            addCallback(goog.bind(function(key) {
              //panel.sendKeys(key, goog.bind(function(response) {
                this.showPage_('backup-key');
              // }, this), pgpCtx);
            }, this));
      }), this.displayFailure_, this);
  this.keyringMgmt_.refreshOptions(true);
};


/**
 * Imports a keyring from a file and appends it to the current keyring.
 * @param {!File} file The file to import.
 * @private
 */
ui.Setup.prototype.importKeyring_ = function(file) {
  utils.readFile(file, goog.bind(function(contents) {
    this.actionExecutor_.execute(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.IMPORT_KEY,
      content: contents,
      passphraseCallback: goog.bind(this.renderPassphraseCallback_, this)
    }), this, goog.bind(function(res) {
      var dialog = new dialogs.Generic(
          chrome.i18n.getMessage('welcomeKeyImport'),
          this.hideKeyringSetup_,
          dialogs.InputType.NONE);
      this.removeChild(this.keyringMgmt_, false);
      this.addChild(dialog, false);
      dialog.decorate(this.keyringMgmt_.getElement());
    }, this));
  }, this));
};


/**
 * Updates the passphrase to the existing keyring.
 * @param {string} passphrase The new passphrase to apply.
 * @private
 */
ui.Setup.prototype.updateKeyringPassphrase_ = function(passphrase) {
  utils.action.getContext(
      /** @type {!function(!e2e.openpgp.ContextImpl)} */ (function(pgpCtx) {
        pgpCtx.changeKeyRingPassphrase(passphrase);

        var dialog = new dialogs.Generic(
            chrome.i18n.getMessage('keyMgmtChangePassphraseSuccessMsg'),
            goog.bind(function() {
              this.removeChild(dialog, false);
              this.keyringMgmt_ = new ui.panels.KeyringMgmtMini(
                  goog.nullFunction,
                  goog.bind(this.importKeyring_, this),
                  goog.bind(this.updateKeyringPassphrase_, this));
              this.addChild(this.keyringMgmt_, false);
              this.keyringMgmt_.decorate(dialog.getElement());
              this.keyringMgmt_.setKeyringEncrypted(
                  pgpCtx.isKeyRingEncrypted());
            }, this),
            dialogs.InputType.NONE);
        this.removeChild(this.keyringMgmt_, false);
        this.addChild(dialog, false);
        dialog.decorate(this.keyringMgmt_.getElement());
      }), this.displayFailure_, this);
};


/**
 * Renders the UI elements needed for requesting the passphrase of an individual
 * PGP key.
 * @param {string} uid The UID of the PGP key.
 * @param {!function(string)} callback The callback to invoke when the
 *     passphrase has been provided.
 * @private
 */
ui.Setup.prototype.renderPassphraseCallback_ = function(uid, callback) {
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  var dialog = new dialogs.Generic(chrome.i18n.getMessage(
      'promptPassphraseCallbackMessage', uid),
      function(passphrase) {
        goog.dispose(dialog);
        callback(/** @type {string} */ (passphrase));
      },
      // Use a password field to ask for the passphrase.
      dialogs.InputType.SECURE_TEXT,
      '',
      chrome.i18n.getMessage('actionEnterPassphrase'),
      chrome.i18n.getMessage('actionCancelPgpAction'));

  this.addChild(dialog, false);
  dialog.render(popupElem);
};


/**
 * Hides the UI for setting up the keyring.
 * @private
 */
ui.Setup.prototype.hideKeyringSetup_ = function() {
  var elements = [
    goog.dom.getElement(constants.ElementId.WELCOME_MENU_NOVICE),
    goog.dom.getElement(constants.ElementId.WELCOME_MENU_ADVANCED)
  ];

  goog.array.forEach(elements, function(elem) {
    elem.parentElement.removeChild(elem);
  });
};


/**
 * Called after a keyring is successfully restored from a backup code.
 * @private
 */
ui.Setup.prototype.afterRestoreKeyring_ = function(uid) {
  // TODO: Show a more informative notification here
  var dialog = new dialogs.Generic(
      chrome.i18n.getMessage('welcomeKeyRestore', uid),
      this.hideKeyringSetup_,
      dialogs.InputType.NONE);
  this.removeChild(this.keyringMgmt_, false);
  this.addChild(dialog, false);
  dialog.decorate(this.keyringMgmt_.getElement());
};


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.Setup.prototype.displayFailure_ = function(error) {
  var errorMsg = goog.isDef(error.messageId) ?
      chrome.i18n.getMessage(error.messageId) : error.message;
  utils.errorHandler(error);
  window.alert(errorMsg);
};


/**
 * Returns the backup code to display in the UI as a series of words.
 * @private
 * @return {e2e.async.Result.<string>} Words to display
 */
ui.Setup.prototype.getBackupPhrase_ = function() {
  var result = new e2e.async.Result();
  new e2e.ext.actions.Executor().execute(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.GET_KEYRING_BACKUP_DATA
  }), this, /** @param {e2e.openpgp.KeyringBackupInfo} data */ function(data) {
    // Passphrase is a string of N words followed by the count
    result.callback([e2e.ext.utils.passphrase.bytesToPhrase(data.seed),
                     data.count / 2 & 0x7F].join(' '));
  });
  return result;
};

});  // goog.scope

// Create the welcome page.
if (Boolean(chrome.extension)) {
  var welcomePage = new e2e.ext.ui.Setup();
  welcomePage.decorate(document.documentElement);
}
