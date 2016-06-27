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
 * @fileoverview Implements the looking glass that allows decrypted PGP messages
 * to be securely displayed inside the original web applications.
 */

goog.provide('e2e.ext.ui.Glass');

goog.require('e2e');
goog.require('e2e.async.Result');
goog.require('e2e.ext.MessageApi');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
/** @suppress {extraRequire} manually import typedefs due to b/15739810 */
goog.require('e2e.ext.messages.ApiRequest');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.templates.glass');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.DomPurifier');
goog.require('e2e.ext.utils.Error');
goog.require('e2e.ext.utils.action');
goog.require('e2e.ext.utils.text');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('soy');


goog.scope(function() {
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;
var templates = e2e.ext.ui.templates.glass;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;
var dialogs = e2e.ext.ui.dialogs;



/**
 * Constructor for the looking glass.
 * @constructor
 * @extends {goog.ui.Component}
 */
ui.Glass = function() {
  goog.base(this);
};
goog.inherits(ui.Glass, goog.ui.Component);


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.Glass.prototype.displayFailure_ = function(error) {
  //@yahoo hide the loading icon
  var bodyElem = this.getElementByClass(constants.CssClass.USER_CONTENT);

  if (bodyElem.classList.contains(constants.CssClass.LOADER)) {
    this.armor_ && (bodyElem.textContent = this.armor_.text);
    bodyElem.classList.remove(constants.CssClass.LOADER);
  }

  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  if (error) {
    var errorMsg = goog.isDef(error.messageId) ?
        chrome.i18n.getMessage(error.messageId) : error.message;
    utils.errorHandler(error);
    errorDiv.textContent = errorMsg;

    //@yahoo
    this.encryptrIcon_.querySelector('label').
        classList.add(constants.CssClass.ERROR);
  } else {
    errorDiv.textContent = '';
  }

  this.resizeGlass_();
};


/** @override */
ui.Glass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);
  soy.renderElement(document.body, templates.contentFrame, null);
};


/** @override */
ui.Glass.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // @yahoo display the loading icon
  var bodyElem = this.getElementByClass(constants.CssClass.USER_CONTENT);

  this.encryptrIcon_ = goog.dom.getElement(constants.ElementId.ENCRYPTR_ICON);

  /**
   * The Message API instance
   * @type {!e2e.ext.MessageApi}
   * @private
   */
  var api = this.api_ = new e2e.ext.MessageApi('ymail-glass');

  api.bootstrapClient(
      e2e.ext.utils.text.isYmailOrigin, goog.bind(function(error) {
        error instanceof Error ?
            this.displayFailure_(error) :
            api.req('read.get').addCallbacks(/** @param {{
                armor:e2e.openpgp.ArmoredMessage,
                isRichText:boolean}} content */ function(content) {
              this.armor_ = content.armor;
              this.isRichText_ = content.isRichText;
              this.renderSelectedContent_();
            }, this.displayFailure_, this);
      }, this));


  // @yahoo handle and forward keydown events
  goog.events.listen(document.documentElement, goog.events.EventType.KEYDOWN,
      goog.bind(this.forwardKeyEvent_, this));
  // @yahoo forward focus events
  goog.events.listen(document.documentElement, goog.events.EventType.CLICK,
      goog.bind(this.forwardEvent_, this, {type: 'focus'}));

  //@yahoo resize the glass when window is resized
  window && this.registerDisposable(
      utils.addAnimationDelayedListener(window,
          goog.events.EventType.RESIZE, this.resizeGlass_, false, this));
};


/**
 * Send a key event to the original compose
 * @param {*} evt The keyboard event to handle.
 * @private
 */
ui.Glass.prototype.forwardKeyEvent_ = function(evt) {
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
ui.Glass.prototype.forwardEvent_ = function(evt) {
  this.api_ && this.api_.req('evt.trigger', evt).
      addErrback(this.displayFailure_, this);
};


/**
 * Loads the content for decryption and verification
 * @param {string=} opt_decryptPassphrase The per message decryption passphrase
 * @private
 */
ui.Glass.prototype.renderSelectedContent_ = function(opt_decryptPassphrase) {
  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    content: this.armor_.text,
    action: constants.Actions.DECRYPT_THEN_VERIFY,
    decryptPassphrase: opt_decryptPassphrase
  }),
  goog.bind(function(/** @type {!e2e.openpgp.VerifiedDecrypt} */ result) {

    // If the response has no content, show an undecryptable error if
    // the error message is missing for some reason.
    if (!goog.isDef(result)) {
      this.displayFailure_(new utils.Error(
          'decryption failed', 'glassCannotDecrypt'));
      return;
    }

    this.setContent_(result);
    this.setEncryptrMessage_(result);

    // make a second call for verification result
    var verifyResultId = /** @type {{verifyResultId: (string|undefined)}} */ (
        result.verifyResultId);
    if (verifyResultId) {
      utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
        content: verifyResultId,
        action: constants.Actions.VERIFY,
        decryptPassphrase: opt_decryptPassphrase
      }),
      goog.bind(function(/** @type {!e2e.openpgp.VerifiedDecrypt} */ result) {
        this.setEncryptrMessage_(result);
      }, this),
      goog.bind(this.renderPassphraseAndError_, this));
      return;
    }

  }, this), goog.bind(this.renderPassphraseAndError_, this));
};


/**
 * Loads the content that results in error
 * @param {Error} error The error object
 * @private
 */
ui.Glass.prototype.renderPassphraseAndError_ = function(error) {
  // renderPassphraseCallback if decryptPassphrase is needed
  if (error.message === chrome.i18n.getMessage('actionEnterPassphrase')) {
    this.renderPassphraseCallback_().addCallback(function(passphrase) {
      if (passphrase) {
        this.renderSelectedContent_(passphrase);
      } else {
        this.displayFailure_(new utils.Error(
            'incorrect passphrase', 'passphraseIncorrectWarning'));
      }
    }, this);
  } else {
    this.displayFailure_(error);
  }
};


/**
 * Renders the UI elements needed for properly displaying the email body
 * @param {!e2e.openpgp.VerifiedDecrypt} result
 * @private
 */
ui.Glass.prototype.setContent_ = function(result) {
  var bodyElem = this.getElementByClass(constants.CssClass.USER_CONTENT);
  bodyElem.classList.remove(constants.CssClass.LOADER);

  if (this.isRichText_) {
    bodyElem.classList.add(constants.CssClass.RICHTEXT);
    bodyElem.innerHTML = new utils.DomPurifier().
        cleanContentsHtml(result.decrypt.text);

    // warn about form submissions
    bodyElem.addEventListener('submit', function(evt) {
      if (!window.confirm(
          chrome.i18n.getMessage('promptExternalFormWarning'))) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    }, true);

    // warn users once when focused on a password field
    bodyElem.addEventListener('focus', function(evt) {
      if (!evt.target.warningShown &&
          evt.target.tagName === 'INPUT' &&
          evt.target.type === 'password') {
        evt.target.warningShown = true;
        alert(chrome.i18n.getMessage('promptFocusPasswordWarning'));
      }
    }, true);

  } else {
    bodyElem.textContent = result.decrypt.text;
  }

  this.resizeGlass_();
};


/**
 * Renders the UI elements needed for displaying the decryption and signature
 * information
 * @param {!e2e.openpgp.VerifiedDecrypt} result
 * @private
 */
ui.Glass.prototype.setEncryptrMessage_ = function(result) {
  var encryptrMsg = this.encryptrIcon_.querySelector('div');
  goog.dom.removeChildren(encryptrMsg);

  if (result) {
    var decryptMessage = document.createElement('p'),
        verifyMessage = document.createElement('p');

    if (result.decrypt) {
      decryptMessage.textContent = result.decrypt.wasEncrypted ?
          chrome.i18n.getMessage('promptDecryptionSuccessMsg') :
          chrome.i18n.getMessage('promptMessageNotEncryptedMsg');
    }

    if (result.verifyResultId) {
      verifyMessage.textContent = chrome.i18n.getMessage(
          'promptSignatureVerifyingMsg');
      verifyMessage.appendChild(document.createElement('div')).
          classList.add(constants.CssClass.LOADER);
    } else if (result.verify) {

      if (result.verify.failure.length > 0) {
        this.displayFailure_(new Error(chrome.i18n.getMessage(
            'promptVerificationFailureMsg',
            utils.action.extractUserIds(result.verify.failure))));
      }
      if (result.verify.success.length > 0) {
        verifyMessage.textContent = chrome.i18n.getMessage(
            'promptVerificationSuccessMsg',
            utils.action.extractUserIds(result.verify.success));
      } else if (!result.decrypt.wasEncrypted) {
        // hide the encryptr icon if it was NOT encrypted nor signed
        this.encryptrIcon_.classList.add(constants.CssClass.HIDDEN);
      }
    }

    encryptrMsg.appendChild(decryptMessage);
    encryptrMsg.appendChild(verifyMessage);
  }
};


/**
 * Mirror the glass size back to the parent frame
 * @private
 */
ui.Glass.prototype.resizeGlass_ = function() {
  var height = goog.style.getComputedStyle(document.documentElement, 'height');
  this.api_ && this.api_.req(
      'ctrl.resizeGlass', {height: parseInt(height, 10)}).
      addErrback(this.displayFailure_, this);
};


/**
 * Renders the UI elements needed for requesting a passphrase for symmetrically
 * encrypting the current message.
 * @return {e2e.async.Result.<string>}
 * @private
 */
ui.Glass.prototype.renderPassphraseCallback_ = function() {
  var result = new e2e.async.Result;

  // TODO: put this in always-on-top overlay
  var passphraseDialog = new dialogs.Generic(
      chrome.i18n.getMessage('promptDecryptionPassphraseMessage'),
      goog.bind(function(passphrase) {
        goog.dispose(passphraseDialog);
        if (passphrase.length > 0) {
          result.callback(passphrase);
        }
      }, this),
      dialogs.InputType.SECURE_TEXT,
      '',
      chrome.i18n.getMessage('actionEnterPassphrase'),
      chrome.i18n.getMessage('actionCancelPgpAction'));
  this.renderDialog(passphraseDialog);

  return result;
};


/**
 * Renders the provided dialog into the panel.
 * @param {!dialogs.Generic} dialog The dialog to render.
 * @protected
 */
ui.Glass.prototype.renderDialog = function(dialog) {
  var popupElem = goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG);
  this.addChild(dialog, false);
  dialog.render(popupElem);
};


// /** @override */
// ui.Glass.prototype.enterDocument = function() {
//   goog.base(this, 'enterDocument');

//   var mouseWheelHandler = new goog.events.MouseWheelHandler(
//       this.getElement(), true);
//   this.registerDisposable(mouseWheelHandler);

//   this.getHandler().listen(
//       mouseWheelHandler,
//       goog.events.MouseWheelHandler.EventType.MOUSEWHEEL,
//       this.scroll_);
// };


// /**
//  * Scrolls the looking glass up/down.
//  * @param {goog.events.MouseWheelEvent} evt The mouse wheel event to
//  *     scroll up/down.
//  * @private
//  */
// ui.Glass.prototype.scroll_ = function(evt) {
//   var fieldset = this.getElement().querySelector('fieldset');
//   var position = goog.style.getPosition(fieldset);

//   var newY = position.y - evt.deltaY * 5;
//   // Set upper boundary.
//   newY = Math.min(0, newY);
//   // Set lower boundary.
//   newY = Math.max(window.innerHeight * -1, newY);

//   goog.style.setPosition(fieldset, 0, newY);
// };

});  // goog.scope
