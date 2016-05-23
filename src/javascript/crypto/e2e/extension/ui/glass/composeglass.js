// Copyright 2016 Yahoo Inc. All rights reserved.
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
goog.require('e2e.ext.MessageApi');
/** @suppress {extraRequire} intentional import */
goog.require('e2e.ext.YmailData'); //@yahoo
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
goog.require('e2e.ext.utils.Error');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Promise');
goog.require('goog.Timer'); //@yahoo
goog.require('goog.array');
goog.require('goog.async.Deferred');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');  //@yahoo
goog.require('goog.i18n.DateTimeFormat'); //@yahoo
goog.require('goog.object');
goog.require('goog.string');
goog.require('goog.string.format');
goog.require('goog.style');
goog.require('goog.userAgent'); //@yahoo
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
 * @param {string} origin The origin that requested the compose glass
 * @param {e2e.ext.MessageApi} api The Message API
 * @constructor
 * @extends {e2e.ext.ui.panels.prompt.PanelBase}
 */
ui.ComposeGlass = function(origin, api) {

  var content = /** @type {!messages.BridgeMessageRequest} */ ({
    selection: '',
    recipients: [],
    ccRecipients: [],
    action: constants.Actions.ENCRYPT_SIGN,
    request: true,
    origin: origin,
    canInject: true,
    canSaveDraft: true
  });

  this.errorCallback_ = goog.bind(this.displayFailure_, this);

  goog.base(this, '', content, this.errorCallback_);

  /**
   * The email of the sender
   * @type {?e2e.ext.YmailData.EmailUser}
   * @private
   */
  this.defaultSender_ = null;

  /**
   * A holder for the intended recipients of a PGP message.
   * @type {panels.ChipHolder}
   * @private
   */
  this.chipHolder_ = null;

  /**
   * A holder for the intended cc recipients of a PGP message.
   * @type {panels.ChipHolder}
   * @private
   */
  this.ccChipHolder_ = null;

  /**
   * The message API instance
   * @type {e2e.ext.MessageApi}
   * @private
   */
  this.api_ = api;
};
goog.inherits(ui.ComposeGlass, e2e.ext.ui.panels.prompt.PanelBase);


/** @override */
ui.ComposeGlass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  // @yahoo renders the HTML
  soy.renderElement(elem, templates.main, {
    signerCheckboxTitle: chrome.i18n.getMessage('promptSignMessageAs'),
    fromLabel: chrome.i18n.getMessage('promptFromLabel'),
    actionButtonTitle: chrome.i18n.getMessage(
        'promptEncryptSignActionLabel'),
    actionDraftDeleteTitle: chrome.i18n.getMessage(
        'actionDraftDeleteTitle'),
    subject: '',
    subjectLabel: chrome.i18n.getMessage('promptSubjectLabel'),
    loadingLabel: chrome.i18n.getMessage('promptLoadingLabel'),
    showOriginalLabel: chrome.i18n.getMessage('promptShowOriginalLabel'),
    unsupportedFormattingLabel: chrome.i18n.getMessage(
        'promptUnsupportedFormattingLabel'),
    encryptrMessage: chrome.i18n.getMessage('promptEncryptrBodyOnlyMessage')
  });
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
  //@yahoo defer getDraft() until populateUi() is called
  this.api_.req('draft.get').addCallbacks(function(draft) {
    var content = this.getContent();

    this.defaultSender_ = draft.from;
    content.recipients = goog.array.map(
        draft.to || [],
        utils.text.userObjectToUid);
    content.ccRecipients = goog.array.map(
        [].concat(draft.cc || [], draft.bcc || []),
        utils.text.userObjectToUid);
    content.selection = draft.body;

    // set event handlers based on whether the glass is in conversation
    this.setConversationDependentEventHandlers_(draft.isInConv);
    // display show original message, and install the click handler
    draft.hasQuoted && this.setQuotedTextHandlers_();

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

    // set subject
    var subj = goog.dom.getElement(constants.ElementId.SUBJECT);
    if (subj) {
      subj.value = draft.subject;
      this.forwardSubject_(/** @type {Event} */ ({target: subj}));
    }

  }, this.displayFailure_, this);
};


/** @override */
ui.ComposeGlass.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');
  var content = this.getContent();
  var origin = content.origin;
  var elem = this.getElement();

  this.editor_ = /** @type {!HTMLTextAreaElement} */ (
          elem.querySelector('textarea'));
  this.actionBar_ = this.getElementByClass(constants.CssClass.PROMPT_ACTIONS);

  this.populateUi_();

  //@yahoo checks for key missing before calling EncryptSign
  this.getHandler().listen(
      this.getElementByClass(constants.CssClass.ACTION),
      goog.events.EventType.CLICK,
      goog.bind(this.keyMissingWarningThenEncryptSign_, this));


  // @yahoo handle and forward keydown events
  goog.events.listen(document.documentElement, goog.events.EventType.KEYDOWN,
      goog.bind(this.handleKeyEvent_, this));
  // @yahoo forward focus events
  goog.events.listen(document.documentElement, goog.events.EventType.FOCUS,
      goog.bind(this.forwardEvent_, this, {type: 'focus'}));

  this.getHandler().
      // @yahoo update extension icon as green when the editor is in focus
      listen(this.editor_, goog.events.EventType.FOCUS, goog.bind(
          utils.sendExtensionRequest, null, {
            action: constants.Actions.CHANGE_PAGEACTION
          }, goog.nullFunction, this.errorCallback_)).
      // @yahoo update extension icon when the editor is in blur
      listen(this.editor_, goog.events.EventType.BLUR, goog.bind(
          utils.sendExtensionRequest, null, {
            action: constants.Actions.RESET_PAGEACTION
          }, goog.nullFunction, this.errorCallback_));

  //@yahoo resize the textarea when an input is received
  utils.listenThrottledEvent(/** @type {!EventTarget} */ (this.editor_),
      goog.events.EventType.INPUT,
      goog.bind(this.resizeEditor_, this, false));

  //@yahoo resize the textarea when window is resized
  utils.listenThrottledEvent(window, goog.events.EventType.RESIZE,
      goog.bind(this.resizeEditor_, this, true));

  // @yahoo default a click on nowhere to focus on the editor
  goog.events.listen(document.body, goog.events.EventType.CLICK,
      goog.bind(function(evt) {
        evt.stopPropagation();
        this.forwardEvent_({type: 'focus'});
      }, this));
  goog.events.listen(document.documentElement, goog.events.EventType.CLICK,
      goog.bind(function() {
        this.editor_.focus();
        this.forwardEvent_({type: 'focus'});
      }, this));

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

  this.saveDraftTimer_ = new goog.Timer(30000); //30s
  this.saveDraftTimer_.start();

  this.getHandler().
      //@yahoo periodically save the encrypted draft
      listen(
          this.saveDraftTimer_,
          goog.Timer.TICK,
          goog.partial(this.saveDraft_, origin, goog.nullFunction)).
      //@yahoo has a restore button
      listenOnce(
          goog.dom.getElement(
              constants.ElementId.ENCRYPTR_ICON).querySelector('label'),
          goog.events.EventType.CLICK,
          goog.bind(this.switchToUnencrypted_, this)).
      //@yahoo has a hidden add passphrase button
      listen(
          goog.dom.getElement(constants.ElementId.ADD_PASSPHRASE_BUTTON),
          goog.events.EventType.CLICK,
          goog.bind(function() {
            // close the keyMissingDialog if it's there
            if (this.keyMissingDialog_) {
              this.keyMissingDialog_.invokeCallback(true);
            }
            this.renderEncryptionPassphraseDialog_();
          }, this)).
      //@yahoo allows discarding the draft
      listen(
          goog.dom.getElement(constants.ElementId.DRAFT_DELETE_BUTTON),
          goog.events.EventType.CLICK,
          goog.bind(this.discard, this));


  //@yahoo save encrypted draft when it is closed externally
  this.api_.setRequestHandler('evt.close',
      goog.bind(this.saveDraft_, this, origin, goog.nullFunction, null));

  // clear prior failure when any item is on clicked
  this.getHandler().listen(
      this.getElement(),
      goog.events.EventType.CLICK,
      goog.bind(this.clearFailure_, this), true);
};


/**
 * Renders the available encryption keys in the UI. //@yahoo
 * @return {!goog.Promise} Promise resolved when the encryption keys have
 *     been successfully rendered. It's never rejected.
 * @private
 */
ui.ComposeGlass.prototype.renderEncryptionKeys_ = function() {
  return new goog.Promise(function(resolve, reject) {
    // var allAvailableRecipients = goog.object.getKeys(searchResult);
    // var recipientsEmailMap =
    //     this.getRecipientsEmailMap_(allAvailableRecipients);
    // goog.array.forEach(providedRecipients, function(recipient) {
    //   if (recipientsEmailMap.hasOwnProperty(recipient)) {
    //     goog.array.extend(intendedRecipients,
    //       recipientsEmailMap[recipient]);
    //   }
    // });
    this.chipHolder_ = new panels.ChipHolder(
        this.getContent().recipients,
        // @yahoo allAvailableRecipients made async with requestMatchingRows_()
        goog.bind(this.requestMatchingRows_, this),
        // @yahoo enhanced ChipHolder with dynamic validation
        goog.bind(this.hasPublicKeys_, this),
        // @yahoo determines whether there're any recipients
        goog.bind(this.hasRecipients_, this),
        goog.bind(this.renderEncryptionPassphraseDialog_, this));
    this.addChild(this.chipHolder_, false);
    this.chipHolder_.decorate(
        goog.dom.getElement(constants.ElementId.CHIP_HOLDER));

    // @yahoo added cc recipients
    this.ccChipHolder_ = new panels.ChipHolder(
        this.getContent().ccRecipients,
        // @yahoo allAvailableRecipients made async with requestMatchingRows_()
        goog.bind(this.requestMatchingRows_, this),
        // @yahoo enhanced ChipHolder with dynamic validation
        goog.bind(this.hasPublicKeys_, this),
        // @yahoo determines whether there're any recipients
        goog.bind(this.hasRecipients_, this),
        null);
    this.addChild(this.ccChipHolder_, false);
    this.ccChipHolder_.decorate(
        goog.dom.getElement(constants.ElementId.CC_CHIP_HOLDER));
    resolve();
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
    }), goog.bind(function(privateKeyResult) {
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
      var selectedIndex = 0, senderMatched = false;
      goog.array.forEach(availableSigningKeys, function(key, i) {
        var keyElem = document.createElement('option');
        keyElem.textContent = key;
        signerSelect.appendChild(keyElem);

        // @yahoo choose the first UID associated with the 'from' address
        if (this.defaultSender_ && selectedIndex == 0 &&
            goog.string.caseInsensitiveContains(
                key, '<' + this.defaultSender_.email + '>')) {
          selectedIndex = i;
          keyElem.selected = 'selected';
          senderMatched = true;
        }
      }, this);

      // @yahoo display sender selection if there's a choice,
      //        or it's different from the mail default
      if (availableSigningKeys.length > 1 || !senderMatched) {
        goog.style.setElementShown(
            goog.dom.getElement(constants.ElementId.FROM_HOLDER),
            true);
      }

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

  var textArea = this.editor_;

  textArea.style.minHeight = '70px';
  // @yahoo trigger textarea and glass resize
  this.resizeEditor_(true);

  textArea.scrollTop = 0;
  textArea.setSelectionRange(0, 0);

  // @yahoo added ccChipHolder
  if (this.chipHolder_.hasChildren() || this.ccChipHolder_.hasChildren()) {
    // Double focus() workarounds a bug that prevents the caret from being
    // displayed in Chrome if setSelectionRange() is used.
    textArea.focus();
  } else {
    this.chipHolder_.focus();
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

  // @yahoo added ccChipHolder
  if (this.ccChipHolder_ && this.ccChipHolder_.hasChildren()) {
    request.recipients = request.recipients.concat(
        this.ccChipHolder_.getSelectedUids());
  }

  var signerCheck = goog.dom.getElement(constants.ElementId.SIGN_MESSAGE_CHECK);
  request.signMessage = signerCheck && signerCheck.checked;

  // @yahoo sendExtensionRequest is used instead of actionExecutor
  utils.sendExtensionRequest(request, goog.bind(function(encrypted) {
    textArea.disabled = true;
    textArea.value = encrypted;
    this.chipHolder_.lock();
    // @yahoo added ccChipHolder
    this.ccChipHolder_.lock();
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
    this.insertMessageIntoPage_(origin);

  }, this), this.errorCallback_);
};


/**
 * Loads the content that the user has selected in the web application.
 * @return {!goog.Promise} Promise resolved when content has been loaded.
 *     It's never rejected.
 * @private
 */
ui.ComposeGlass.prototype.loadSelectedContent_ = function() {
  return new goog.Promise(function(resolve, reject) {
    // var origin = this.getContent().origin;
    var textArea = /** @type {HTMLTextAreaElement} */
        (this.getElement().querySelector('textarea'));
    var content = this.getContent().selection || '';
    //@yahoo TODO: convert it to plaintext
    var detectedAction = utils.text.getPgpAction(content);
    if (detectedAction == constants.Actions.DECRYPT_VERIFY) {
      // @yahoo sendExtensionRequest is used instead of actionExecutor
      utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
        action: constants.Actions.DECRYPT,
        content: content
        // @yahoo no passphrase dialog can be hooked from content script
        // passphraseCallback: goog.bind(this.renderPassphraseDialog, this)
      }), goog.bind(function(text) {
        if (text && (text = text.decrypt)) {
          text = text.text || '';
          if (e2e.openpgp.asciiArmor.isDraft(content)) {
            textArea.value = text;
          } else {
            this.renderReply_(textArea, text);
          }
        } else {
          this.renderReply_(textArea, content);
        }

        //@yahoo TODO: add onChange once, and avoid setting draft body

        resolve();
      }, this), goog.bind(function(error) {
        this.errorCallback_(error);
        resolve();
      }, this));
    } else {
      textArea.value = content;
      resolve();
    }
  }, this);
};


/**
 * Inserts the encrypted content into the page and sends it.
 * @param {string} origin The web origin for which the PGP action is performed.
 * @private
 */
ui.ComposeGlass.prototype.insertMessageIntoPage_ = function(origin) {
  // @yahoo recipients can be broken down as object of name and email
  // var recipients = this.chipHolder_.getSelectedUids();
  var recipients = utils.text.uidsToObjects(
                       this.chipHolder_.getSelectedUids());
  //@yahoo added ccChipHolder
  var ccRecipients = utils.text.uidsToObjects(
                         this.ccChipHolder_.getSelectedUids());
  var subject = goog.dom.getElement(constants.ElementId.SUBJECT) ?
      goog.dom.getElement(constants.ElementId.SUBJECT).value : undefined;
  // @yahoo not using prompt here
  // var prompt = /** @type {e2e.ext.ui.Prompt} */ (this.getParent());
  var shouldSend = this.canSend_(origin);
  var content = this.getContent();

  // @yahoo used the ymail API to sendDraft or setDraft
  this.api_.req(shouldSend ? 'draft.send' : 'draft.set', {
    from: goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value,
    to: recipients,
    cc: ccRecipients,
    subject: subject,
    body: this.editor_.value || content.value
  }).addCallbacks(this.close, this.errorCallback_, this);
};


/**
 * Encrypts the current draft and persists it into the web application that the
 * user is interacting with.
 * @param {string} origin The web origin where the message was created.
 * @param {function()} postSaveCallback The callback to call after saving the
 *     draft.
 * @param {goog.events.Event} e The event that triggers the saving of the
 *     draft.
 * @private
 */
ui.ComposeGlass.prototype.saveDraft_ = function(origin, postSaveCallback, e) {
  if (!this.getContent().canSaveDraft || document && !document.hasFocus()) {
    return;
  }

  // restart the timer
  if (this.saveDraftTimer_) {
    this.saveDraftTimer_.stop();
    this.saveDraftTimer_.start();
  }

  var formText = /** @type {HTMLTextAreaElement} */
      (this.getElement().querySelector('textarea'));
  var subject = goog.dom.getElement(constants.ElementId.SUBJECT) ?
      goog.dom.getElement(constants.ElementId.SUBJECT).value : undefined;
  var signer = goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value;
  // @yahoo signal to user we're encrypting
  var saveDraftMsg = this.getElementByClass(constants.CssClass.SAVE_DRAFT_MSG);
  saveDraftMsg.textContent = chrome.i18n.getMessage(
      'promptEncryptSignEncryptingDraftLabel');

  // @yahoo save the recipients too
  var recipients = utils.text.uidsToObjects(
                       this.chipHolder_.getSelectedUids(true));
  var ccRecipients = utils.text.uidsToObjects(
                         this.ccChipHolder_.getSelectedUids(true));

  // @yahoo do not trigger saving a draft if nothing has really changed
  if (goog.string.isEmpty(formText.value) &&
      goog.string.isEmptySafe(subject) &&
      recipients.length === 0 &&
      ccRecipients.length === 0) {
    return;
  }

  // @yahoo sendExtensionRequest is used instead of actionExecutor
  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.ENCRYPT_SIGN,
    content: formText.value,
    recipients: [signer],
    currentUser: signer
  }), goog.bind(function(encrypted) {
    // @yahoo signal to user we're saving
    saveDraftMsg.textContent = chrome.i18n.getMessage(
        'promptEncryptSignSavingDraftLabel');

    var draft = e2e.openpgp.asciiArmor.markAsDraft(encrypted);

    // Inject the draft into website.

    // @yahoo used the ymail API to saveDraft
    this.api_.req('draft.save', {
      from: signer,
      to: recipients,
      cc: ccRecipients,
      subject: subject,
      body: draft
    }).addCallbacks(function() {
      // @yahoo signal to user the encrypted draft is saved
      saveDraftMsg.textContent = chrome.i18n.getMessage(
          'promptEncryptSignSaveEncryptedDraftLabel',
          new Date().toLocaleTimeString().replace(/:\d\d? /, ' '));
      postSaveCallback && postSaveCallback();
    }, this.errorCallback_, this);


  }, this), goog.bind(function(error) {
    saveDraftMsg.textContent = '';

    if (error.messageId == 'promptNoEncryptionTarget') {
      var dialog = new dialogs.Generic(
          chrome.i18n.getMessage('promptNoEncryptionKeysFound', signer),
          goog.bind(function(decision) { //@yahoo opens config if clicked ok
            goog.dispose(dialog);
            //@yahoo opens config to set up keys if clicked ok
            if (goog.isDef(decision)) {
              utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
                action: constants.Actions.CONFIGURE_EXTENSION,
                content: signer
              }), goog.nullFunction, this.errorCallback_);
            } else {
              // prompt only once per glass
              this.getContent().canSaveDraft = false;
            }
          }, this),
          dialogs.InputType.NONE);
      this.renderDialog(dialog);
    } else if (error.messageId == 'glassKeyringLockedError') {
      this.displayFailure_(error);
    }

    // NOTE(radi): Errors are silenced here on purpose.
    // NOTE(adon): log the error
    console.error(error);
  }, this));
};

// @yahoo the following are all yahoo-specific


/**
 * Put the subject back to original compose
 * @param {Event} evt The key event
 * @private
 */
ui.ComposeGlass.prototype.forwardSubject_ = function(evt) {
  this.api_.req('draft.set', {subject: evt.target.value}).
      addErrback(this.errorCallback_);
};


/**
 * Put the draft content back to the original compose unencrypted
 * @private
 */
ui.ComposeGlass.prototype.switchToUnencrypted_ = function() {
  var subject = goog.dom.getElement(constants.ElementId.SUBJECT) ?
      goog.dom.getElement(constants.ElementId.SUBJECT).value : undefined;
  var signer = goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value;
  var recipients = utils.text.uidsToObjects(
                       this.chipHolder_.getSelectedUids());
  //@yahoo added ccChipHolder
  var ccRecipients = utils.text.uidsToObjects(
                         this.ccChipHolder_.getSelectedUids());

  // @yahoo used the ymail API to setDraft
  this.api_.req('draft.set', {
    from: signer,
    to: recipients,
    cc: ccRecipients,
    subject: subject,
    body: this.editor_.value
  }).addCallbacks(this.close, this.errorCallback_, this);
};


/**
 * Return whether each of the recipient has a public key
 * @param {!Array.<!string>} recipients A list of recipients
 * @param {boolean=} opt_omitErrback Whether to omit throwing error to the
 *    errback but simply assume all recipients have no keys. When set to true,
 *    display the error anyway.
 * @return {!e2e.async.Result.<!Array.<!boolean>>}
 * @private
 */
ui.ComposeGlass.prototype.havePublicKeys_ = function(
    recipients, opt_omitErrback) {
  if (recipients.length === 0) {
    return e2e.async.Result.toResult([false]);
  }

  var result = new e2e.async.Result;

  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.GET_ALL_KEYS_BY_EMAILS,
    recipients: recipients,
    content: 'public_exist'
  }), function(haveKeys) {
    result.callback(haveKeys);
  }, goog.bind(function(error) {
    if (opt_omitErrback) {
      this.displayFailure_(error);
      // assume everyone has no keys
      result.callback(goog.array.repeat(false, recipients.length));
    } else {
      result.errback(error);
    }
  }, this));

  return result;
};


/**
 * Return whether an uid misses a public key
 * @param {!string} recipient An uid
 * @return {!goog.async.Deferred.<!boolean>}
 * @private
 */
ui.ComposeGlass.prototype.hasPublicKeys_ = function(recipient) {
  return this.havePublicKeys_([recipient]).addCallbacks(function(haveKeys) {
    return haveKeys[0];
  }, this.errorCallback_);
};


/**
 * Sort out those recipients that have no keys
 * @param {!Array.<!string>} recipients A list of recipients
 * @param {boolean=} opt_omitErrback Whether to omit throwing error to the
 *    errback but simply assume all recipients have no keys. When set to true,
 *    display the error anyway.
 * @return {!goog.async.Deferred.<!Array.<!string>>} Those recipients that have
 *    no keys
 * @private
 */
ui.ComposeGlass.prototype.lackPublicKeys_ = function(
    recipients, opt_omitErrback) {
  return this.havePublicKeys_(recipients, opt_omitErrback).
      addCallback(function(haveKeys) {
        return goog.array.filter(recipients, function(recipient, i) {
          return !haveKeys[i];
        });
      });
};


/**
 * @private
 */
ui.ComposeGlass.prototype.setQuotedTextHandlers_ = function() {
  this.dateFormat_ || (this.dateFormat_ = new goog.i18n.DateTimeFormat(
      goog.i18n.DateTimeFormat.Format.FULL_DATE
      ));
  this.timeFormat_ || (this.timeFormat_ = new goog.i18n.DateTimeFormat(
      goog.i18n.DateTimeFormat.Format.MEDIUM_TIME
      ));
  goog.dom.classlist.add(this.editor_, constants.CssClass.HAS_QUOTED);
  this.getHandler().listenOnce(
      goog.dom.getElement(constants.ElementId.QUOTED_TEXT),
      goog.events.EventType.CLICK,
      goog.bind(function() {
        this.api_.req('draft.getQuoted', true).addCallbacks(function(quoted) {
          var quoted_ = /** @type {{html: !string, sentDate: number,
              from: e2e.ext.YmailData.EmailUser}} */ (quoted);
          var sentDate = new Date(quoted.sentDate * 1000);
          goog.dom.classlist.remove(
              this.editor_, constants.CssClass.HAS_QUOTED);
          this.editor_.value += '\n\n\n' +
              chrome.i18n.getMessage('promptReplyHeader', [
                this.dateFormat_.format(sentDate),
                this.timeFormat_.format(sentDate),
                utils.text.userObjectToUid(quoted.from)]) + '\n\n' +
              this.convertHtmlToPrettyText_(quoted.body);
          this.resizeEditor_(true);
        }, this.displayFailure_, this);
      }, this));
};


/**
 * TODO: encapsulate this in an editor class?
 * https://developer.mozilla.org/en/docs/Web/HTML/Block-level_elements
 * @type {string}
 * @const
 */
ui.ComposeGlass.BLOCK_ELEMENTS = 'address,article,aside,blockquote,canvas,' +
    'dd,div,dl,fieldset,figcaption,figure,figcaption,footer,form,h1,h2,h3,' +
    'h4,h5,h6,header,hgroup,hr,li,main,nav,noscript,ol,output,p,pre,' +
    'section,table,tfoot,ul,video';


/**
 * TODO: this is temp. support richtext in long term
 * Convert HTML to a prettified version of text content.
 * @param {!string} html
 * @return {!string} the text version
 * @private
 */
ui.ComposeGlass.prototype.convertHtmlToPrettyText_ = function(html) {
  this.domParser_ || (this.domParser_ = new DOMParser());
  var doc = this.domParser_.parseFromString(html, 'text/html'),
      body = doc.body, n, walk, el,
      arrForEach = Array.prototype.forEach;
  arrForEach.call(body.querySelectorAll(
      'script,embed,object,frame,iframe,style'), function(el) {
        el.parentElement.removeChild(el);
      });
  arrForEach.call(body.querySelectorAll('img'), function(el) {
    el.outerHTML = el.alt ? '[' + el.alt + ']' : '[image]';
  });
  arrForEach.call(body.getElementsByTagName('pre'), function(el) {
    el.innerHTML = el.innerHTML.
        replace(/\n/g, '<br>').replace(/\s/, '&nbsp;');
  });
  walk = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
  while (el = walk.nextNode()) {
    el.textContent = el.textContent.replace(/\s+/g, ' ');
  }
  arrForEach.call(body.querySelectorAll(ui.ComposeGlass.BLOCK_ELEMENTS),
      function(el) {
        el.appendChild(doc.createTextNode('\n'));
        el.parentElement.insertBefore(doc.createTextNode('\n'), el);
      });
  arrForEach.call(body.getElementsByTagName('ul'), function(el) {
    el.appendChild(doc.createTextNode('\n'));
    arrForEach.call(el.getElementsByTagName('li'), function(el) {
      el.parentElement.insertBefore(doc.createTextNode(' - '), el);
    });
  });
  arrForEach.call(body.getElementsByTagName('ol'), function(el) {
    el.appendChild(doc.createTextNode('\n'));
    var n = 1;
    arrForEach.call(el.getElementsByTagName('li'), function(el) {
      el.parentElement.insertBefore(doc.createTextNode(n++ + '. '), el);
    });
  });
  return body.innerText.replace(/(?:\s*\n\s*)+/g, '\n').trim();
};


/**
 * @param {!boolean} isInConv Whether the glass is inserted in a conversation
 * @private
 */
ui.ComposeGlass.prototype.setConversationDependentEventHandlers_ = function(
    isInConv) {
  if (isInConv) {
    goog.dom.classlist.add(document.body, constants.CssClass.CONVERSATION);

    // adjust action buttons position to stick at the bottom
    this.api_.setRequestHandler('evt.scroll',
        goog.bind(this.setActionBarPosition_, this));

  } else {
    // allow saving and escaping the draft
    this.getHandler().listen(
        goog.dom.getElement(constants.ElementId.SAVE_ESC_BUTTON),
        goog.events.EventType.CLICK,
        goog.bind(this.handleKeyEvent_, this,
            {type: 'keydown', keyCode: goog.events.KeyCodes.ESC}));

    // allow textarea scrolling when maxheight is reached
    this.api_.setRequestHandler('evt.minMaxSize', goog.bind(function(args) {
      var editorStyle = this.style,
          offset = 65 + goog.style.getPosition(this).y;
      editorStyle.minHeight = (args.minHeight - offset) + 'px';
      editorStyle.maxHeight = (args.maxHeight - offset) + 'px';
    }, this.editor_));

    // @yahoo set the subject on KEYUP
    var subjectElem = goog.dom.getElement(constants.ElementId.SUBJECT);
    if (subjectElem) {
      utils.listenThrottledEvent(/** @type {!EventTarget} */ (subjectElem),
          goog.events.EventType.KEYUP,
          goog.bind(this.forwardSubject_, this));
    }
  }
};


/**
 * Implements the requestMatchingRows() api for recipient autocompletion
 * @param {string} token
 * @param {number} maxMatches
 * @param {function(string, !Array<string>)} matchHandler
 * @private
 */
ui.ComposeGlass.prototype.requestMatchingRows_ = function(
    token, maxMatches, matchHandler) {
  var currentRecipients = [].concat(
      this.chipHolder_.getSelectedUids(true),
      this.ccChipHolder_.getSelectedUids(true));

  this.api_.req('autosuggest.search', {
    from: goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value,
    to: goog.array.map(currentRecipients, utils.text.extractValidEmail),
    query: token
  }).addCallbacks(
      function(contacts) {
        matchHandler(token, goog.array.map(contacts, function(contact) {
          contact.toString = goog.bind(
              utils.text.userObjectToUid, null, contact);
          return contact;
        }));
      },
      function(err) {
        // ignore timeout as request might be debounced/throttled
        if (!(err instanceof e2e.ext.MessageApi.TimeoutError)) {
          this.displayFailure_(err);
        }
      }, this);
};


/**
 * Determines whether there're any recipients
 * @return {!boolean}
 * @private
 */
ui.ComposeGlass.prototype.hasRecipients_ = function() {
  return [].concat(
      this.chipHolder_.getSelectedUids(true),
      this.ccChipHolder_.getSelectedUids(true)).length > 0;
};


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.ComposeGlass.prototype.displayFailure_ = function(error) {
  // @yahoo hide loading
  goog.style.setElementShown(
      this.getElementByClass(constants.CssClass.BOTTOM_NOTIFICATION), false);
  goog.style.setElementShown(
      this.getElementByClass(constants.CssClass.BUTTONS_CONTAINER), true);

  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  var encryptrIcon = goog.dom.getElement(constants.ElementId.ENCRYPTR_ICON).
      querySelector('label');
  if (error) {
    var errorMsg = goog.isDef(error.messageId) ?
        chrome.i18n.getMessage(error.messageId) : error.message;
    utils.errorHandler(error);
    errorDiv.textContent = errorMsg;

    //@yahoo
    encryptrIcon.classList.add(constants.CssClass.ERROR);
  } else {
    errorDiv.textContent = '';
    //@yahoo
    encryptrIcon.classList.remove(constants.CssClass.ERROR);
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
 * Resize the textarea according to the content //@yahoo
 * @param {!boolean} skipForcedScroll Whether to skip scrolling by delta height
 * @private
 */
ui.ComposeGlass.prototype.resizeEditor_ = function(skipForcedScroll) {
  var shadowEditor = this.shadowEditor_,
      editor = this.editor_,
      currentHeight = editor.clientHeight,
      canScroll = editor.scrollHeight > currentHeight,
      newHeight, deltaHeight, maxHeight;
  if (canScroll) {
    newHeight = editor.scrollHeight;
  } else {
    // determine the textarea height that just fit the content
    if (!shadowEditor) {
      shadowEditor = this.shadowEditor_ = document.createElement('textarea');
      shadowEditor.tabIndex = -1;
      shadowEditor.className = editor.className;
      shadowEditor.style.position = 'absolute';
      shadowEditor.style.zIndex = -1;
      shadowEditor.style.height = '0px';
      shadowEditor.style.opacity = 0;
      document.body.appendChild(shadowEditor);
    }
    shadowEditor.value = editor.value;
    newHeight = shadowEditor.scrollHeight;
  }

  if (currentHeight !== newHeight &&
      newHeight > parseInt(editor.style.minHeight, 10)) {
    editor.style.height = newHeight + 'px';

    // apply scroll by delta height also in compose that spans the whole tab
    maxHeight = parseInt(editor.style.maxHeight, 10);
    deltaHeight = maxHeight && (newHeight - currentHeight);
    if (deltaHeight) {
      !skipForcedScroll && (editor.style.scrollTop += deltaHeight);
    }
    this.resizeGlass_(skipForcedScroll);
  }
  editor.focus();
};


/**
 * Trigger the iframe to resize, and scroll up by delta height to prevent caret
 * from covered by the action bar.
 * @param {!boolean} skipForcedScroll Whether to skip scrolling by delta height
 * @private
 */
ui.ComposeGlass.prototype.resizeGlass_ = function(skipForcedScroll) {
  var height = document.body.clientHeight + 65;
  if (height !== window.innerHeight) {
    this.api_.req('ctrl.resizeGlass', {
      height: height,
      scrollByDeltaHeight: !skipForcedScroll &&
          this.actionBar_.style.top !== 'auto' // i.e., floating over text
    }).addErrback(this.errorCallback_);
  }
};


/**
 * Fix the position of action bar //@yahoo
 * @param {*} offset The offset for positioning action buttons.
 * @return {boolean} always true
 * @private
 */
ui.ComposeGlass.prototype.setActionBarPosition_ = function(offset) {
  var yOffset = offset.y, actionBarStyle = this.actionBar_.style;
  if (goog.isDef(yOffset)) {
    yOffset = yOffset < window.innerHeight &&
        yOffset > (goog.style.getPosition(this.editor_).y + 100) ?
            (yOffset - 65) + 'px' :
            'auto';
    if (actionBarStyle.top != yOffset) {
      actionBarStyle.top = yOffset;
    }
  }
  return true;
};


/**
 * Forward the keyboard events back to the original application //@yahoo
 * @param {goog.events.BrowserEvent} evt The keydown event to handle.
 * @private
 */
ui.ComposeGlass.prototype.handleKeyEvent_ = function(evt) {
  var keyCode = evt.keyCode,
      keyCodeEnum = goog.events.KeyCodes,
      agentSpecificMeta = goog.userAgent.MAC ? evt.metaKey : evt.ctrlKey;

  // handle shortcuts no matter where it is placed
  switch (keyCode) {
    case keyCodeEnum.ENTER:     // Send by Cmd + Enter
      if (!agentSpecificMeta) { break; }
      this.keyMissingDialog_ ?
          // Another Cmd+S to trigger Send in plaintext
          this.keyMissingDialog_.invokeCallback(false) :
          this.keyMissingWarningThenEncryptSign_();
      evt.preventDefault();
      evt.stopPropagation();
      return;
    case keyCodeEnum.S:         // Send by Cmd + S
      if (!agentSpecificMeta) { break; }
      this.saveDraft_(this.getContent().origin, goog.nullFunction, null);
      evt.preventDefault();
      evt.stopPropagation();
      return;
    case keyCodeEnum.ESC:       // Close Conversation
      this.saveDraft_(this.getContent().origin,
          goog.bind(this.forwardKeyEvent_, this, evt), null);
      return;
  }

  // proceed if it is an non-input element
  if (!evt.target || !goog.isDef(evt.target.value)) {
    switch (keyCode) {
      // save before forwarding key events
      case keyCodeEnum.COMMA:     // Previous Conversation
      case keyCodeEnum.PERIOD:    // Next Conversation
        if (!evt.ctrlKey) { break; }
      case keyCodeEnum.LEFT:      // Previous Conversation
      case keyCodeEnum.RIGHT:     // Next Conversation
      case keyCodeEnum.E:         // Archive Conversation
      case keyCodeEnum.M:         // Inbox
      case keyCodeEnum.N:         // New Compose
        this.saveDraft_(this.getContent().origin,
            goog.bind(this.forwardKeyEvent_, this, evt), null);
        return;
    }
    this.forwardKeyEvent_(evt);
  }
};


/**
 * Send a key event to the original compose
 * @param {*} evt The keyboard event to handle.
 * @private
 */
ui.ComposeGlass.prototype.forwardKeyEvent_ = function(evt) {
  this.forwardEvent_({
    type: evt.type,
    keyCode: evt.keyCode,
    metaKey: evt.metaKey,
    ctrlKey: evt.ctrlKey,
    shiftKey: evt.shiftKey,
    altKey: evt.altKey
  });
};


/**
 * Send an event to the original compose
 * @param {*} evt The keyboard event to handle.
 * @private
 */
ui.ComposeGlass.prototype.forwardEvent_ = function(evt) {
  this.api_.req('draft.triggerEvent', evt).addErrback(this.errorCallback_);
};


/**
 * Dispose the glass
 * @override
 */
ui.ComposeGlass.prototype.disposeInternal = function() {
  // Clear all input and text area fields to ensure that no data accidentally
  // leaks to the user.
  goog.array.forEach(
      document.querySelectorAll('textarea,input'), function(elem) {
        elem.value = '';
      });

  // @yahoo no more green in the icon
  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.RESET_PAGEACTION
  }), goog.nullFunction, this.errorCallback_);

  goog.base(this, 'disposeInternal');
};


/**
 * Close the glass
 */
ui.ComposeGlass.prototype.close = function() {
  this.api_.req('ctrl.closeGlass').
      addCallbacks(this.dispose, this.displayFailure_, this);
};


/**
 * Discard the draft, and let the glass be destroyed
 */
ui.ComposeGlass.prototype.discard = function() {
  this.api_.req('draft.discard').
      addCallbacks(this.dispose, this.displayFailure_, this);
};


/**
 * Pops a warning if there does not have a session passphrase, or if any of the
 * recipients does not have a public key. If no problem, call encryptSign_()
 * //@yahoo
 * @private
 */
ui.ComposeGlass.prototype.keyMissingWarningThenEncryptSign_ = function() {
  if (this.sendButtonClicked_) {
    return;
  }

  // display loading icon of encrypting and sending
  goog.style.setElementShown(this.getElementByClass(
      constants.CssClass.BOTTOM_NOTIFICATION), true);
  goog.style.setElementShown(this.getElementByClass(
      constants.CssClass.BUTTONS_CONTAINER), false);

  // given no chipholder or there exists a session passphrase
  if ((!this.chipHolder_ && !this.ccChipHolder_) ||
      this.chipHolder_.getProvidedPassphrases().length > 0) {
    this.encryptSign_();
    return;
  }

  var selectedUids = this.chipHolder_.getSelectedUids();
  var selectedCCUids = this.ccChipHolder_.getSelectedUids();

  // warn the user there're no recipients
  if (selectedUids.length === 0 && selectedCCUids.length === 0) {
    this.displayFailure_(
        new utils.Error('no recipients', 'promptNoEncryptionTarget'));
    return;
  }

  // deliberately put after no recipients check
  this.sendButtonClicked_ = true;

  // omitted errors from lackPublicKeys_, and thus no errback will be called
  // as errors regarding lacking of public keys or keyserver connection error
  // should not prohibit users from sending emails in plaintext
  this.lackPublicKeys_(selectedUids.concat(selectedCCUids), true).
      addCallback(function(invalidRecipients) {
        if (invalidRecipients.length === 0) {
          this.encryptSign_();
        } else {
          var origin = this.getContent().origin;
          // send unencrypted if the user endorsed it
          this.renderKeyMissingWarningDialog_(invalidRecipients).addCallback(
              goog.bind(this.insertMessageIntoPage_, this, origin));
        }
      }, this);
};


/**
 * Confirm with users what to if some recipients have no keys
 * @param {!Array.<string>} invalidUids The uids that have no keys
 * @return {!goog.async.Deferred.<undefined>} Callback when the user has
 *     confirmed to send the message unencrypted
 * @private
 */
ui.ComposeGlass.prototype.renderKeyMissingWarningDialog_ = function(
    invalidUids) {
  // TODO: add a warning with mute option
  var result = new goog.async.Deferred;

  var recipientString = goog.array.map(
      utils.text.uidsToObjects(invalidUids),
      function(p) {
        return '<span title="' + p.email.replace(/"/g, '&quot;') +
                '">' + p.name.replace(/</g, '&lt;') + '</span>';
      }).join(', ');

  // disabled per message passphrase encryption for now
  // var msg = chrome.i18n.getMessage(
  //     'composeGlassAddPassphraseForRecipients', recipientString).
  //     replace('\n', '<br>').
  //     replace(/#add#([^#]*)#/,
  //         '<label for="' +
  //         constants.ElementId.ADD_PASSPHRASE_BUTTON +
  //         '">$1</label>');

  var msg = chrome.i18n.getMessage(
      'composeGlassConfirmRecipients', recipientString);

  var dialog = new ui.dialogs.Generic(
      soydata.VERY_UNSAFE.ordainSanitizedHtml(msg),
      goog.bind(function(userAction) {
        this.sendButtonClicked_ = false;
        this.keyMissingDialog_.dispose();
        this.keyMissingDialog_ = null;

        goog.dom.classlist.remove(this.getElement(),
                                  constants.CssClass.UNCLICKABLE);
        // hide loading
        goog.style.setElementShown(this.getElementByClass(
            constants.CssClass.BOTTOM_NOTIFICATION), false);
        goog.style.setElementShown(this.getElementByClass(
            constants.CssClass.BUTTONS_CONTAINER), true);

        // User clicked ok to 'send unencrypted message'
        if (goog.isDef(userAction)) {
          result.callback();
        }
      }, this),
      ui.dialogs.InputType.NONE,
      undefined,
      chrome.i18n.getMessage('composeGlassSendUnencryptedMessage'),
      chrome.i18n.getMessage('actionCancelPgpAction'));

  this.keyMissingDialog_ = dialog;
  this.renderDialog(dialog);

  // Set the background element to be unclickable.
  goog.dom.classlist.add(this.getElement(),
      constants.CssClass.UNCLICKABLE);

  return result;
};

});  // goog.scope
