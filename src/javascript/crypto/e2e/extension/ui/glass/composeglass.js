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
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');  //@yahoo
goog.require('goog.object');
goog.require('goog.string');
goog.require('goog.string.format');
goog.require('goog.style');
goog.require('goog.ui.KeyboardShortcutHandler'); //@yahoo
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
 * @param {!messages.e2ebindDraft} draft Message draft
 * @param {string} origin The origin that requested the compose glass
 * @param {e2e.ext.MessageApi} api The Message API
 * @constructor
 * @extends {e2e.ext.ui.panels.prompt.PanelBase}
 */
ui.ComposeGlass = function(draft, origin, api) {
  // @yahoo a space is prepended for linebreak starting string to workaround
  // the missing caret issue in textarea
  var selection = goog.string.canonicalizeNewlines(draft.body || '');
  if (selection.charCodeAt(0) === 10) {
    selection = ' ' + selection;
  }

  var content = /** @type {!messages.BridgeMessageRequest} */ ({
    selection: selection,
    recipients: draft.to || [],
    ccRecipients: [].concat(draft.cc || [], draft.bcc || []),
    action: constants.Actions.ENCRYPT_SIGN,
    request: true,
    origin: origin,
    subject: draft.subject || '',
    canInject: true,
    canSaveDraft: true
  });

  this.errorCallback_ = goog.bind(this.displayFailure_, this);

  goog.base(this, chrome.i18n.getMessage('promptEncryptSignTitle'),
      content, this.errorCallback_);

  /**
   * The contacts data for autocompletion
   * @type {Array.<{email:string, firstname:string}>}
   * @private
   */
  this.contacts_ = draft.contacts || [];

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

  /**
   * The email of the sender
   * @type {string}
   * @private
   */
  this.defaultSender_ = draft.from ? draft.from.toLowerCase() : '';

  /**
   * Whether the compose glass is installed inside a conversation
   * @type {boolean}
   * @private
   */
  this.insideConv_ = draft.insideConv;
};
goog.inherits(ui.ComposeGlass, e2e.ext.ui.panels.prompt.PanelBase);


/** @override */
ui.ComposeGlass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  var content = this.getContent();

  // @yahoo renders the HTML
  soy.renderElement(elem, templates.main, {
    signerCheckboxTitle: chrome.i18n.getMessage('promptSignMessageAs'),
    fromLabel: chrome.i18n.getMessage('promptFromLabel'),
    actionButtonTitle: chrome.i18n.getMessage(
        'promptEncryptSignActionLabel'),
    actionDraftDeleteTitle: chrome.i18n.getMessage(
        'actionDraftDeleteTitle'),
    subject: content.subject,
    subjectLabel: chrome.i18n.getMessage('promptSubjectLabel'),
    loadingLabel: chrome.i18n.getMessage('promptLoadingLabel'),
    unsupportedFormattingLabel: chrome.i18n.getMessage(
        'promptUnsupportedFormattingLabel'),
    encryptrMessage: chrome.i18n.getMessage('promptEncryptrBodyOnlyMessage')
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


/**
 * The shortcut keys to capture
 * @return {Array.<{id:string, keyCode: number, meta: boolean, shift: boolean,
 *     ctrl: boolean, save: boolean}>}
 */
ui.ComposeGlass.prototype.getShortcuts = function() {
  return [
    {id: 'prevTab', keyCode: goog.events.KeyCodes.OPEN_SQUARE_BRACKET},
    {id: 'nextTab', keyCode: goog.events.KeyCodes.CLOSE_SQUARE_BRACKET},

    {id: 'prevCov', keyCode: goog.events.KeyCodes.COMMA,
      ctrl: true, save: true},
    {id: 'nextCov', keyCode: goog.events.KeyCodes.PERIOD,
      ctrl: true, save: true},
    {id: 'prevCov', keyCode: goog.events.KeyCodes.LEFT, save: true},
    {id: 'nextCov', keyCode: goog.events.KeyCodes.RIGHT, save: true},
    {id: 'archiveCov', keyCode: goog.events.KeyCodes.E, save: true},
    {id: 'moveCov', keyCode: goog.events.KeyCodes.D},
    {id: 'moveToCov', keyCode: goog.events.KeyCodes.D, shift: true},
    {id: 'deleteCov', keyCode: goog.events.KeyCodes.DELETE},
    // {id: 'replyCov', keyCode: goog.events.KeyCodes.R, shift: true},
    // {id: 'replyallCov', keyCode: goog.events.KeyCodes.A, shift: true},
    // {id: 'forwardCov', keyCode: goog.events.KeyCodes.F, shift: true},
    {id: 'unreadCov', keyCode: goog.events.KeyCodes.K, shift: true},
    {id: 'flagCov', keyCode: goog.events.KeyCodes.L, shift: true},
    {id: 'closeCov', keyCode: goog.events.KeyCodes.ESC, save: true},

    {id: 'prev', keyCode: goog.events.KeyCodes.COMMA},
    {id: 'next', keyCode: goog.events.KeyCodes.PERIOD},

    // {id: 'display', keyCode: goog.events.KeyCodes.ENTER},
    // {id: 'display', keyCode: goog.events.KeyCodes.SPACE},
    // {id: 'reply', keyCode: goog.events.KeyCodes.R},
    // {id: 'replyall', keyCode: goog.events.KeyCodes.A},
    // {id: 'forward', keyCode: goog.events.KeyCodes.F},
    // {id: 'unread', keyCode: goog.events.KeyCodes.K},
    {id: 'unreadCov', keyCode: goog.events.KeyCodes.K},
    // {id: 'flag', keyCode: goog.events.KeyCodes.L},
    {id: 'flagCov', keyCode: goog.events.KeyCodes.L},

    {id: 'inbox', keyCode: goog.events.KeyCodes.M, save: true},
    {id: 'inbox', keyCode: goog.events.KeyCodes.M, shift: true, save: true},
    {id: 'compose', keyCode: goog.events.KeyCodes.N, save: true},
    {id: 'settings', keyCode: goog.events.KeyCodes.SEMICOLON},
    {id: 'newfolder', keyCode: goog.events.KeyCodes.E,
      meta: true, shift: true},
    // {id: 'voiceOn', keyCode: goog.events.KeyCodes.L,
    //   meta: true, shift: true},
    // {id: 'voiceOff', keyCode: goog.events.KeyCodes.X,
    //   meta: true, shift: true}

    {id: 'send', keyCode: goog.events.KeyCodes.ENTER, meta: true},
    {id: 'save', keyCode: goog.events.KeyCodes.S, meta: true, save: true}
  ];
};


/** @override */
ui.ComposeGlass.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');
  var origin = this.getContent().origin;

  this.populateUi_();

  //@yahoo checks for key missing before calling EncryptSign
  this.getHandler().listen(
      this.getElementByClass(constants.CssClass.ACTION),
      goog.events.EventType.CLICK,
      goog.bind(this.keyMissingWarningThenEncryptSign_, this));

  // @yahoo added shortcut keys
  var elem = this.getElement(),
      sHandler = goog.ui.KeyboardShortcutHandler,
      userAgentModifier = goog.userAgent.MAC ?
          sHandler.Modifiers.META :
          sHandler.Modifiers.CTRL,
      keyboardHandler = new goog.ui.KeyboardShortcutHandler(elem),
      afterSaveKeyboardHandler = new goog.ui.KeyboardShortcutHandler(elem);

  goog.array.forEach(this.getShortcuts(), function(key) {
    (key.save ? afterSaveKeyboardHandler : keyboardHandler).registerShortcut(
        key.id, key.keyCode,
        (key.meta ? userAgentModifier : sHandler.Modifiers.NONE) +
            (key.shift ? sHandler.Modifiers.SHIFT : sHandler.Modifiers.NONE) +
            (key.ctrl ? sHandler.Modifiers.CTRL : sHandler.Modifiers.NONE));
  });

  var textArea = /** @type {HTMLTextAreaElement} */
      (elem.querySelector('textarea'));

  this.getHandler().
      listen(
          keyboardHandler,
          sHandler.EventType.SHORTCUT_TRIGGERED,
          goog.bind(this.handleKeyEvent_, this)).
      listen(
          afterSaveKeyboardHandler,
          sHandler.EventType.SHORTCUT_TRIGGERED,
          goog.bind(this.handleKeyEventAfterSave_, this));


  // @yahoo turn the extension icon into green when the text area is in focus
  this.getHandler().
      listen(textArea, goog.events.EventType.FOCUS, goog.bind(function() {
        utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
          action: constants.Actions.CHANGE_PAGEACTION
        }));
        this.mirrorSize_(textArea);
      }, this)).
      listen(textArea, goog.events.EventType.BLUR,
          goog.bind(utils.sendProxyRequest, null, {
            action: constants.Actions.RESET_PAGEACTION
          })).
      listen(textArea, goog.events.EventType.INPUT,
          goog.bind(this.mirrorSize_, this, textArea));

  //@yahoo resize the textarea when window is resized
  utils.listenThrottledEvent(window, goog.events.EventType.RESIZE,
      goog.bind(this.resizeTextArea_, this, textArea));

  // @yahoo sets the focus
  goog.events.listen(window, goog.events.EventType.FOCUS,
      goog.bind(this.handleKeyEvent_, this));


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
          goog.partial(this.savePlaintextDraft_, origin, false)).
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
          goog.bind(this.close, this, true));

  // extra things to do when it's opened inside conversation
  if (this.insideConv_) {
    goog.dom.classlist.add(document.body, constants.CssClass.CONVERSATION);

    //@yahoo adjust action buttons position to stick at the bottom
    this.api_.getRequestHandler().set('setScrollOffset',
        goog.bind(this.fixActionButtonsPosition_, this));

  } else {
    var escButton = goog.dom.getElement(constants.ElementId.SAVE_ESC_BUTTON);
    //@yahoo allows saving and escaping the draft
    this.getHandler().listen(escButton, goog.events.EventType.CLICK, goog.bind(
        this.handleKeyEventAfterSave_, this, {identifier: 'closeCov'}));
  }
};


/**
 * Renders the available encryption keys in the UI. //@yahoo
 * @return {!goog.Promise} Promise resolved when the encryption keys have
 *     been successfully rendered. It's never rejected.
 * @private
 */
ui.ComposeGlass.prototype.renderEncryptionKeys_ = function() {
  return new goog.Promise(function(resolve, reject) {

    // @yahoo collect all available recipients from contact list instead
    // var allAvailableRecipients = goog.object.getKeys(searchResult);
    var allAvailableRecipients = goog.array.map(
        this.contacts_,
        function(p) {
          // map the object to a string
          return (p.firstname || p.email) + ' <' + p.email + '>';
        });

    // @yahoo add the sender as one of the available recipients too
    this.defaultSender_ && allAvailableRecipients.push(
        this.defaultSender_ + ' <' + this.defaultSender_ + '>');

    // var recipientsEmailMap =
    //     this.getRecipientsEmailMap_(allAvailableRecipients);
    // goog.array.forEach(providedRecipients, function(recipient) {
    //   if (recipientsEmailMap.hasOwnProperty(recipient)) {
    //     goog.array.extend(intendedRecipients,
    //       recipientsEmailMap[recipient]);
    //   }
    // });
    this.chipHolder_ = new panels.ChipHolder(
        this.getContent().recipients, allAvailableRecipients,
        goog.bind(this.renderEncryptionPassphraseDialog_, this),
        // @yahoo enhanced ChipHolder with dynamic validation
        goog.bind(this.hasUnsupportedRecipients_, this));
    this.addChild(this.chipHolder_, false);
    this.chipHolder_.decorate(
        goog.dom.getElement(constants.ElementId.CHIP_HOLDER));

    // @yahoo added cc recipients
    this.ccChipHolder_ = new panels.ChipHolder(
        this.getContent().ccRecipients, allAvailableRecipients,
        null,
        // @yahoo enhanced ChipHolder with dynamic validation
        goog.bind(this.hasUnsupportedRecipients_, this));
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
      var selectedIndex = 0, senderMatched = false;
      goog.array.forEach(availableSigningKeys, function(key, i) {
        var keyElem = document.createElement('option');
        keyElem.textContent = key;
        signerSelect.appendChild(keyElem);

        // @yahoo choose the first UID associated with the 'from' address
        if (this.defaultSender_ && selectedIndex == 0 &&
            goog.string.contains(key.toLowerCase(), this.defaultSender_)) {
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
  var textArea = /** @type {HTMLTextAreaElement} */
      (this.getElement().querySelector('textarea'));
  textArea.scrollTop = 0;
  textArea.setSelectionRange(0, 0);

  // @yahoo trigger textarea and glass resize
  this.resizeTextArea_(textArea);
  this.mirrorSize_(textArea);

  this.chipHolder_.focus();

  // @yahoo added ccChipHolder
  if (this.chipHolder_.hasChildren() || this.ccChipHolder_.hasChildren()) {
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

  // @yahoo added ccChipHolder
  if (this.ccChipHolder_ && this.ccChipHolder_.hasChildren()) {
    request.recipients = request.recipients.concat(
        this.ccChipHolder_.getSelectedUids());
  }

  var signerCheck = goog.dom.getElement(constants.ElementId.SIGN_MESSAGE_CHECK);
  request.signMessage = signerCheck && signerCheck.checked;

  // @yahoo sendExtensionRequest is used instead of actionExecutor
  utils.sendExtensionRequest(request, goog.bind(function(response) {
    var encrypted = response.content;

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
        // @yahoo no passphrase dialog can be hooked from content script
        // passphraseCallback: goog.bind(this.renderPassphraseDialog, this)
      }), goog.bind(function(response) {
        var decrypted = response.content || '';

        if (e2e.openpgp.asciiArmor.isDraft(content)) {
          textArea.value = decrypted;
        } else {
          this.renderReply_(textArea, decrypted);
        }

        //@yahoo TODO: add onChange once, and avoid setting draft body

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
 * @param {string} origin The web origin for which the PGP action is performed.
 * @private
 */
ui.ComposeGlass.prototype.insertMessageIntoPage_ = function(origin) {
  var textArea = this.getElement().querySelector('textarea');
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
      value: textArea.value || content.value,
      response: true,
      detach: true,
      origin: origin,
      recipients: recipients,
      ccRecipients: ccRecipients, //@yahoo added ccChipHolder
      subject: subject,
      from: goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value
    })

    // @yahoo close the compose glass if succeeded
  })).addCallbacks(goog.bind(this.close, this, false), this.errorCallback_);
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
  if (document && !document.hasFocus()) {
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
                       this.chipHolder_.getSelectedUids());
  var ccRecipients = utils.text.uidsToObjects(
                         this.ccChipHolder_.getSelectedUids());

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

    var draft = e2e.openpgp.asciiArmor.markAsDraft(encrypted.content);

    // set the focus before setting draft

    // Inject the draft into website.
    //@yahoo used sendProxyRequest instead of HelperProxy.updateSelectedContent
    utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
      action: constants.Actions.SET_DRAFT,
      content: /** @type {messages.BridgeMessageResponse} */ ({
        value: draft,
        response: true,
        detach: true,
        origin: origin,
        recipients: recipients,
        ccRecipients: ccRecipients, //@yahoo added ccChipHolder
        subject: subject,
        attachments: [], //@yahoo to force save
        from: signer
      })
    })).addCallbacks(function() {
      // @yahoo signal to user the encrypted draft is saved
      saveDraftMsg.textContent = chrome.i18n.getMessage(
          'promptEncryptSignSaveEncryptedDraftLabel',
          new Date().toLocaleTimeString().replace(/:\d\d? /, ' '));
      postSaveCallback && postSaveCallback();
    }, this.errorCallback_, this);


  }, this), goog.bind(function(error) {
    if (error.messageId == 'promptNoEncryptionTarget') {
      var dialog = new dialogs.Generic(
          chrome.i18n.getMessage('promptNoEncryptionKeysFound'),
          goog.bind(function(decision) { //@yahoo opens config if clicked ok
            goog.dispose(dialog);
            //@yahoo opens config to set up keys if clicked ok
            if (goog.isDef(decision)) {
              utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
                action: constants.Actions.CONFIGURE_EXTENSION,
                content: signer
              }));
            } else {
              // prompt only once per glass
              this.getContent().canSaveDraft = false;
            }
          }, this),
          dialogs.InputType.NONE);
      this.renderDialog(dialog);
    }

    // NOTE(radi): Errors are silenced here on purpose.
  }, this));
};

// @yahoo the following are all yahoo-specific


/**
 * Leaves the current draft unencrypted and persists it into the web
 * application that the user is interacting with.
 * @param {string} origin The web origin where the message was created.
 * @param {goog.events.Event} evt The event that triggers the saving of the
 *     draft.
 * @private
 */
ui.ComposeGlass.prototype.savePlaintextDraft_ = function(origin, evt) {
  // TODO: add a warning with mute option

  var formText = /** @type {HTMLTextAreaElement} */
      (this.getElement().querySelector('textarea'));
  var subject = goog.dom.getElement(constants.ElementId.SUBJECT) ?
      goog.dom.getElement(constants.ElementId.SUBJECT).value : undefined;
  var signer = goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value;
  var recipients = utils.text.uidsToObjects(
                       this.chipHolder_.getSelectedUids());
  //@yahoo added ccChipHolder
  var ccRecipients = utils.text.uidsToObjects(
                         this.ccChipHolder_.getSelectedUids());

  // @yahoo used sendProxyRequest instead of HelperProxy.updateSelectedContent
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.SET_DRAFT,
    content: /** @type {messages.BridgeMessageResponse} */ ({
      value: formText.value,
      response: true,
      detach: true,
      origin: origin,
      recipients: recipients,
      ccRecipients: ccRecipients, //@yahoo added ccChipHolder
      subject: subject,
      from: signer
    })

    // @yahoo close the compose glass if succeeded
  })).addCallbacks(goog.bind(this.close, this, false), this.errorCallback_);
};


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
  }, goog.bind(result.errback, result));

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
  // hide loading
  goog.style.setElementShown(
      this.getElementByClass(constants.CssClass.BOTTOM_NOTIFICATION), false);
  goog.style.setElementShown(
      this.getElementByClass(constants.CssClass.BUTTONS_CONTAINER), true);

  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  if (error) {
    var errorMsg = goog.isDef(error.messageId) ?
        chrome.i18n.getMessage(error.messageId) : error.message;
    utils.errorHandler(error);
    errorDiv.textContent = errorMsg;

    //@yahoo
    goog.dom.getElement(constants.ElementId.ENCRYPTR_ICON).
        querySelector('label').classList.add(constants.CssClass.ERROR);
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
 * Resize the textarea //@yahoo
 * @param {HTMLTextAreaElement} textArea The textarea element
 * @private
 */
ui.ComposeGlass.prototype.resizeTextArea_ = function(textArea) {
  textArea.style.height = (
      window.innerHeight - goog.style.getPosition(textArea).y - 65) + 'px';
  textArea.focus();
};


/**
 * Trigger the iframe to resize //@yahoo
 * @param {HTMLTextAreaElement} textArea The textarea element
 * @private
 */
ui.ComposeGlass.prototype.mirrorSize_ = function(textArea) {
  // create a temp textarea element to compute scrollHeight
  var t = document.createElement('textarea');
  t.value = textArea.value;
  t.style.width = window.innerWidth + 'px';
  t.style.height = '0px';
  t.style.opacity = 0;
  document.body.appendChild(t);
  var diff = t.scrollHeight - textArea.clientHeight;
  document.body.removeChild(t);

  if (diff !== 0) {
    this.api_.sendRequest('setSize',
        goog.bind(this.fixActionButtonsPosition_, this),
        this.errorCallback_,
        {height: (diff + window.innerHeight) + 'px'});
  }
};


/**
 * Fix the action buttons position //@yahoo
 * @param {*} offset The offset for positioning action buttons.
 * @return {boolean} always true
 * @private
 */
ui.ComposeGlass.prototype.fixActionButtonsPosition_ = function(offset) {
  var elem = this.getElementByClass(constants.CssClass.PROMPT_ACTIONS),
      textArea = /** @type {HTMLTextAreaElement} */ (
          this.getElement().querySelector('textarea')),
      yOffset = offset.y;
  if (goog.isDef(yOffset)) {
    yOffset = yOffset < window.innerHeight &&
        yOffset > (goog.style.getPosition(textArea).y + 100) ?
            (yOffset - 65) + 'px' :
            'auto';
    elem.style.top != yOffset && (elem.style.top = yOffset);
  }
  return true;
};


/**
 * Handles keyboard events for shortcut keys //@yahoo
 * @param {goog.ui.KeyboardShortcutEvent} evt The keyboard event to handle.
 * @private
 */
ui.ComposeGlass.prototype.handleKeyEvent_ = function(evt) {
  var args = evt.identifier ? {keyId: evt.identifier} : undefined;
  var content = this.getContent();
  if (evt.identifier === 'send') {
    this.keyMissingDialog_ ?
        this.keyMissingDialog_.invokeCallback(false) : // Send in plaintext
        this.keyMissingWarningThenEncryptSign_();
    return;
  }

  this.api_.sendRequest('shortcut',
      goog.nullFunction, this.errorCallback_, args);
};


/**
 * Handles keyboard events for shortcut keys after saving the draft //@yahoo
 * @param {goog.ui.KeyboardShortcutEvent} evt The keyboard event to handle.
 * @private
 */
ui.ComposeGlass.prototype.handleKeyEventAfterSave_ = function(evt) {
  var content = this.getContent();
  content.canSaveDraft && this.saveDraft_(
      content.origin, goog.bind(this.handleKeyEvent_, this, evt), evt);
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
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.RESET_PAGEACTION
  }));

  goog.base(this, 'disposeInternal');
};


/**
 * Closes the glass, and optionally discard the draft
 * @param {boolean=} opt_discardDraft Whether to discard the draft
 */
ui.ComposeGlass.prototype.close = function(opt_discardDraft) {
  this.api_.sendRequest('exit',
      goog.bind(goog.dispose, null, this), this.errorCallback_,
      {discardDraft: opt_discardDraft === true});
};


/**
 * Pops a warning if there does not have a session passphrase, or if any of the
 * recipients does not have a public key. If no problem, call encryptSign_()
 * //@yahoo
 * @private
 */
ui.ComposeGlass.prototype.keyMissingWarningThenEncryptSign_ = function() {
  // prevent opening the same dialog twice
  if (this.keyMissingDialogTriggered_) {
    return;
  }

  var loadingElem = this.getElementByClass(
          constants.CssClass.BOTTOM_NOTIFICATION),
      buttonsElem = this.getElementByClass(
          constants.CssClass.BUTTONS_CONTAINER);

  // display loading
  goog.style.setElementShown(loadingElem, true);
  goog.style.setElementShown(buttonsElem, false);

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
  this.keyMissingDialogTriggered_ = true;

  // @yahoo ask to remove invalid recipients or send unencrypted msg
  this.lackPublicKeys_(selectedUids.concat(selectedCCUids)).
      addCallbacks(function(invalidRecipients) {
        if (invalidRecipients.length === 0) {
          this.encryptSign_();
        } else {
          var recipientString = goog.array.map(
              utils.text.uidsToObjects(invalidRecipients),
              function(p) {
                return '<span title="' + p.email.replace(/"/g, '&quot;') +
                        '">' + p.name.replace(/</g, '&lt;') + '</span>';
              }).join(', ');

          // Show dialog asking user to remove recipients without keys
          var msg = chrome.i18n.getMessage('composeGlassConfirmRecipients').
              replace('\n', '<br>').
              replace('#recipients#', recipientString).
              replace(/#add#([^#]*)#/,
                  '<label for="' + constants.ElementId.ADD_PASSPHRASE_BUTTON +
                  '">$1</label>');

          var dialog = this.keyMissingDialog_ = new ui.dialogs.Generic(
              soydata.VERY_UNSAFE.ordainSanitizedHtml(msg),
              goog.bind(function(result) {
                this.keyMissingDialogTriggered_ = false;
                this.keyMissingDialog_ = null;
                // close the warning
                goog.dispose(dialog);
                goog.dom.classlist.remove(this.getElement(),
                                          constants.CssClass.UNCLICKABLE);
                // hide loading
                goog.style.setElementShown(loadingElem, false);
                goog.style.setElementShown(buttonsElem, true);

                // User clicked ok to 'send unencrypted message'
                if (typeof result !== 'undefined') {

                  // disable signing the message
                  var signerCheck = goog.dom.getElement(
                          constants.ElementId.SIGN_MESSAGE_CHECK);
                  signerCheck && (signerCheck.checked = 'checked');

                  this.insertMessageIntoPage_(this.getContent().origin);
                }
              }, this),
              ui.dialogs.InputType.NONE,
              undefined,
              chrome.i18n.getMessage('composeGlassSendUnencryptedMessage'),
              chrome.i18n.getMessage('actionCancelPgpAction'));

          this.renderDialog(dialog);

          // Set the background element to be unclickable.
          goog.dom.classlist.add(this.getElement(),
              constants.CssClass.UNCLICKABLE);
        }
      }, this.displayFailure_, this);
};

});  // goog.scope
