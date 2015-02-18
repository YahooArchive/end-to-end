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
 * @fileoverview Provides the UI elements to generate a new PGP key.
 */

goog.provide('e2e.ext.ui.panels.GenerateKey');

goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.keyserver');
goog.require('e2e.ext.ui.templates.panels.generatekey');
goog.require('e2e.ext.utils.text');
goog.require('goog.array');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.ui.Component');
goog.require('goog.ui.KeyboardShortcutHandler');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var panels = e2e.ext.ui.panels;
var templates = e2e.ext.ui.templates.panels.generatekey;
var utils = e2e.ext.utils;



/**
 * Constructor for the UI component that provides the form to generate new PGP
 * keys.
 * @param {!function(...)} callback The callback to invoke when a new PGP key is
 *     to be generated.
 * @param {boolean=} opt_hideTitle Optional. A flag to control the display of
 *     the section title. If true, the section title will not be displayed.
 *     Defaults to false.
 * @param {string=} opt_actionBtnTitle Optional. The title for the action
 *     button. Uses extension defaults if not specified.
 * @constructor
 * @extends {goog.ui.Component}
 */
panels.GenerateKey = function(callback, opt_hideTitle, opt_actionBtnTitle) {
  goog.base(this);

  /**
   * The callback to invoke when a new PGP key is to be generated.
   * @type {!function(...)}
   * @private
   */
  this.callback_ = callback;

  /**
   * The keyserver client component associated with this panel.
   * @type {!e2e.ext.keyserver.Client}
   * @private
   */
  this.keyserverClient_ =
      new e2e.ext.keyserver.Client(constants.Keyserver.DEFAULT_LOCATION);

  /**
   * The title for the generate key section. If empty, it will not be displayed.
   * @type {string}
   * @private
   */
  this.sectionTitle_ = Boolean(opt_hideTitle) ?
      '' : chrome.i18n.getMessage('genKeyTitle');

  /**
   * The title for the action button.
   * @type {string}
   * @private
   */
  this.actionButtonTitle_ =
      opt_actionBtnTitle || chrome.i18n.getMessage('genKeyGenerateButtonLabel');
};
goog.inherits(panels.GenerateKey, goog.ui.Component);


/** @override */
panels.GenerateKey.prototype.createDom = function() {
  goog.base(this, 'createDom');
  this.decorateInternal(this.getElement());
};


/** @override */
panels.GenerateKey.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  soy.renderElement(elem, templates.generateKeyForm, {
    sectionTitle: this.sectionTitle_,
    emailLabel: chrome.i18n.getMessage('genKeyEmailLabel'),
    commentsLabel: chrome.i18n.getMessage('genKeyCommentsLabel'),
    actionButtonTitle: this.actionButtonTitle_
  });
};


/** @override */
panels.GenerateKey.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  var keyboardHandler = new goog.ui.KeyboardShortcutHandler(
      this.getElementByClass(constants.CssClass.EMAIL));
  keyboardHandler.registerShortcut('enter', goog.events.KeyCodes.ENTER);
  this.getHandler().
      listen(
          this.getElementByClass(constants.CssClass.ACTION),
          goog.events.EventType.CLICK,
          this.generate_).
      listen(
          keyboardHandler,
          goog.ui.KeyboardShortcutHandler.EventType.SHORTCUT_TRIGGERED,
          this.generate_);
};


/**
 * Generates a new PGP key using the information provided by the user.
 * @private
 */
panels.GenerateKey.prototype.generate_ = function() {
  this.clearFailure_();
  var name = '';
  var email = this.getElementByClass(constants.CssClass.EMAIL).value;
  var comments = '';

  // TODO(radi): Add a mechanism to allow the user to adjust this.
  var expDate = Math.floor(new Date('9999/12/31').getTime() / 1e3);

  this.callback_(this, name, email, comments, expDate);
};


/**
 * Resets the key generation form.
 */
panels.GenerateKey.prototype.reset = function() {
  this.clearFailure_();
  var inputs = this.getElement().querySelectorAll('input');
  goog.array.forEach(inputs, function(input) {
    input.value = '';
  });
};


/**
 * Sends an OpenPGP public key(s) to the keyserver.
 * @param {!e2e.openpgp.Keys} keys
 * @param {function(string)} callback
 * @param {e2e.openpgp.ContextImpl} ctx
 */
panels.GenerateKey.prototype.sendKeys = function(keys, callback, ctx) {
  goog.array.forEach(keys, goog.bind(function(key) {
    if (!key.key.secret) {
      var email = utils.text.extractValidYahooEmail(key.uids[0]);
      if (email) {
        try {
          this.keyserverClient_.sendKey(email, key.serialized, goog.bind(
              function(response) {
                this.keyserverClient_.cacheKeyData(response);
                callback(response);
                window.alert('successfully registered key: ' +
                             response);
              }, this),
              goog.bind(function() {
                // The key wasn't sent to the server, so delete it for now.
                // TODO: Separate key generation and import to keyring.
                if (ctx !== null) {
                  ctx.deleteKey(key.uids[0]);
                }
                this.displayFailure_(
                    new e2e.ext.keyserver.AuthError(
                        chrome.i18n.getMessage('keyserverSendError')));
              }, this));
        } catch (e) {
          console.error('got key send failure in generate key', email);
          this.displayFailure_(e);
        }
      }
    }
  }, this));
};


/**
 * Displays error message.
 * @param {Error} error The error to display.
 * @private
 */
panels.GenerateKey.prototype.displayFailure_ = function(error) {
  var errorDiv = this.getElement().getElementsByClassName(
      constants.CssClass.ERROR)[0];
  if (error) {
    var errorMsg = goog.isDef(error.messageId) ?
        chrome.i18n.getMessage(error.messageId) : error.message;
    utils.errorHandler(error);
    if (errorDiv) {
      errorDiv.textContent = errorMsg;
    } else {
      // The errorDiv might be destroyed by the time displayFailure_ fires
      window.alert('Error: ' + errorMsg);
    }
  } else if (errorDiv) {
    errorDiv.textContent = '';
  }
};


/**
 * Clears error messages.
 * @private
 */
panels.GenerateKey.prototype.clearFailure_ = function() {
  this.displayFailure_(null);
};

});  // goog.scope
