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
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.templates.panels.generatekey');
goog.require('e2e.ext.utils.action'); //@yahoo
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.string'); //@yahoo
goog.require('goog.ui.Component');
goog.require('goog.ui.KeyboardShortcutHandler');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var panels = e2e.ext.ui.panels;
var templates = e2e.ext.ui.templates.panels.generatekey;



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
  elem.id = constants.ElementId.GENERATE_KEY_FORM;

  var genKeyEmailLabel = goog.string.htmlEscape(
      chrome.i18n.getMessage('genKeyEmailLabel'));
  genKeyEmailLabel = genKeyEmailLabel.
      replace(/\n/g, '<br>').
      replace(/#email#([^#]*)#/,
          '<span id="' + constants.ElementId.EMAIL_ADDRESS + '">$1</span>').
      replace(/#import#([^#]*)#/,
          '<label for="' + constants.ElementId.KEYRING_IMPORT +
          '">$1</label>');

  soy.renderElement(elem, templates.generateKeyForm, {
    sectionTitle: this.sectionTitle_,
    emailLabel: soydata.VERY_UNSAFE.ordainSanitizedHtml(genKeyEmailLabel),
    commentsLabel: chrome.i18n.getMessage('genKeyCommentsLabel'),
    actionButtonTitle: this.actionButtonTitle_,
    signupCancelButtonTitle: chrome.i18n.getMessage('actionCancelPgpAction')
  });
};


/** @override */
panels.GenerateKey.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  //@yahoo Prefill the input with the user's email if possible
  e2e.ext.utils.action.getUserYmailAddress(goog.bind(function(email) {
    var input = this.getElementByClass(constants.CssClass.EMAIL);
    if (input && email) {
      input.value = email;
    }

    var elem = goog.dom.getElement(constants.ElementId.EMAIL_ADDRESS);
    if (elem && email) {
      elem.innerText = email;
    }

  }, this));

  var keyboardHandler = new goog.ui.KeyboardShortcutHandler(
      this.getElementByClass(constants.CssClass.EMAIL));
  keyboardHandler.registerShortcut('enter', goog.events.KeyCodes.ENTER);
  this.getHandler().
      listen(
          this.getElementByClass(constants.CssClass.ACTION),
          goog.events.EventType.CLICK,
          this.generate_).
      listen(
          this.getElementByClass(constants.CssClass.CANCEL),
          goog.events.EventType.CLICK,
          this.hideSignupForm_).
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
  var inputs = this.getElement().querySelectorAll('input');
  goog.array.forEach(inputs, function(input) {
    input.value = '';
  });
};


/**
 * Hides the signup form.
 * @private
 */
panels.GenerateKey.prototype.hideSignupForm_ = function() {
  var signupForm = goog.dom.getElement(
      e2e.ext.constants.ElementId.GENERATE_KEY_FORM);
  var cancelButton = goog.dom.getElementByClass(
      e2e.ext.constants.CssClass.CANCEL, signupForm);
  var signupPrompt = goog.dom.getElement(
      e2e.ext.constants.ElementId.SIGNUP_PROMPT);
  var keyringOptions = goog.dom.getElement(
      e2e.ext.constants.ElementId.KEYRING_OPTIONS_DIV);

  goog.dom.classlist.add(signupForm, e2e.ext.constants.CssClass.HIDDEN);
  goog.dom.classlist.add(cancelButton, e2e.ext.constants.CssClass.HIDDEN);
  goog.dom.classlist.remove(signupPrompt, e2e.ext.constants.CssClass.HIDDEN);
  goog.dom.classlist.remove(keyringOptions, e2e.ext.constants.CssClass.HIDDEN);

};


});  // goog.scope
