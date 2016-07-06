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
goog.require('e2e.ext.YmailType'); //@yahoo
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.constants.PGPHtmlMessage');
goog.require('e2e.ext.ui.RichTextEditor');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.panels.Chip');
goog.require('e2e.ext.ui.panels.ChipHolder');
goog.require('e2e.ext.ui.panels.ChipHolderInputHandler'); //@yahoo
goog.require('e2e.ext.ui.templates.composeglass');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.Error');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Promise');
goog.require('goog.array');
goog.require('goog.async.Deferred');
goog.require('goog.async.Throttle');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.editor.Field');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes'); //@yahoo
goog.require('goog.html.SafeUrl'); //@yahoo
goog.require('goog.i18n.DateTimeFormat'); //@yahoo
goog.require('goog.object');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('goog.ui.ac.AutoComplete'); //@yahoo
goog.require('goog.ui.ac.Renderer'); //@yahoo
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
 * @extends {goog.ui.Component}
 */
ui.ComposeGlass = function(origin, api) {
  goog.base(this);

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

  this.errorCallback_ = goog.bind(this.displayFailure, this);

  /**
   * The email of the sender
   * @type {?e2e.ext.YmailType.EmailUser}
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
goog.inherits(ui.ComposeGlass, goog.ui.Component);


/** @override */
ui.ComposeGlass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  // @yahoo renders the HTML
  soy.renderElement(elem, templates.main, {
    signerCheckboxTitle: chrome.i18n.getMessage('promptSignMessageAs'),
    fromLabel: chrome.i18n.getMessage('promptFromLabel'),
    toLabel: chrome.i18n.getMessage('promptRecipientsPlaceholder'),
    ccLabel: chrome.i18n.getMessage('promptCCRecipientsPlaceholder'),
    actionButtonTitle: chrome.i18n.getMessage(
        'promptEncryptSignActionLabel'),
    actionFormatTextTitle: chrome.i18n.getMessage(
        'actionFormatTextTitle'),
    actionDraftDeleteTitle: chrome.i18n.getMessage(
        'actionDraftDeleteTitle'),
    subject: '',
    subjectLabel: chrome.i18n.getMessage('promptSubjectLabel'),
    loadingLabel: chrome.i18n.getMessage('promptLoadingLabel'),
    showOriginalLabel: chrome.i18n.getMessage('promptShowOriginalLabel'),
    unsupportedAttachmentLabel: chrome.i18n.getMessage(
        'promptunsupportedAttachmentLabel'),
    encryptrMessage: chrome.i18n.getMessage('promptEncryptrBodyOnlyMessage')
  });
};


/**
 * Populates the UI elements with the received data.
 * @private
 */
ui.ComposeGlass.prototype.populateUi_ = function() {
  //@yahoo defer getDraft() until populateUi() is called
  this.api_.req('draft.get').addCallbacks(function(draft) {

    this.draft_ = draft;

    this.defaultSender_ = draft.from;

    // set event handlers based on whether the glass is in conversation
    this.setConversationDependentEventHandlers_(draft.isInConv);

    goog.Promise.all([
      // Populate the UI with the available encryption keys.
      this.renderEncryptionKeys_(),
      // Populate the UI with the available signing keys.
      this.renderSigningKeys_()
    ]).then(function() {
      // Load selected content.
      this.loadSelectedContent_();
      // When all of the above steps completed, set up focus.
      this.focusRelevantElement_();
    }, null, this);

    // set subject
    var subj = goog.dom.getElement(constants.ElementId.SUBJECT);
    subj && (subj.value = draft.subject);

  }, this.displayFailure, this);
};


/** @override */
ui.ComposeGlass.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  this.editor_ = new ui.RichTextEditor(this,
      constants.ElementId.EDITOR,
      constants.ElementId.EDITOR_TOOLBAR);
  this.registerDisposable(this.editor_);

  goog.dom.classlist.add(
      goog.dom.getElement(constants.ElementId.BODY),
      constants.CssClass.RICHTEXT);

  this.actionBar_ = this.getElementByClass(constants.CssClass.PROMPT_ACTIONS);

  this.populateUi_();

  // trigger auto save at most once every 5 seconds
  var throttledSave_ = new goog.async.Throttle(this.saveDraft_, 5000, this);

  this.getHandler().
      //@yahoo handle auto save of message body
      listen(this.editor_,
          goog.editor.Field.EventType.DELAYEDCHANGE,
          goog.bind(throttledSave_.fire, throttledSave_)).
      //@yahoo checks for key missing before calling EncryptSign
      listen(
          this.getElementByClass(constants.CssClass.ACTION),
          goog.events.EventType.CLICK,
          goog.bind(this.keyMissingWarningThenEncryptSign_, this)).
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

  // @yahoo handle and forward keydown events
  goog.events.listen(document.documentElement, goog.events.EventType.KEYDOWN,
      goog.bind(this.handleKeyEvent_, this));
  // @yahoo forward focus events
  goog.events.listen(document.documentElement, goog.events.EventType.FOCUS,
      goog.bind(this.forwardEvent_, this, {type: 'focus'}));


  //@yahoo save encrypted draft when it is closed externally
  this.api_.setRequestHandler('evt.close', goog.bind(function() {
    this.editor_.dispatchEvent(goog.editor.Field.EventType.BLUR);
    this.saveDraft_();
  }, this));

  // clear prior failure when any item is on clicked or focused
  this.getHandler().listen(
      this.getElement(),
      [goog.events.EventType.CLICK, goog.events.EventType.FOCUS],
      goog.bind(this.displayFailure, this, null), true);
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
        goog.array.map(this.draft_.to || [], utils.text.userObjectToUid),
        goog.bind(this.getAutoComplete_, this),
        // @yahoo enhanced ChipHolder with dynamic validation
        goog.bind(this.hasPublicKeys_, this),
        goog.bind(this.renderEncryptionPassphraseDialog_, this));
    this.addChild(this.chipHolder_, false);
    this.chipHolder_.decorate(
        goog.dom.getElement(constants.ElementId.CHIP_HOLDER));

    // @yahoo added cc recipients
    this.ccChipHolder_ = new panels.ChipHolder(
        goog.array.map([].concat(this.draft_.cc || [], this.draft_.bcc || []),
            utils.text.userObjectToUid),
        goog.bind(this.getAutoComplete_, this),
        // @yahoo enhanced ChipHolder with dynamic validation
        goog.bind(this.hasPublicKeys_, this),
        null);
    this.addChild(this.ccChipHolder_, false);
    this.ccChipHolder_.decorate(
        goog.dom.getElement(constants.ElementId.CC_CHIP_HOLDER));

    this.createAutoComplete_();

    //@yahoo handle auto save of recipients
    this.getHandler().listen(this.chipHolder_,
        goog.events.EventType.CHANGE,
        function() {
          // @yahoo save the recipients
          this.setHeader_({
            to: utils.text.uidsToObjects(
                this.chipHolder_.getSelectedUids(true))
          });
        });
    this.getHandler().listen(this.ccChipHolder_,
        goog.events.EventType.CHANGE,
        function() {
          // @yahoo save the recipients
          this.setHeader_({
            cc: utils.text.uidsToObjects(
                this.ccChipHolder_.getSelectedUids(true))
          });
        });

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

      // TODO: add a dummy row, so advanced user can choose not to sign message

      // @yahoo prompt users to sign up with the mail default user
      if (availableSigningKeys.length === 0) {
        this.renderConfigureUserDialog_();
      } else {
        // @yahoo populate the sender field
        var emailList = [];
        goog.array.forEach(availableSigningKeys, function(uid) {
          var option = document.createElement('option');
          option.textContent = uid;
          emailList.push(utils.text.extractValidEmail(uid));
          signerSelect.appendChild(option);
        }, this);

        // @yahoo locate the first keyholder that matches the email
        var selectedIndex = emailList.indexOf(this.defaultSender_.email);
        // @yahoo select the matched one, or the first one
        signerSelect.selectedIndex = Math.min(selectedIndex, 0);

        // @yahoo display sender selection if there's a choice,
        //        or it's different from the mail default
        if (availableSigningKeys.length > 1 || selectedIndex === -1) {
          goog.style.setElementShown(
              goog.dom.getElement(constants.ElementId.FROM_HOLDER), true);
        }
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
 * editor.
 * @private
 */
ui.ComposeGlass.prototype.focusRelevantElement_ = function() {
  // @yahoo added ccChipHolder. used ricttexteditor
  if (this.chipHolder_.hasChildren() || this.ccChipHolder_.hasChildren()) {
    this.editor_.focusAndPlaceCursorAtStart();
  } else {
    this.chipHolder_.focus();
  }
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
 * //@yahoo removed.
 * Renders the original message to which the user wants to reply.
 * @param {string} originalMsg The original message.
 * @private
 */
ui.ComposeGlass.prototype.renderReply_ = goog.nullFunction;


/**
 * Executes the ENCRYPT_SIGN action.
 * @private
 */
ui.ComposeGlass.prototype.encryptSign_ = function() {

  var request = /** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.ENCRYPT_SIGN,
    content: this.editor_.getCleanContents(),
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
    this.editor_.makeUneditable();
    this.chipHolder_.lock();
    // @yahoo added ccChipHolder
    this.ccChipHolder_.lock();
    var signCheckbox = goog.dom.getElement(
        constants.ElementId.SIGN_MESSAGE_CHECK);
    signCheckbox.disabled = true;

    // @yahoo proceed injecting the content
    this.insertMessageIntoPage_(encrypted, true);

  }, this), this.errorCallback_);
};


/**
 * Loads the content that the user has selected in the web application.
 * @private
 */
ui.ComposeGlass.prototype.loadSelectedContent_ = function() {
  // set the inital HTML retrieved from draft.
  this.editor_.makeEditable();
  this.editor_.setPreferences(this.getInitialDraft().pref);
  this.editor_.setHtml(false, this.draft_.body, true);

  // display show original message, and install the click handler
  this.draft_.hasQuoted && this.setQuotedTextHandlers_();
};


/**
 * Inserts the content into the page and sends it.
 * @param {string} content The content to inject and send
 * @param {boolean} wasEncrypted Whether the message was encrypted.
 * @private
 */
ui.ComposeGlass.prototype.insertMessageIntoPage_ = function(
    content, wasEncrypted) {
  // @yahoo recipients can be broken down as object of name and email
  // var recipients = this.chipHolder_.getSelectedUids();
  var recipients = utils.text.uidsToObjects(
                       this.chipHolder_.getSelectedUids());
  var ccRecipients = utils.text.uidsToObjects(
                         this.ccChipHolder_.getSelectedUids());
  var subject = goog.dom.getElement(constants.ElementId.SUBJECT) ?
      goog.dom.getElement(constants.ElementId.SUBJECT).value : undefined;

  // @yahoo used the ymail API to sendDraft
  this.api_.req('draft.send', {
    from: goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value,
    to: recipients,
    cc: ccRecipients,
    subject: subject,
    body: wasEncrypted ?
        constants.PGPHtmlMessage.WRAPPER_OPEN +
        content + constants.PGPHtmlMessage.WRAPPER_CLOSE : content,
    stats: {
      encrypted: wasEncrypted ? 1 : 0
    }
  }).addCallbacks(this.close, this.errorCallback_, this);
};


/**
 * Encrypts the current draft and puts it back into the web application, which
 * will save it at a time it desires. When opt_persist is set, the application
 * is forced to save.
 * @param {boolean=} opt_persist Whether to persist the changes immediately.
 * @param {Function=} opt_completionCallback The callback to call after setting
 *     the draft.
 * @private
 */
ui.ComposeGlass.prototype.saveDraft_ = function(
    opt_persist, opt_completionCallback) {
  var body = this.editor_.getCleanContents();

  var subject = goog.dom.getElement(constants.ElementId.SUBJECT) ?
      goog.dom.getElement(constants.ElementId.SUBJECT).value : undefined;
  var signer = goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value;

  // @yahoo save the recipients too
  var recipients = utils.text.uidsToObjects(
                       this.chipHolder_.getSelectedUids(true));
  var ccRecipients = utils.text.uidsToObjects(
                         this.ccChipHolder_.getSelectedUids(true));

  // @yahoo signal to user we're encrypting
  var saveDraftMsg = this.getElementByClass(constants.CssClass.SAVE_DRAFT_MSG);
  saveDraftMsg.textContent = chrome.i18n.getMessage(
      'promptEncryptSignEncryptingDraftLabel');

  // @yahoo sendExtensionRequest is used instead of actionExecutor
  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.ENCRYPT_SIGN,
    content: body,
    recipients: [signer],
    currentUser: signer
  }), goog.bind(function(encrypted) {
    // @yahoo signal to user we're saving
    saveDraftMsg.textContent = chrome.i18n.getMessage(
        'promptEncryptSignSavingDraftLabel');

    var draft = e2e.openpgp.asciiArmor.markAsDraft(encrypted);

    // Inject the draft into website.

    // @yahoo used the ymail API to saveDraft
    this.api_.req(opt_persist === true ? 'draft.save' : 'draft.set', {
      from: signer,
      to: recipients,
      cc: ccRecipients,
      subject: subject,
      body: constants.PGPHtmlMessage.WRAPPER_OPEN +
          draft + constants.PGPHtmlMessage.WRAPPER_CLOSE
    }).addCallbacks(function() {
      // @yahoo signal to user the encrypted draft is saved
      saveDraftMsg.textContent = chrome.i18n.getMessage(
          'promptEncryptSignSaveEncryptedDraftLabel',
          new Date().toLocaleTimeString().replace(/:\d\d? /, ' '));
      // @yahoo trigger the completion callback
      opt_completionCallback && opt_completionCallback();
    }, this.errorCallback_, this);


  }, this), goog.bind(function(error) {
    saveDraftMsg.textContent = '';

    if (error.messageId == 'promptNoEncryptionTarget') {
      this.renderConfigureUserDialog_(signer);
    } else if (error.messageId == 'glassKeyringLockedError') {
      this.displayFailure(error);
    }

    // NOTE(radi): Errors are silenced here on purpose.
    // NOTE(adon): yahoo. log the error
    console.error(error);
  }, this));
};

// @yahoo the following are all yahoo-specific


/**
 * Public method to call this.api_.setRequestHandler. Note that each call can
 * take only one handler.
 * @param {string} call Name of the Message API function to listen on.
 * @param {function(?):*} callback
 * @return {ext.MessageApi} this.api_
 */
ui.ComposeGlass.prototype.setApiRequestHandler = function(call, callback) {
  this.api_.setRequestHandler(call, callback);
  return this.api_;
};


/**
 * Renders the provided dialog into the panel.
 * @param {!dialogs.Generic} dialog The dialog to render.
 * @protected
 */
ui.ComposeGlass.prototype.renderDialog = function(dialog) {
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  this.addChild(dialog, false);
  dialog.render(popupElem);
};


/**
 * Renders the UI elements needed for requesting the passphrase of an individual
 * PGP key.
 * @param {string} uid The UID of the PGP key.
 * @return {!e2e.async.Result<string>} A promise resolved with the user-provided
 *     passphrase.
 * @protected
 */
ui.ComposeGlass.prototype.renderPassphraseDialog =
    function(uid) {
  var result = new e2e.async.Result();
  var dialog = new dialogs.Generic(chrome.i18n.getMessage(
      'promptPassphraseCallbackMessage', uid),
      function(passphrase) {
        goog.dispose(dialog);
        result.callback(/** @type {string} */ (passphrase));
      },
      dialogs.InputType.SECURE_TEXT,
      '',
      chrome.i18n.getMessage('actionEnterPassphrase'),
      chrome.i18n.getMessage('actionCancelPgpAction'));
  this.renderDialog(dialog);
  return result;
};


/**
 * Renders a dialog that prompts users to take action on configuring the uid.
 * @param {string=} opt_uid The user id. Defaulted to use this.defaultSender_.
 * @private
 */
ui.ComposeGlass.prototype.renderConfigureUserDialog_ = function(opt_uid) {
  if (this.configureUserDialogRendered_) {
    return;
  }
  this.configureUserDialogRendered_ = true;

  !opt_uid && (opt_uid = utils.text.userObjectToUid(this.defaultSender_));

  var dialog = new dialogs.Generic(
      chrome.i18n.getMessage('promptNoEncryptionKeysFound', opt_uid),
      goog.bind(function(decision) { //@yahoo opens config if clicked ok
        goog.dispose(dialog);
        this.configureUserDialogRendered_ = false;
        //@yahoo opens config to set up keys if clicked ok
        if (goog.isDef(decision)) {
          utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
            action: constants.Actions.CONFIGURE_EXTENSION,
            content: opt_uid
          }), goog.nullFunction, this.errorCallback_);
        }
      }, this),
      ui.dialogs.InputType.NONE);
  this.renderDialog(dialog);
};


/**
 * Put the email header back to original compose
 * @param {{to: (Array.<e2e.ext.YmailType.EmailUser>|undefined),
 *     cc: (Array.<e2e.ext.YmailType.EmailUser>|undefined),
 *     subject: (string|undefined)}} header
 * @return {!goog.async.Deferred} The deferred API result
 * @private
 */
ui.ComposeGlass.prototype.setHeader_ = function(header) {
  return this.api_.req('draft.set', header).addErrback(this.errorCallback_);
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
    body: this.editor_.getCleanContents()
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
      this.displayFailure(error);
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
 * Renders show original message, and install the click handler that can expand
 * the quoted message.
 * @private
 */
ui.ComposeGlass.prototype.setQuotedTextHandlers_ = function() {
  var editorElement = this.editor_.getElement();
  this.dateFormat_ || (this.dateFormat_ = new goog.i18n.DateTimeFormat(
      goog.i18n.DateTimeFormat.Format.FULL_DATE
      ));
  this.timeFormat_ || (this.timeFormat_ = new goog.i18n.DateTimeFormat(
      goog.i18n.DateTimeFormat.Format.MEDIUM_TIME
      ));
  goog.dom.classlist.add(editorElement, constants.CssClass.HAS_QUOTED);
  this.getHandler().listenOnce(
      goog.dom.getElement(constants.ElementId.QUOTED_TEXT),
      goog.events.EventType.CLICK,
      goog.bind(function() {
        this.api_.req('draft.getQuoted', true).addCallbacks(function(quoted) {
          var sentDate = new Date(quoted.sentDate * 1000);
          goog.dom.classlist.remove(
              editorElement, constants.CssClass.HAS_QUOTED);

          this.editor_.appendHtml('<br><br>', 'qtdSeparateBR');

          var replyHeader = '<div><font size="2" face="Arial">' +
              chrome.i18n.getMessage('promptReplyHeader', [
                this.dateFormat_.format(sentDate),
                this.timeFormat_.format(sentDate),
                utils.text.userObjectToUid(quoted.from).replace(/</g, '&lt;')
              ]) + '</font></div><br><br>';
          this.editor_.appendHtml(replyHeader +
              '<div class="y_msg_container">' + quoted.body + '</div>',
              'yahoo_quoted');

        }, this.displayFailure, this);
      }, this));
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

    // @yahoo set the subject on KEYUP
    var subjectElem = goog.dom.getElement(constants.ElementId.SUBJECT);
    if (subjectElem) {
      this.registerDisposable(
          utils.addAnimationDelayedListener(subjectElem,
              goog.events.EventType.KEYUP,
              goog.bind(function() {
                this.setHeader_({subject: subjectElem.value});
              }, this)));
    }
  }
};


/**
 * Factory function for building an autocomplete widget for the Chips.
 * @return {!goog.ui.ac.AutoComplete} A new autocomplete object.
 * @private
 */
ui.ComposeGlass.prototype.createAutoComplete_ = function() {
  // must be called after chipHolder_ and ccChipHolder_ are rendered
  var chipHolder = this.chipHolder_,
      ccChipHolder = this.ccChipHolder_,
      chipHolderElem = chipHolder.getElement(),
      ccChipHolderElem = ccChipHolder.getElement();

  // @yahoo used autosuggest api instead of a static allUids
  var renderer = new goog.ui.ac.Renderer(undefined, {
    renderRow: function(row, token, elem) {
      var text = e2e.ext.utils.text.userObjectToUid(row.data);
      var imageUrl = goog.html.SafeUrl.sanitize(row.data.imageUrl);
      // imageUrl is encodeURI()-ed, and it's thus safe to put inside url("")
      elem.style.backgroundImage = 'url("' + row.data.imageUrl + '")';
      goog.dom.setTextContent(elem, text);
    }
  });
  renderer.setAnchorElement(chipHolderElem);
  renderer.setAnchorElement(ccChipHolderElem);

  var inputHandler = new ui.panels.ChipHolderInputHandler(function(value) {
    var target = this.getAutoComplete().getTarget();
    return (target.classList.contains('to') ? chipHolder : ccChipHolder).
        handleNewChipValue(value);
  }, goog.bind(this.hasRecipients_, this));

  var autoComplete = new goog.ui.ac.AutoComplete(this, renderer, inputHandler);
  // autoComplete.setTriggerSuggestionsOnUpdate(true);
  autoComplete.listen(goog.ui.ac.AutoComplete.EventType.UPDATE, function(evt) {
    this.dismiss();
    this.getSelectionHandler().update(true);
  });
  inputHandler.attachAutoComplete(autoComplete);
  inputHandler.attachInputs(
      chipHolderElem.querySelector('input'),
      ccChipHolderElem.querySelector('input'));
  return (this.autoComplete_ = autoComplete);
};


/**
 * Retrieve the autocomplete widget for the Chips.
 * @return {!goog.ui.ac.AutoComplete} The autocomplete object.
 * @private
 */
ui.ComposeGlass.prototype.getAutoComplete_ = function() {
  return this.autoComplete_;
};


/**
 * Implements the requestMatchingRows() api for recipient autocompletion
 * @param {string} token
 * @param {number} maxMatches
 * @param {function(string, !Array<string>)} matchHandler
 */
ui.ComposeGlass.prototype.requestMatchingRows = function(
    token, maxMatches, matchHandler) {
  var currentRecipients = [].concat(
      this.chipHolder_.getSelectedUids(true),
      this.ccChipHolder_.getSelectedUids(true));

  this.api_.req('autosuggest.search', {
    from: utils.text.extractValidEmail(
        goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value),
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
          this.displayFailure(err);
        }
      }, this);
};


/**
 * Determines whether there're any recipients
 * @return {!boolean}
 * @private
 */
ui.ComposeGlass.prototype.hasRecipients_ = function() {
  return this.chipHolder_.hasChildren() || this.ccChipHolder_.hasChildren();
};


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 */
ui.ComposeGlass.prototype.displayFailure = function(error) {
  // @yahoo hide loading
  this.displayActionButtons_();

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
 * Trigger the iframe to resize, and scroll up by delta height to prevent caret
 * from covered by the action bar.
 * @param {boolean=} opt_skipForcedScroll Whether to skip scrolling by delta
 *     height
 */
ui.ComposeGlass.prototype.resize = function(opt_skipForcedScroll) {
  var height = document.body.clientHeight + 101;
  if (height !== window.innerHeight) {
    this.api_.req('ctrl.resizeGlass', {
      height: height,
      scrollByDeltaHeight: !opt_skipForcedScroll &&
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
    // 210 is the min value to give up smart scrolling but affix it at bottom
    yOffset = yOffset < window.innerHeight &&
        yOffset > (goog.style.getPosition(this.editor_.getElement()).y + 210) ?
            (yOffset - 101) + 'px' :
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
      this.saveDraft_(true);
      evt.preventDefault();
      evt.stopPropagation();
      return;
    case keyCodeEnum.ESC:       // Close Conversation
      this.saveDraft_(false, goog.bind(this.forwardKeyEvent_, this, evt));
      this.editor_.dispatchEvent(goog.editor.Field.EventType.BLUR);
      return;
  }

  // proceed if it is an non-input element
  if (!evt.target || !goog.isDef(evt.target.value) &&
      evt.target !== this.editor_.getElement()) {
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
        this.saveDraft_(false, goog.bind(this.forwardKeyEvent_, this, evt));
        this.editor_.dispatchEvent(goog.editor.Field.EventType.BLUR);
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
  this.api_.req('evt.trigger', evt).addErrback(this.errorCallback_);
};


/**
 * Dispose the glass
 * @override
 */
ui.ComposeGlass.prototype.disposeInternal = function() {
  // Clear all input and text area fields to ensure that no data accidentally
  // leaks to the user.
  goog.array.forEach(
      document.querySelectorAll('input'), function(elem) {
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
      addCallbacks(this.dispose, this.displayFailure, this);
};


/**
 * Discard the draft, and let the glass be destroyed
 */
ui.ComposeGlass.prototype.discard = function() {
  this.api_.req('draft.discard').
      addCallbacks(this.dispose, this.displayFailure, this);
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
  goog.dom.classlist.remove(this.getElementByClass(
      constants.CssClass.BOTTOM_NOTIFICATION), constants.CssClass.HIDDEN);
  goog.dom.classlist.add(this.getElementByClass(
      constants.CssClass.BUTTONS_CONTAINER), constants.CssClass.HIDDEN);

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
    this.displayFailure(
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
          // hide loading
          this.displayActionButtons_();
          // send unencrypted if the user endorsed it
          this.renderKeyMissingWarningDialog_(invalidRecipients).
              addCallback(function() {
                this.editor_.makeUneditable();
                this.insertMessageIntoPage_(
                    this.editor_.getCleanContents(), false);
              }, this);
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
        this.displayActionButtons_();

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


/**
 * Restore the action bar and hide the loading one
 * @private
 */
ui.ComposeGlass.prototype.displayActionButtons_ = function() {
  goog.dom.classlist.add(this.getElementByClass(
      constants.CssClass.BOTTOM_NOTIFICATION), constants.CssClass.HIDDEN);
  goog.dom.classlist.remove(this.getElementByClass(
      constants.CssClass.BUTTONS_CONTAINER), constants.CssClass.HIDDEN);
};


/**
 * Retrieve the draft object
 * @return {e2e.ext.YmailType.Draft}
 */
ui.ComposeGlass.prototype.getInitialDraft = function() {
  return this.draft_;
};

});  // goog.scope
