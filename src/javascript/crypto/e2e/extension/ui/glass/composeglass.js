// Copyright 2013 Yahoo Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Similar to prompt.js, but operates as a content script instead
 * of in the main process.
 */

goog.provide('e2e.ext.ui.ComposeGlass');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.draftmanagerAsync');
goog.require('e2e.ext.ui.panels.Chip');
goog.require('e2e.ext.ui.panels.ChipHolder');
goog.require('e2e.ext.ui.templates.composeglass');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Timer');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events.EventType');
goog.require('goog.object');
goog.require('goog.string');
goog.require('goog.string.format');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var dialogs = e2e.ext.ui.dialogs;
var drafts = e2e.ext.ui.draftmanagerAsync;
var ext = e2e.ext;
var messages = e2e.ext.messages;
var panels = e2e.ext.ui.panels;
var templates = e2e.ext.ui.templates.composeglass;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;



/**
 * Constructor for the UI compose glass.
 * @param {!messages.e2ebindDraft} draft Message draft
 * @param {string} mode Either scroll mode or resize mode
 * @param {string} origin The origin that requested the compose glass
 * @param {string} hash Hash to uniquely identify this compose glass instance
 * @constructor
 * @extends {goog.ui.Component}
 */
ui.ComposeGlass = function(draft, mode, origin, hash) {
  goog.base(this);

  this.recipients = draft.to.concat(draft.cc).concat(draft.bcc);
  this.subject = draft.subject;
  this.selection = draft.body;
  this.origin = origin;
  this.mode = mode;
  this.hash = hash;
  this.from = draft.from;

  /**
   * A timer to automatically save drafts.
   * TODO(user): Optimize the frequency of which auto-save triggers as it will
   * cause additional CPU (and possibly network) utilization.
   * @type {!goog.Timer}
   * @private
   */
  this.autoSaveTimer_ = new goog.Timer(constants.AUTOSAVE_INTERVAL);
  this.registerDisposable(this.autoSaveTimer_);

  /**
   * Placeholder for calling out to preferences.js.
   * TODO: Switch preferences.js to chrome.storage.sync
   */
  this.preferences_ = {
    isActionSniffingEnabled: true,
    isAutoSaveEnabled: true
  };
};
goog.inherits(ui.ComposeGlass, goog.ui.Component);


/**
 * A holder for the intended recipients of a PGP message.
 * @type {panels.ChipHolder}
 * @private
 */
ui.ComposeGlass.prototype.chipHolder_ = null;


/** @override */
ui.ComposeGlass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  soy.renderElement(elem, templates.main, {
    extName: chrome.i18n.getMessage('extName')
  });

  var styles = elem.querySelector('link');
  styles.href = chrome.extension.getURL('composeglass_styles.css');

  // This tells the helper to attach the set_draft handler in e2ebind
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.GET_SELECTED_CONTENT
  }));
  this.processActiveContent_();
};


/**
 * Process the retrieved content blob and display it into the prompt UI.
 * @private
 */
ui.ComposeGlass.prototype.processActiveContent_ = function() {
  this.clearFailure_();
  this.autoSaveTimer_.stop();
  var action = constants.Actions.ENCRYPT_SIGN;
  var content = this.selection;
  var origin = this.origin;
  var recipients = this.recipients;
  var subject = this.subject;
  var from = this.from;

  this.getHandler().listen(
      this.autoSaveTimer_,
      goog.Timer.TICK,
      goog.partial(this.saveDraft_, origin));

  var elem = goog.dom.getElement(constants.ElementId.BODY);
  var title = goog.dom.getElement(constants.ElementId.TITLE);
  title.textContent = chrome.i18n.getMessage('promptEncryptSignTitle');
  goog.style.setElementShown(title, false);

  this.renderEncrypt_(elem, recipients, origin, subject, from, content);

  this.getHandler().listen(
      elem, goog.events.EventType.CLICK,
      goog.bind(this.buttonClick_, this, action, origin));
};


/**
 * Sets the provided content into the currently active page.
 * Note: This function might not work while debugging the extension.
 * @param {string} content The content to write inside the selected element.
 * @param {!Array.<string>} recipients The recipients of the message.
 * @param {string} subject Subject of the message
 * @param {!function(...)} callback The function to invoke once the message to
 *   update active content has been sent
 * @private
 */
ui.ComposeGlass.prototype.updateActiveContent_ =
    function(content, recipients, subject, callback) {
  var response = /** @type {messages.BridgeMessageResponse} */ ({
    value: content,
    response: true,
    detach: true,
    origin: this.origin,
    recipients: recipients,
    subject: subject
  });
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.SET_DRAFT,
    content: response
  }));
  callback();
};


/**
 * @param {constants.Actions} action
 * @param {string} origin
 * @param {Event} event
 * @private
 */
ui.ComposeGlass.prototype.buttonClick_ = function(
    action, origin, event) {
  var elem = goog.dom.getElement(constants.ElementId.BODY);
  var target = event.target;

  if (target instanceof HTMLImageElement) {
    target = target.parentElement;
  }

  if (target instanceof Element) {
    if (goog.dom.classlist.contains(target, constants.CssClass.CANCEL)) {
      this.close();
    } else if (
        goog.dom.classlist.contains(target, constants.CssClass.ACTION)) {
      this.executeAction_(action, elem, origin);
    } else if (
        // TODO(yan): make this go back to normal compose
        goog.dom.classlist.contains(target, constants.CssClass.BACK)) {
      this.close();
    }
  }
};


/**
 * Extracts user addresses from user IDs and creates an email to user IDs map.
 * Ignores user IDs without a valid e-mail address.
 * @param  {!Array.<string>} recipients user IDs of recipients
 * @return {!Object.<string, !Array.<string>>} email to user IDs map
 * @private
 */
ui.ComposeGlass.prototype.getRecipientsEmailMap_ = function(recipients) {
  var map = {};
  goog.array.forEach(recipients, function(recipient) {
    var email = utils.text.extractValidEmail(recipient);
    if (email) {
      if (!map.hasOwnProperty(email)) {
        map[email] = [];
      }
      map[email].push(recipient);
    }
  });
  return map;
};


/**
 * Renders the UI elements needed for PGP encryption.
 * @param {Element} elem The element into which the UI elements are to be
 *     rendered.
 * @param {!Array.<string>} recipients The initial list of identified
 *     recipients for the encrypted message.
 * @param {string} origin The web origin where the message was created.
 * @param {string} subject The subject of the message
 * @param {string} from Address that the message is from
 * @param {string} content Body of the message
 * @private
 */
ui.ComposeGlass.prototype.renderEncrypt_ =
    function(elem, recipients, origin, subject, from, content) {
  var intendedRecipients = [];

  var sniffedAction = utils.text.getPgpAction(
      content, this.preferences_.isActionSniffingEnabled);

  // Pre-populate the list of recipients during an encrypt/sign action.
  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.LIST_KEYS,
    content: 'public'
  }), goog.bind(function(response) {
    var searchResult = response.content;
    console.log('got LIST_KEYS public result', searchResult);
    var allAvailableRecipients = goog.object.getKeys(searchResult);
    var recipientsEmailMap = this.getRecipientsEmailMap_(
        allAvailableRecipients);
    goog.array.forEach(recipients, function(recipient) {
      if (recipientsEmailMap.hasOwnProperty(recipient)) {
        goog.array.extend(intendedRecipients,
            recipientsEmailMap[recipient]);
      }
    });

    utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.LIST_KEYS,
      content: 'private'
    }), goog.bind(function(response) {
      var privateKeyResult = response.content;
      console.log('got LIST_KEYS private result', privateKeyResult);
      var availableSigningKeys = goog.object.getKeys(privateKeyResult);
      var signInsertLabel = from ?
          chrome.i18n.getMessage('promptEncryptSignInsertIntoSupportedLabel') :
          chrome.i18n.getMessage('promptEncryptSignInsertLabel');

      soy.renderElement(elem, templates.renderEncrypt, {
        insertCheckboxEnabled: true,
        signerCheckboxTitle: chrome.i18n.getMessage('promptSignMessageAs'),
        fromLabel: chrome.i18n.getMessage('promptFromLabel'),
        noPrivateKeysFound: chrome.i18n.getMessage('promptNoPrivateKeysFound'),
        availableSigningKeys: availableSigningKeys,
        passphraseEncryptionLinkTitle: chrome.i18n.getMessage(
            'promptEncryptionPassphraseLink'),
        actionButtonTitle: chrome.i18n.getMessage(
            'promptEncryptSignActionLabel'),
        cancelButtonTitle: chrome.i18n.getMessage('actionCancelPgpAction'),
        backButtonTitle: chrome.i18n.getMessage('actionBackToMenu'),
        saveDraftButtonTitle: chrome.i18n.getMessage(
            'promptEncryptSignSaveDraftLabel'),
        insertButtonTitle: signInsertLabel,
        subject: subject
      });

      var textArea = /** @type {HTMLTextAreaElement} */
          (elem.querySelector('textarea'));

      // Show green icon in the URL bar when the secure text area is in focus
      // so page XSS attacks are less likely to compromise plaintext
      textArea.onfocus = function() {
        utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
          action: constants.Actions.CHANGE_PAGEACTION
        }));
      };
      textArea.onblur = function() {
        utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
          action: constants.Actions.RESET_PAGEACTION
        }));
      };

      textArea.value = content;

      if (sniffedAction == constants.Actions.DECRYPT_VERIFY) {
        console.log('got decrypt_verify');
        utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
          action: constants.Actions.DECRYPT_VERIFY,
          content: content
        }), goog.bind(function(response) {
          var decrypted = response.content || '';
          if (e2e.openpgp.asciiArmor.isDraft(content)) {
            console.log('renderEncrypt setting draft content');
            textArea.value = decrypted;
          } else {
            console.log('renderEncrypt setting reply content');
            this.renderReply_(textArea, decrypted);
          }
        }, this));
      } else {
        drafts.hasDraft(origin, goog.bind(function(result) {
          if (!result) {
            // No draft, abort early.
            return;
          }
          // Prompt user to restore draft
          var popupElem =
              goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
          var dialog = new dialogs.Generic(
              chrome.i18n.getMessage('promptEncryptSignRestoreDraftMsg'),
              goog.bind(function(dialogResult) {
                if (goog.isDef(dialogResult)) {
                  // A passed object signals that the user has clicked the
                  // 'OK' button.
                  drafts.getDraft(origin, function(response) {
                    var draft = response;
                    utils.sendExtensionRequest(
                        /** @type {!messages.ApiRequest} */ ({
                          action: constants.Actions.DECRYPT_VERIFY,
                          content: draft
                        }), goog.bind(function(response) {
                          var decrypted = response.content || '';
                          console.log('got DECRYPT_VERIFY result', decrypted);
                          textArea.value = decrypted;
                          this.surfaceDismissButton_();
                        }, this));
                  });
                } else {
                  drafts.clearDraft(origin);
                }

                goog.dispose(dialog);
              }, this),
              dialogs.InputType.NONE,
              '',
              chrome.i18n.getMessage('promptEncryptSignRestoreDraftLabel'),
              chrome.i18n.getMessage('promptEncryptSignDiscardDraftLabel'));
          this.addChild(dialog, false);
          dialog.render(popupElem);
        }, this));
      }

      this.getHandler().listen(
          goog.dom.getElement(constants.ElementId.PASSPHRASE_ENCRYPTION_LINK),
          goog.events.EventType.CLICK, this.renderEncryptionPassphraseDialog_);

      this.getHandler().listen(
          this.getElementByClass(constants.CssClass.SAVE),
          goog.events.EventType.CLICK, goog.partial(this.saveDraft_, origin));

      this.chipHolder_ = new panels.ChipHolder(
          intendedRecipients, allAvailableRecipients);
      this.addChild(this.chipHolder_, false);
      this.chipHolder_.decorate(
          goog.dom.getElement(constants.ElementId.CHIP_HOLDER));

      if (this.preferences_.isAutoSaveEnabled) {
        this.getHandler().listenOnce(textArea, goog.events.EventType.KEYDOWN,
            goog.bind(this.autoSaveTimer_.start, this.autoSaveTimer_));
      }
    }, this));
  }, this));
};


/**
 * Renders the UI elements needed for requesting a passphrase for symmetrically
 * encrypting the current message.
 * @private
 */
ui.ComposeGlass.prototype.renderEncryptionPassphraseDialog_ = function() {
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  var passphraseDialog = new dialogs.Generic(
      chrome.i18n.getMessage('promptEncryptionPassphraseMessage'),
      goog.bind(function(passphrase) {
        goog.dispose(passphraseDialog);
        if (passphrase.length > 0) {
          this.renderEncryptionPassphraseConfirmDialog_(passphrase);
        }
      }, this),
      dialogs.InputType.SECURE_TEXT,
      '',
      chrome.i18n.getMessage('actionEnterPassphrase'),
      chrome.i18n.getMessage('actionCancelPgpAction'));

  this.addChild(passphraseDialog, false);
  passphraseDialog.render(popupElem);
};


/**
 * Renders the UI elements needed for requesting a passphrase for symmetrically
 * encrypting the current message.
 * @param {string} passphrase The original passphrase
 * @private
 */
ui.ComposeGlass.prototype.renderEncryptionPassphraseConfirmDialog_ =
    function(passphrase) {
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  var confirmDialog = new dialogs.Generic(
      chrome.i18n.getMessage('promptEncryptionPassphraseConfirmMessage'),
      goog.bind(function(confirmedPassphrase) {
        goog.dispose(confirmDialog);
        if (passphrase == confirmedPassphrase) {
          var chip = new panels.Chip(passphrase, true);
          this.chipHolder_.addChip(chip);
        } else {
          var errorDialog = new dialogs.Generic(
              chrome.i18n.getMessage('keyMgmtPassphraseMismatchLabel'),
              function() {
                goog.dispose(errorDialog);
              },
              dialogs.InputType.NONE);
          this.addChild(errorDialog, false);
          errorDialog.render(popupElem);
        }
      }, this),
      dialogs.InputType.SECURE_TEXT,
      '',
      chrome.i18n.getMessage('actionEnterPassphrase'),
      chrome.i18n.getMessage('actionCancelPgpAction'));
  this.addChild(confirmDialog, false);
  confirmDialog.render(popupElem);
};


/**
 * Renders the original message to which the user wants to reply.
 * @param {HTMLTextAreaElement} textArea The text area where the reply body will
 *     be displayed.
 * @param {string} originalMsg The original message.
 * @private
 */
ui.ComposeGlass.prototype.renderReply_ = function(textArea, originalMsg) {
  var replyLineToken = '\n> ';
  var replyBody = utils.text.prettyTextWrap(
      originalMsg, (78 - replyLineToken.length));
  textArea.value = goog.string.format(
      '\n\n%s:\n%s',
      chrome.i18n.getMessage('promptEncryptSignReplyHeader'),
      replyLineToken + replyBody.split('\n').join(replyLineToken));
  textArea.setSelectionRange(0, 0);
};


/**
 * Closes the prompt.
 */
ui.ComposeGlass.prototype.close = function() {
  // Clear all input and text area fields to ensure that no data accidentally
  // leaks to the user.
  goog.array.forEach(
      document.querySelectorAll('textarea,input'), function(elem) {
        elem.value = '';
      });
  goog.dispose(this);
  console.log('compose glass sending glass_closed');
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.GLASS_CLOSED,
    content: this.hash
  }));
};


/**
 * Executes the PGP action and displays the result to the user.
 * @param {constants.Actions} action The PGP action that the user has
 *     requested.
 * @param {Element} elem The element with the textarea where the result of the
 *     action will be displayed.
 * @param {string} origin The web origin for which the PGP action is performed.
 * @private
 */
ui.ComposeGlass.prototype.executeAction_ = function(action, elem, origin) {
  var textArea = elem.querySelector('textarea');
  this.clearFailure_();
  switch (action) {
    case ext.constants.Actions.ENCRYPT_SIGN:
      var request = /** @type {!messages.ApiRequest} */ ({
        action: constants.Actions.ENCRYPT_SIGN,
        content: textArea.value,
        currentUser:
            goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value
      });

      if (this.chipHolder_) {
        request.recipients = this.chipHolder_.getSelectedUids();
        request.encryptPassphrases = this.chipHolder_.getProvidedPassphrases();
      }

      var signerCheck =
          goog.dom.getElement(constants.ElementId.SIGN_MESSAGE_CHECK);
      request.signMessage = signerCheck && signerCheck.checked;

      utils.sendExtensionRequest(
          request, goog.bind(function(result) {
            var encrypted = result.content || '';
            this.clearSavedDraft_(origin);
            this.insertMessageIntoPage_(origin, encrypted);
          }, this));
      break;
    case constants.Actions.DECRYPT_VERIFY:
      utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
        action: constants.Actions.DECRYPT_VERIFY,
        content: textArea.value
      }), goog.bind(function(result) {
        var decrypted = result.content || '';
        textArea.value = decrypted;
        var successMessage =
            chrome.i18n.getMessage('promptDecryptionSuccessMsg');
        this.displaySuccess_(successMessage, goog.nullFunction);
        this.surfaceDismissButton_();
      }, this));
      break;
  }
};


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.ComposeGlass.prototype.displayFailure_ = function(error) {
  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  var errorMsg = goog.isDef(error.messageId) ?
      chrome.i18n.getMessage(error.messageId) : error.message;
  utils.errorHandler(error);
  errorDiv.textContent = errorMsg;
};


/**
 * Clears the error message notfication area.
 * @private
 */
ui.ComposeGlass.prototype.clearFailure_ = function() {
  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  errorDiv.textContent = '';
};


/**
 * Notifies user of successful operation.
 * @param {string} msg The message to display
 * @param {!function(...)} callback function to invoke when notification has
 *   been displayed
 * @private
 */
ui.ComposeGlass.prototype.displaySuccess_ = function(msg, callback) {
  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: 'show_notification',
    content: msg}), callback);
};


/**
 * Surfaces the Dismiss button in the UI.
 * @private
 */
ui.ComposeGlass.prototype.surfaceDismissButton_ = function() {
  goog.array.forEach(
      this.getElement().querySelectorAll('button.action,button.save'),
      function(button) {
        goog.dom.classlist.add(button, constants.CssClass.HIDDEN);
      });

  var cancelButton = this.getElementByClass(constants.CssClass.CANCEL);
  if (cancelButton) {
    cancelButton.textContent =
        chrome.i18n.getMessage('promptDismissActionLabel');
  }
};


/**
 * Inserts the encrypted content into the page.
 * @param {string} origin The web origin for which the PGP action is performed.
 * @param {string} text The encrypted text to insert into the page.
 * @private
 */
ui.ComposeGlass.prototype.insertMessageIntoPage_ = function(origin, text) {
  var recipients = this.chipHolder_.getSelectedUids();
  var subject = this.getElement().querySelector('#subjectHolder input').value;
  this.updateActiveContent_(
      text, recipients, subject, goog.bind(this.close, this));
};


/**
 * Encrypts the current draft and persists it into the web app that the user is
 * interacting with.
 * @param {string} origin The web origin where the message was created.
 * @param {goog.events.Event} evt The event that triggers the saving of the
 *     draft.
 * @private
 */
ui.ComposeGlass.prototype.saveDraft_ = function(origin, evt) {
  var formText = this.getElement().querySelector('textarea');

  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.ENCRYPT_SIGN,
    content: formText.value,
    currentUser: goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value
  }), goog.bind(function(response) {
    var encrypted = response.content || '';
    var draft = e2e.openpgp.asciiArmor.markAsDraft(encrypted);
    if (evt.type == goog.events.EventType.CLICK) {
      this.updateActiveContent_(
          formText.value, this.recipients, '', goog.nullFunction);
    } else {
      drafts.saveDraft(draft, origin);
    }
  }, this));
};


/**
 * Clears the saved draft and disables auto-save.
 * @param {string} origin The origin for which the drafts are to be removed.
 * @private
 */
ui.ComposeGlass.prototype.clearSavedDraft_ = function(origin) {
  this.autoSaveTimer_.stop();
  drafts.clearDraft(origin);
};

});  // goog.scope
