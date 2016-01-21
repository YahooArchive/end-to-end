// Copyright 2015 Yahoo Inc. All rights reserved.
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
 * @fileoverview Similar to panels/prompt/encryptsign.js, but operates as a
 * content script instead of in the main process.
 */

goog.provide('e2e.ext.ui.ComposeGlass');

goog.require('e2e.async.Result');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.panels.Chip');
goog.require('e2e.ext.ui.panels.ChipHolder');
goog.require('e2e.ext.ui.panels.prompt.PanelBase');
goog.require('e2e.ext.ui.templates.composeglass');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Promise');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.object');
goog.require('goog.string');
goog.require('goog.string.format');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var ext = e2e.ext;
var messages = e2e.ext.messages;
var panels = e2e.ext.ui.panels;
var templates = e2e.ext.ui.templates.composeglass;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;
var dialogs = e2e.ext.ui.dialogs;



/**
 * Constructor for the UI compose glass. //@yahoo
 * @param {!messages.e2ebindDraft} draft Message draft
 * @param {string} origin The origin that requested the compose glass
 * @param {string} hash Hash to uniquely identify this compose glass instance
 * @constructor
 * @extends {e2e.ext.ui.panels.prompt.PanelBase}
 */
ui.ComposeGlass = function(draft, origin, hash) {
  var content = /** @type {!messages.BridgeMessageRequest} */ ({
    selection: draft.body,
    recipients: draft.to.concat(draft.cc || []).concat(draft.bcc || []),
    action: constants.Actions.ENCRYPT_SIGN,
    request: true,
    origin: origin,
    subject: draft.subject || '',
    canInject: false,
    canSaveDraft: false
  });

  this.errorCallback_ = goog.bind(this.displayFailure_, this);

  goog.base(this, chrome.i18n.getMessage('promptEncryptSignTitle'),
      content, this.errorCallback_);

  /**
   * A holder for the intended recipients of a PGP message.
   * @type {panels.ChipHolder}
   * @private
   */
  this.chipHolder_ = null;

  /**
   * Hash to uniquely identify this compose glass instance.
   * @type {string}
   * @private
   */
  this.hash_ = hash;

  /**
   * The email of the sender
   * @type {string}
   * @private
   */
  this.from_ = draft.from ? draft.from.toLowerCase() : '';
};
goog.inherits(ui.ComposeGlass, e2e.ext.ui.panels.prompt.PanelBase);


/** @override */
ui.ComposeGlass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);
  var content = this.getContent();

  // @yahoo renders the HTML
  soy.renderElement(elem, templates.main, {
    pageTitle: chrome.i18n.getMessage('promptEncryptSignTitle')
  });
  var styles = elem.querySelector('link');
  styles.href = chrome.runtime.getURL('composeglass_styles.css');

  // @yahoo renders the body
  elem = goog.dom.getElement(constants.ElementId.BODY);
  // @yahoo
  soy.renderElement(elem, templates.renderEncrypt, {
    signerCheckboxTitle: chrome.i18n.getMessage('promptSignMessageAs'),
    fromLabel: chrome.i18n.getMessage('promptFromLabel'),
    actionButtonTitle: chrome.i18n.getMessage(
        'promptEncryptSignActionLabel'),
    backButtonTitle: chrome.i18n.getMessage('actionBackToMenu'),
    subject: content.subject,
    subjectLabel: chrome.i18n.getMessage('promptSubjectLabel')
  });


  // @yahoo This tells the helper to attach the set_draft handler in e2ebind
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.GET_SELECTED_CONTENT
  }));
};


/**
 * Checks if the web application in given origin supports sending the message to
 * recipients.
 * @param {string} origin The origin of the web application.
 * @return {boolean} True if the message can be sent.
 * @private
 */
ui.ComposeGlass.prototype.canSend_ = function(origin) {
  // return false;
  // @yahoo can send using ymail
  return utils.text.isYmailOrigin(origin);
};


/**
 * Populates the UI elements with the received data.
 * @private
 */
ui.ComposeGlass.prototype.populateUi_ = function() {
  goog.Promise.all([
    // Populate the UI with the available encryption keys.
    this.renderEncryptionKeys_(),
    // Populate the UI with the available signing keys.
    this.renderSigningKeys_(),
    // Load selected content.
    this.loadSelectedContent_()
  ]).then(
      // When all of the above steps completed, set up focus.
      this.focusRelevantElement_, undefined, this);
};


/** @override */
ui.ComposeGlass.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');
  // var origin = this.getContent().origin;

  this.populateUi_();

  //@yahoo checks for key missing before calling EncryptSign
  this.getHandler().listen(
      this.getElementByClass(constants.CssClass.ACTION),
      goog.events.EventType.CLICK,
      goog.bind(this.keyMissingWarningThenEncryptSign_, this));

  //@yahoo canSaveDraft is false, as we lack the button
  // if (this.getContent().canSaveDraft) {
  //   this.getHandler().listen(
  //       this.getElementByClass(constants.CssClass.SAVE),
  //       goog.events.EventType.CLICK, goog.partial(this.saveDraft_, origin,
  //           false));
  // }
  //@yahoo canInject is false, as we lack the button
  // if (this.getContent().canInject) {
  //   this.getHandler().listen(
  //       this.getElementByClass(constants.CssClass.INSERT),
  //       goog.events.EventType.CLICK,
  //       goog.partial(this.insertMessageIntoPage_, origin));
  // }

  //@yahoo used a back button
  this.getHandler().listen(
      this.getElementByClass(constants.CssClass.BACK),
      goog.events.EventType.CLICK,
      goog.bind(function() {
        if (window.confirm(
            chrome.i18n.getMessage('composeGlassConfirmBack'))) {
          this.close();
        }
      }, this));
};


/**
 * Renders the available encryption keys in the UI.
 * @return {!goog.Promise} Promise resolved when the encryption keys have
 *     been successfully rendered. It's never rejected.
 * @private
 */
ui.ComposeGlass.prototype.renderEncryptionKeys_ = function() {
  return new goog.Promise(function(resolve, reject) {
    // @yahoo sendExtensionRequest is used instead of actionExecutor
    utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.LIST_KEYS,
      content: 'public'
    }), goog.bind(function(response) {
      var searchResult = response.content;

      var providedRecipients = this.getContent().recipients || [];
      var intendedRecipients = [];
      var allAvailableRecipients = goog.object.getKeys(searchResult);
      var recipientsEmailMap =
          this.getRecipientsEmailMap_(allAvailableRecipients);
      // @yahoo sends everyone to chipHolder, even though they may lack keys
      intendedRecipients = providedRecipients;
      // goog.array.forEach(providedRecipients, function(recipient) {
      //   if (recipientsEmailMap.hasOwnProperty(recipient)) {
      //     goog.array.extend(intendedRecipients,
      //       recipientsEmailMap[recipient]);
      //   }
      // });
      this.chipHolder_ = new panels.ChipHolder(
          intendedRecipients, allAvailableRecipients,
          goog.bind(this.renderEncryptionPassphraseDialog_, this),
          // @yahoo enhanced ChipHolder with dynamic validation
          goog.bind(this.hasUnsupportedRecipients_, this));
      this.addChild(this.chipHolder_, false);
      this.chipHolder_.decorate(
          goog.dom.getElement(constants.ElementId.CHIP_HOLDER));
      resolve();
    }, this), goog.bind(function(error) {
      this.chipHolder_ = new panels.ChipHolder([], [],
          goog.bind(this.renderEncryptionPassphraseDialog_, this),
          // @yahoo enhanced ChipHolder with dynamic validation
          goog.bind(this.hasUnsupportedRecipients_, this));
      this.addChild(this.chipHolder_, false);
      this.chipHolder_.decorate(
          goog.dom.getElement(constants.ElementId.CHIP_HOLDER));
      this.errorCallback_(error);
      resolve();
    }, this));
  }, this);
};


/**
 * Renders the available signing keys in the UI.
 * @return {!goog.Promise} Promise resolved when the signing keys have
 *     been successfully rendered. It's never rejected.
 * @private
 */
ui.ComposeGlass.prototype.renderSigningKeys_ = function() {
  return new goog.Promise(function(resolve, reject) {
    // @yahoo sendExtensionRequest is used instead of actionExecutor
    utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.LIST_KEYS,
      content: 'private'
    }), goog.bind(function(response) {
      var privateKeyResult = response.content;
      var availableSigningKeys = goog.object.getKeys(privateKeyResult);
      var signerSelect = goog.dom.getElement(constants.ElementId.SIGNER_SELECT);
      var signCheck = goog.dom.getElement(
          constants.ElementId.SIGN_MESSAGE_CHECK);

      if (availableSigningKeys.length == 0) {
        signCheck.disabled = true;
        signerSelect.disabled = true;
        var noKeysLabel = document.createTextNode(
            chrome.i18n.getMessage('promptNoPrivateKeysFound'));
        var fromHolder = goog.dom.getElement(constants.ElementId.FROM_HOLDER);
        fromHolder.appendChild(noKeysLabel);
      } else {
        signCheck.checked = true;
      }

      // @yahoo Set the Signer/Sender field with the correct uid
      var selectedIndex = 0;
      goog.array.forEach(availableSigningKeys, function(key, i) {
        var keyElem = document.createElement('option');
        keyElem.textContent = key;
        signerSelect.appendChild(keyElem);

        // @yahoo choose the first UID associated with the 'from' address
        if (this.from_ && selectedIndex == 0 &&
            goog.string.contains(key.toLowerCase(), this.from)) {
          selectedIndex = i;
          keyElem.selected = 'selected';
        }
      });
      resolve();
    }, this), goog.bind(function(error) {
      this.errorCallback_(error);
      resolve();
    }, this));
  }, this);
};


/**
 * Puts the focus on the chip holder (if no user chips are present) or the
 * textarea.
 * @private
 */
ui.ComposeGlass.prototype.focusRelevantElement_ = function() {
  if (!this.getElement()) {
    return;
  }
  var textArea = /** @type {HTMLTextAreaElement} */
      (this.getElement().querySelector('textarea'));
  textArea.scrollTop = 0;
  textArea.setSelectionRange(0, 0);
  this.chipHolder_.focus();

  // @yahoo adds textarea focus check
  textArea.onfocus = goog.bind(function() {
    this.clearFailure_();
    // Turn the extension icon into green when the secure text area is in focus
    utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
      action: constants.Actions.CHANGE_PAGEACTION
    }));
  }, this);
  textArea.onblur = goog.bind(function() {
    utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
      action: constants.Actions.RESET_PAGEACTION
    }));
  }, this);
  // @yahoo sets textarea height
  if (window) {
    var reposition = function() {
      var height = window.innerHeight - 140;
      textArea.style.height = height > 50 ? height + 'px' : '50px';
    };
    goog.events.listen(window, goog.events.EventType.RESIZE, reposition);
    reposition();
  }

  if (this.chipHolder_.hasChildren()) {
    // Double focus() workarounds a bug that prevents the caret from being
    // displayed in Chrome if setSelectionRange() is used.
    textArea.focus();
  }
};


/**
 * Extracts user addresses from user IDs and creates an email to user IDs map.
 * Ignores user IDs without a valid e-mail address.
 * @param  {!Array.<string>} recipients user IDs of recipients
 * @return {!Object.<string, !Array.<string>>} email to user IDs map
 * @private
 */
ui.ComposeGlass.prototype.getRecipientsEmailMap_ =
    function(recipients) {
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
 * Renders the UI elements needed for requesting a passphrase for symmetrically
 * encrypting the current message.
 * @private
 */
ui.ComposeGlass.prototype.renderEncryptionPassphraseDialog_ =
    function() {
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
  this.renderDialog(passphraseDialog);
};


/**
 * Renders the UI elements needed for requesting a passphrase for symmetrically
 * encrypting the current message.
 * @param {string} passphrase The original passphrase
 * @private
 */
ui.ComposeGlass.prototype.renderEncryptionPassphraseConfirmDialog_ =
    function(passphrase) {
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
          this.renderDialog(errorDialog);
        }
      }, this),
      dialogs.InputType.SECURE_TEXT,
      '',
      chrome.i18n.getMessage('actionEnterPassphrase'),
      chrome.i18n.getMessage('actionCancelPgpAction'));
  this.renderDialog(confirmDialog);
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
 * Executes the ENCRYPT_SIGN action.
 * @private
 */
ui.ComposeGlass.prototype.encryptSign_ = function() {
  var textArea = /** @type {HTMLTextAreaElement} */
      (this.getElement().querySelector('textarea'));
  var origin = this.getContent().origin;
  var request = /** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.ENCRYPT_SIGN,
    content: textArea.value,
    currentUser: goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value
  });

  if (this.chipHolder_) {
    request.recipients = this.chipHolder_.getSelectedUids();
    request.encryptPassphrases = this.chipHolder_.getProvidedPassphrases();
  }

  var signerCheck = goog.dom.getElement(constants.ElementId.SIGN_MESSAGE_CHECK);
  request.signMessage = signerCheck && signerCheck.checked;

  // @yahoo sendExtensionRequest is used instead of actionExecutor
  utils.sendExtensionRequest(request, goog.bind(function(response) {
    var encrypted = response.content;

    textArea.disabled = true;
    textArea.value = encrypted;
    this.chipHolder_.lock();
    var signCheckbox = goog.dom.getElement(
        constants.ElementId.SIGN_MESSAGE_CHECK);
    signCheckbox.disabled = true;

    // @yahoo doesn't require another click on insert to send the content
    // this.renderDismiss();
    // var insertButton = this.getElementByClass(constants.CssClass.INSERT);
    // if (insertButton) {
    //   goog.dom.classlist.remove(insertButton, constants.CssClass.HIDDEN);
    // }

    // @yahoo proceed injecting the content
    this.insertMessageIntoPage_(origin, encrypted);


  }, this), goog.bind(this.displayFailure_, this));
};


/**
 * Loads the content that the user has selected in the web application.
 * @return {!goog.Promise} Promise resolved when content has been loaded.
 *     It's never rejected.
 * @private
 */
ui.ComposeGlass.prototype.loadSelectedContent_ = function() {
  return new goog.Promise(function(resolve, reject) {
    var origin = this.getContent().origin;
    var textArea = /** @type {HTMLTextAreaElement} */
        (this.getElement().querySelector('textarea'));
    var content = this.getContent().selection || '';
    var detectedAction = utils.text.getPgpAction(content);
    if (detectedAction == constants.Actions.DECRYPT_VERIFY) {
      // @yahoo sendExtensionRequest is used instead of actionExecutor
      utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
        action: constants.Actions.DECRYPT_VERIFY,
        content: content
        // @yahoo no passphrase dialog can be hooked inside compose glass
        // passphraseCallback: goog.bind(this.renderPassphraseDialog, this)
      }), goog.bind(function(response) {
        var decrypted = response.content || '';

        if (e2e.openpgp.asciiArmor.isDraft(content)) {
          textArea.value = decrypted;
        } else {
          this.renderReply_(textArea, decrypted);
        }
        resolve();
      }, this), goog.bind(function(error) {
        this.errorCallback_(error);
        resolve();
      }, this));
    } else {
      resolve();
    }
  }, this);
};


/**
 * Inserts the encrypted content into the page and sends it.
 * //@yahoo added opt_encrypted to override the text to be inserted
 * @param {string} origin The web origin for which the PGP action is performed.
 * @param {string=} opt_encrypted The encrypted text to insert into the page.
 * @private
 */
ui.ComposeGlass.prototype.insertMessageIntoPage_ = function(origin,
    opt_encrypted) {
  var textArea = this.getElement().querySelector('textarea');
  var recipients = this.chipHolder_.getSelectedUids();
  var subject = goog.dom.getElement(constants.ElementId.SUBJECT) ?
      goog.dom.getElement(constants.ElementId.SUBJECT).value : undefined;
  // @yahoo not using prompt here
  // var prompt = /** @type {e2e.ext.ui.Prompt} */ (this.getParent());
  var shouldSend = false;
  var content = this.getContent();
  if (content && this.canSend_(content.origin)) {
    shouldSend = true;
  }

  // @yahoo used sendProxyRequest instead of HelperProxy.updateSelectedContent
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: shouldSend ?
        constants.Actions.SET_AND_SEND_DRAFT :
        constants.Actions.SET_DRAFT,
    content: /** @type {messages.BridgeMessageResponse} */ ({
      // @yahoo override the text to insert if opt_encrypted is provided
      value: opt_encrypted || textArea.value || content.value,
      response: true,
      detach: true,
      origin: origin,
      recipients: recipients,
      subject: subject,
      from: goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value
    })
  }));
  // @yahoo close the compose glass
  this.close();
};


// @yahoo the following are all yahoo-specific


/**
 * Return who lacks a public key for the recipients
 * @param {!Array.<string>} recipients an recipient or a list of
 *     recipients
 * @return {!e2e.async.Result.<!Array.<string>>}
 * @private
 */
ui.ComposeGlass.prototype.lackPublicKeys_ = function(recipients) {
  var result = new e2e.async.Result;

  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: constants.Actions.GET_ALL_KEYS_BY_EMAILS,
    recipients: recipients,
    content: 'public_exist'
  }), function(response) {
    var hasKeysPerRecipient = response.content;
    result.callback(goog.array.filter(recipients, function(recipient, i) {
      return !hasKeysPerRecipient[i];
    }));
  }, result.errback);

  return result;
};


/**
 * Return if any of the recipients lacks a public key
 * @param {string|!Array.<string>} recipients an recipient or a list of
 *     recipients
 * @return {!e2e.async.Result.<!boolean>}
 * @private
 */
ui.ComposeGlass.prototype.hasUnsupportedRecipients_ = function(recipients) {
  if (typeof recipients === 'string') {
    recipients = [recipients];
  } else if (recipients.length === 0) {
    return e2e.async.Result.toResult(false);
  }

  var result = new e2e.async.Result;
  this.lackPublicKeys_(recipients).addCallbacks(function(invalidOnes) {
    result.callback(invalidOnes.length > 0);
  }, this.displayFailure_, this);
  return result;
};


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.ComposeGlass.prototype.displayFailure_ = function(error) {
  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  if (error) {
    var errorMsg = goog.isDef(error.messageId) ?
        chrome.i18n.getMessage(error.messageId) : error.message;
    utils.errorHandler(error);
    errorDiv.textContent = errorMsg;
  } else {
    errorDiv.textContent = '';
  }
};


/**
 * Clears the error message notfication area.
 * @private
 */
ui.ComposeGlass.prototype.clearFailure_ = function() {
  this.displayFailure_(null);
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
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.GLASS_CLOSED,
    content: this.hash_
  }));
};


/**
 * Pops a warning if there does not have a session passphrase, or if any of the
 * recipients does not have a public key. If no problem, call encryptSign_
 * @private
 */
ui.ComposeGlass.prototype.keyMissingWarningThenEncryptSign_ = function() {
  // given no chipholder or there exists a session passphrase
  if (!this.chipHolder_ ||
      this.chipHolder_.getProvidedPassphrases().length > 0) {
    this.encryptSign_();
    return;
  }

  // @yahoo ask to remove invalid recipients or send unencrypted msg
  this.lackPublicKeys_(this.chipHolder_.getSelectedUids()).
      addCallbacks(function(invalidRecipients) {
        if (invalidRecipients.length === 0) {
          this.encryptSign_();
        } else {
          // Show dialog asking user to remove recipients without keys
          var message = goog.array.concat(
              chrome.i18n.getMessage('composeGlassConfirmRecipients'),
              invalidRecipients).join('\n');

          var dialog = new ui.dialogs.Generic(message, goog.bind(
          function(result) {
            // close the warning
            goog.dispose(dialog);
            goog.dom.classlist.remove(this.getElement(),
                                      constants.CssClass.UNCLICKABLE);
            // User clicked ok to 'send unencrypted message'
            if (typeof result !== 'undefined') {

              // disable signing the message
              var signerCheck = goog.dom.getElement(
                      constants.ElementId.SIGN_MESSAGE_CHECK);
              signerCheck && (signerCheck.checked = 'checked');

              this.insertMessageIntoPage_(this.getContent().origin);
            }
            // User clicked 'provide a passphrase'
            else {
              this.renderEncryptionPassphraseDialog_();
            }
          }, this), ui.dialogs.InputType.NONE, undefined,
          chrome.i18n.getMessage('composeGlassSendUnencryptedMessage'),
          chrome.i18n.getMessage('promptEncryptionPassphraseLink'));

          this.renderDialog(dialog);

          // Set the background element to be unclickable.
          goog.dom.classlist.add(this.getElement(),
          constants.CssClass.UNCLICKABLE);
        }
      }, this.displayFailure_, this);
};

});  // goog.scope
