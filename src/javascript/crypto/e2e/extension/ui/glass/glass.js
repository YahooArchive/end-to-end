/**
 * @license
 * Copyright 2015 Yahoo Inc. All rights reserved.
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

goog.require('e2e.async.Result');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
/** @suppress {extraRequire} manually import typedefs due to b/15739810 */
goog.require('e2e.ext.messages.ApiRequest');
goog.require('e2e.ext.ui.templates.glass');
goog.require('e2e.ext.utils');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.ui.Component');
goog.require('soy');


goog.scope(function() {
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;
var templates = e2e.ext.ui.templates.glass;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;



/**
 * Constructor for the looking glass.
 * @param {string} pgpMessage The encrypted PGP message that needs to be
 *     decrypted and displayed to the user.
 * @constructor
 * @extends {goog.ui.Component}
 */
ui.Glass = function(pgpMessage) {
  goog.base(this);

  /**
   * The encrypted PGP message that needs to be decrypted and displayed to
   * the user.
   * @type {string}
   * @private
   */
  this.pgpMessage_ = pgpMessage;


  /**
   * The passphrase required for per message passphrase decryption.
   * @type {string|undefined}
   * @private
   */
  this.decryptPassphrase_ = undefined;
};
goog.inherits(ui.Glass, goog.ui.Component);


/** @override */
ui.Glass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    content: this.pgpMessage_,
    action: constants.Actions.DECRYPT_VERIFY_RICH_INFO,
    decryptPassphrase: this.decryptPassphrase_
  }),
  goog.bind(function(response) {
    // renderPassphraseCallback if decryptPassphrase is needed
    if (response.error === chrome.i18n.getMessage('actionEnterPassphrase')) {
      this.renderPassphraseCallback().addCallback(function(passphrase) {
        if (passphrase) {
          this.decryptPassphrase_ = passphrase;
          this.decorateInternal(elem);
        } else {
          response.error = chrome.i18n.getMessage(
              'passphraseIncorrectWarning');

          this.renderContents_(response);
        }
      }, this);
      return;
    }

    // If the response has no content, show an undecryptable error if
    // the error message is missing for some reason.
    if (!response.error) {
      if (response.content) {
        // decode rich info from Actions.DECRYPT_VERIFY_RICH_INFO
        try {
          var json = JSON.parse(response.content);
          response.content = json[0];
          response.wasEncrypted = json[1];
          response.isVerified = json[2];
        } catch (ex) {}
      } else {
        response.error = chrome.i18n.getMessage('glassCannotDecrypt');
      }
    }

    this.renderContents_(response);
    this.renderIcons_(response);
  }, this));
};


/**
 * Renders the contents of the looking glass.
 * @return {e2e.async.Result.<string>}
 */
ui.Glass.prototype.renderPassphraseCallback = function() {
  var result = new e2e.async.Result;
  // TODO: make this look good
  window.setTimeout(goog.bind(function() {
    this.callback(window.prompt(
        chrome.i18n.getMessage('actionEnterPassphrase')));
  }, result), 1);
  return result;
};


/**
 * Renders the contents of the looking glass.
 * @param {messages.ApiResponse} response The response from the extension to
 *     render.
 * @private
 */
ui.Glass.prototype.renderContents_ = function(response) {
  var elem = this.getElement();

  soy.renderElement(elem, templates.contentFrame, {
    label: chrome.i18n.getMessage('extName'),
    content: response.content || this.pgpMessage_,
    error: response.error
  });

  // waits for style and height to settle, then resize the iframe.
  window.setTimeout(function() {
    utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
      action: constants.Actions.SET_GLASS_SIZE,
      content: {
        height: window.document.querySelector('fieldset').offsetHeight +
            Math.floor(Math.random() * 18)
      }
    }));
  }, 100);
};


/**
 * Renders the icons of the looking glass.
 * @param {messages.ApiResponse} response The response from the extension to
 *     render.
 * @private
 */
ui.Glass.prototype.renderIcons_ = function(response) {
  if (response.error) {
    return;
  }

  if (response.wasEncrypted) {
    goog.dom.classlist.remove(
        goog.dom.getElement(constants.ElementId.LOCK_ICON),
        constants.CssClass.HIDDEN);
  }

  if (response.isVerified) {
    goog.dom.classlist.remove(
        goog.dom.getElement(constants.ElementId.CHECK_ICON),
        constants.CssClass.HIDDEN);
  }
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
