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
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
/** @suppress {extraRequire} manually import typedefs due to b/15739810 */
goog.require('e2e.ext.messages.ApiRequest');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.templates.glass');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.Error');
goog.require('e2e.ext.utils.action');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.string');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('goog.ui.KeyboardShortcutHandler');
goog.require('goog.userAgent');
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
 * @param {!e2e.openpgp.ArmoredMessage} armor The encrypted PGP message that
 *     needs to be decrypted and displayed to the user.
 * @param {!e2e.ext.MessageApi} api The Message API
 * @constructor
 * @extends {goog.ui.Component}
 */
ui.Glass = function(armor, api) {
  goog.base(this);

  /**
   * The encrypted PGP message that needs to be decrypted and displayed to
   * the user.
   * @type {!e2e.openpgp.ArmoredMessage}
   * @private
   */
  this.armor_ = armor;

  /**
   * The message API instance
   * @type {!e2e.ext.MessageApi}
   * @private
   */
  this.api_ = api;
};
goog.inherits(ui.Glass, goog.ui.Component);


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.Glass.prototype.displayFailure_ = function(error) {
  //@yahoo hide the loading icon
  var bodyElem = goog.dom.getElement(constants.ElementId.BODY);
  bodyElem.classList.remove(constants.CssClass.LOADER);

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

  this.resizeGlass_();
};


/** @override */
ui.Glass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  soy.renderElement(elem, templates.contentFrame, {
    content: this.armor_.text || 'invalid pgp format'
  });
};


/** @override */
ui.Glass.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // @yahoo display the loading icon
  var bodyElem = goog.dom.getElement(constants.ElementId.BODY);
  bodyElem.classList.add(constants.CssClass.LOADER);

  this.renderSelectedContent_();

  // @yahoo added shortcut keys
  var elem = this.getElement(),
      sHandler = goog.ui.KeyboardShortcutHandler,
      userAgentModifier = goog.userAgent.MAC ?
          sHandler.Modifiers.META :
          sHandler.Modifiers.CTRL,
      keyboardHandler = new goog.ui.KeyboardShortcutHandler(elem);

  goog.array.forEach(this.getShortcuts(), function(key) {
    keyboardHandler.registerShortcut(key.id, key.keyCode,
        (key.meta ? userAgentModifier : sHandler.Modifiers.NONE) +
            (key.shift ? sHandler.Modifiers.SHIFT : sHandler.Modifiers.NONE) +
            (key.ctrl ? sHandler.Modifiers.CTRL : sHandler.Modifiers.NONE));
  });

  this.getHandler().listen(
      keyboardHandler,
      sHandler.EventType.SHORTCUT_TRIGGERED,
      goog.bind(this.handleKeyEvent_, this));

  if (window) {
    //@yahoo resize the glass when window is resized
    utils.listenThrottledEvent(window, goog.events.EventType.RESIZE,
        goog.bind(this.resizeGlass_, this));

    goog.events.listen(window,
        goog.events.EventType.FOCUS,
        goog.bind(this.handleKeyEvent_, this));
  }
};


/**
 * The shortcut keys to capture
 * @return {Array.<{id:string, keyCode: number, meta: boolean, shift: boolean,
 *     ctrl: boolean, save: boolean}>}
 */
ui.Glass.prototype.getShortcuts = function() {
  return [
    {id: 'prevTab', keyCode: goog.events.KeyCodes.OPEN_SQUARE_BRACKET},
    {id: 'nextTab', keyCode: goog.events.KeyCodes.CLOSE_SQUARE_BRACKET},

    {id: 'prevCov', keyCode: goog.events.KeyCodes.COMMA, ctrl: true},
    {id: 'nextCov', keyCode: goog.events.KeyCodes.PERIOD, ctrl: true},
    {id: 'prevCov', keyCode: goog.events.KeyCodes.LEFT},
    {id: 'nextCov', keyCode: goog.events.KeyCodes.RIGHT},
    {id: 'archiveCov', keyCode: goog.events.KeyCodes.E},
    {id: 'moveCov', keyCode: goog.events.KeyCodes.D},
    {id: 'moveToCov', keyCode: goog.events.KeyCodes.D, shift: true},
    {id: 'deleteCov', keyCode: goog.events.KeyCodes.DELETE},
    {id: 'replyCov', keyCode: goog.events.KeyCodes.R, shift: true},
    {id: 'replyallCov', keyCode: goog.events.KeyCodes.A, shift: true},
    {id: 'forwardCov', keyCode: goog.events.KeyCodes.F, shift: true},
    {id: 'unreadCov', keyCode: goog.events.KeyCodes.K, shift: true},
    {id: 'flagCov', keyCode: goog.events.KeyCodes.L, shift: true},
    {id: 'closeCov', keyCode: goog.events.KeyCodes.ESC},

    {id: 'prev', keyCode: goog.events.KeyCodes.COMMA},
    {id: 'next', keyCode: goog.events.KeyCodes.PERIOD},

    {id: 'display', keyCode: goog.events.KeyCodes.ENTER},
    {id: 'display', keyCode: goog.events.KeyCodes.SPACE},
    {id: 'reply', keyCode: goog.events.KeyCodes.R},
    {id: 'replyall', keyCode: goog.events.KeyCodes.A},
    {id: 'forward', keyCode: goog.events.KeyCodes.F},
    {id: 'unread', keyCode: goog.events.KeyCodes.K},
    {id: 'flag', keyCode: goog.events.KeyCodes.L},

    {id: 'inbox', keyCode: goog.events.KeyCodes.M},
    {id: 'inbox', keyCode: goog.events.KeyCodes.M, shift: true},
    {id: 'compose', keyCode: goog.events.KeyCodes.N},
    {id: 'settings', keyCode: goog.events.KeyCodes.SEMICOLON},
    {id: 'newfolder', keyCode: goog.events.KeyCodes.E, meta: true, shift: true}
    // {id: 'voiceOn', keyCode: goog.events.KeyCodes.L,
    //   meta: true, shift: true},
    // {id: 'voiceOff', keyCode: goog.events.KeyCodes.X,
    //   meta: true, shift: true}
  ];
};


/**
 * Handles keyboard events for shortcut keys //@yahoo
 * @param {goog.ui.KeyboardShortcutEvent} evt The keyboard event to handle.
 * @private
 */
ui.Glass.prototype.handleKeyEvent_ = function(evt) {
  var args = evt.identifier ? {keyId: evt.identifier} : undefined;
  this.api_.req('ctrl.shortcut', args).addErrback(this.displayFailure_, this);
};


/**
 * Loads the content for decryption and verification
 * @param {string=} opt_decryptPassphrase The per message decryption passphrase
 * @private
 */
ui.Glass.prototype.renderSelectedContent_ = function(opt_decryptPassphrase) {
  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    content: this.armor_.text,
    action: constants.Actions.DECRYPT_THEN_VERIFY,
    decryptPassphrase: opt_decryptPassphrase
  }),
  goog.bind(function(response) {

    // If the response has no content, show an undecryptable error if
    // the error message is missing for some reason.
    if (!goog.isDef(response.content)) {
      this.displayFailure_(new utils.Error(
          'decryption failed', 'glassCannotDecrypt'));
      return;
    }

    var result = response.content,
        verifyResultId = result.verifyResultId;

    this.setContent_(result);
    this.setEncryptrMessage_(result);

    // make a second call for verification result
    if (verifyResultId) {
      utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
        content: verifyResultId,
        action: constants.Actions.VERIFY,
        decryptPassphrase: opt_decryptPassphrase
      }), goog.bind(function(response) {
        this.setEncryptrMessage_(response.content);
      }, this), goog.bind(this.renderPassphraseAndError_, this));
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
  var bodyElem = goog.dom.getElement(constants.ElementId.BODY);
  bodyElem.classList.remove(constants.CssClass.LOADER);
  bodyElem.textContent = result.decrypt.text;

  this.resizeGlass_();
};


/**
 * Renders the UI elements needed for displaying the decryption and signature
 * information
 * @param {e2e.openpgp.VerifiedDecrypt} result
 * @private
 */
ui.Glass.prototype.setEncryptrMessage_ = function(result) {
  var encryptrIcon = goog.dom.getElement(constants.ElementId.ENCRYPTR_ICON);
  var encryptrMsg = encryptrIcon.querySelector('div');
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
        encryptrIcon.classList.add(constants.CssClass.HIDDEN);
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
  this.api_.req('ctrl.resizeGlass', {height: height}).
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
