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
 * @fileoverview Provides the UI that allows the user to interact with the
 * extension. Handles all main use cases: import key, encrypt/sign,
 * decrypt/verify.
 */

goog.provide('e2e.ext.ui.Prompt');

goog.require('e2e.ext.actions.Executor');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
goog.require('e2e.ext.ui.templates.prompt');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.action');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.positioning.Corner');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.PopupMenu');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var dialogs = e2e.ext.ui.dialogs;
var ext = e2e.ext;
var messages = e2e.ext.messages;
var templates = e2e.ext.ui.templates.prompt;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;



/**
 * Constructor for the UI prompt.
 * @constructor
 * @extends {goog.ui.Component}
 */
ui.Prompt = function() {
  goog.base(this);

  /**
   * Executor for the End-to-End actions.
   * @type {!e2e.ext.actions.Executor}
   * @private
   */
  this.actionExecutor_ = new e2e.ext.actions.Executor(
      goog.bind(this.displayFailure_, this));

  /**
   * The End-to-End actions that the user can select in the prompt UI.
   * @type {!Array.<!Object.<constants.Actions,string>>}
   * @private
   */
  // @yahoo
  this.selectableActions_ = [{
    value: constants.Actions.CONFIGURE_EXTENSION,
    title: chrome.i18n.getMessage('actionConfigureExtension')
  }, {
    value: constants.Actions.LOCK_KEYRING,
    title: chrome.i18n.getMessage('actionLockKeyring')
  }];
};
goog.inherits(ui.Prompt, goog.ui.Component);


/**
 * The extension's launcher. Needed for providing the passphrase to the user's
 * private key.
 * @type {ext.Launcher}
 * @private
 */
ui.Prompt.prototype.pgpLauncher_ = null;


/** @override */
ui.Prompt.prototype.disposeInternal = function() {
  goog.base(this, 'disposeInternal');

  this.close();
};


/** @override */
ui.Prompt.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  soy.renderElement(elem, templates.main, {
    extName: chrome.i18n.getMessage('extName'),
    menuLabel: chrome.i18n.getMessage('actionOpenMenu')
  });

  var styles = elem.querySelector('link');
  styles.href = chrome.runtime.getURL('prompt_styles.css');

  utils.action.getLauncher(function(launcher) {
    this.pgpLauncher_ = launcher || this.pgpLauncher_;
    this.processSelectedContent_();
  }, this.displayFailure_, this);
};


/** @override */
ui.Prompt.prototype.getContentElement = function() {
  return goog.dom.getElement(constants.ElementId.BODY);
};


/**
 * //@yahoo shows a menu instead of the compose/decrypt window
 * Process the retrieved content blob and display it into the prompt UI.
 * @param {constants.Actions=} opt_action Optional. The PGP action to perform.
 *     Defaults to user-specified.
 * @private
 */
ui.Prompt.prototype.processSelectedContent_ =
    function(opt_action) {
  var action = opt_action || ext.constants.Actions.USER_SPECIFIED;

  if (action !== ext.constants.Actions.GET_PASSPHRASE) {
    // Show the "wrong passphrase" message if the action is GET_PASSPHRASE
    this.clearFailure_();
    if (!this.pgpLauncher_.hasPassphrase()) {
      this.processSelectedContent_(ext.constants.Actions.GET_PASSPHRASE);
      return;
    }
  }

  var elem = goog.dom.getElement(constants.ElementId.BODY);
  var title = goog.dom.getElement(constants.ElementId.TITLE);
  title.textContent = this.getTitle_(action) || title.textContent;
  switch (action) {
    case constants.Actions.GET_PASSPHRASE:
      this.renderKeyringPassphrase_(elem);
      break;
    case constants.Actions.USER_SPECIFIED:
      var menuContainer =
          goog.dom.getElement(constants.ElementId.MENU_CONTAINER);
      goog.dom.classlist.add(menuContainer, constants.CssClass.HIDDEN);
      this.renderMenu_();
      break;
    case constants.Actions.CONFIGURE_EXTENSION:
      chrome.tabs.create({
        url: 'settings.html',
        active: false
      }, goog.nullFunction);
      break;
    case constants.Actions.LOCK_KEYRING:
      this.pgpLauncher_.stop();
      break;
    case constants.Actions.NO_OP:
      this.close();
  }
};


/**
 * Renders the main menu.
 * @private
 */
ui.Prompt.prototype.renderMenu_ = function() {
  var menu = new goog.ui.PopupMenu();
  goog.array.forEach(this.selectableActions_, function(action) {
    var menuItem = new goog.ui.MenuItem(action.title);
    menuItem.setValue(action.value);
    menu.addChild(menuItem, true);
  });
  this.addChild(menu, false);
  menu.render(goog.dom.getElement(constants.ElementId.BODY));

  this.getHandler().listen(
      menu,
      goog.ui.Component.EventType.ACTION,
      this.selectAction_);

  var menuContainer = goog.dom.getElement(constants.ElementId.MENU_CONTAINER);
  if (goog.dom.classlist.contains(menuContainer, constants.CssClass.HIDDEN)) {
    goog.dom.classlist.remove(menu.getElement(), 'goog-menu');
    goog.style.setStyle(menu.getElement(), {
      'display': 'block',
      'outline': 'none',
      'position': 'relative',
      'top': '-10px'
    });
  } else {
    menu.attach(
        menuContainer,
        goog.positioning.Corner.TOP_LEFT,
        goog.positioning.Corner.BOTTOM_LEFT);
  }
};


/**
 * Renders the UI elements needed for requesting the passphrase of the PGP
 * keyring.
 * @param {Element} elem The element into which the UI elements are to be
 *     rendered.
 * @private
 */
ui.Prompt.prototype.renderKeyringPassphrase_ = function(elem) {
  var dialog = new dialogs.Generic(
      '',
      goog.bind(function(passphrase) {
        try {
          // Correct passphrase entered.
          this.pgpLauncher_.start(passphrase);
          this.processSelectedContent_();
          this.close();
        } catch (e) { // Incorrect passphrase, so ask again.
          this.displayFailure_(
              new Error(chrome.i18n.getMessage('passphraseIncorrectWarning')));
          this.processSelectedContent_(
              ext.constants.Actions.GET_PASSPHRASE);
        }
        goog.dispose(dialog);
      }, this),
      // Use a password field to ask for the passphrase.
      dialogs.InputType.SECURE_TEXT,
      chrome.i18n.getMessage('actionEnterPassphraseDescription'),
      chrome.i18n.getMessage('actionEnterPassphrase'));

  elem.textContent = '';
  this.addChild(dialog, false);
  dialog.render(elem);
  goog.dom.classlist.remove(elem, constants.CssClass.TRANSPARENT);
};


/**
 * Closes the prompt.
 */
ui.Prompt.prototype.close = function() {
  goog.dispose(this);

  // Clear all input and text area fields to ensure that no data accidentally
  // leaks to the user.
  goog.array.forEach(
      document.querySelectorAll('textarea,input'), function(elem) {
        elem.value = '';
      });

  window.close();
};


/**
 * Returns the i18n title for the given PGP action.
 * @param {constants.Actions} action The PGP action that the user has
 *     requested.
 * @return {string} The i18n title.
 * @private
 */
ui.Prompt.prototype.getTitle_ = function(action) {
  switch (action) {
    case ext.constants.Actions.USER_SPECIFIED:
      return chrome.i18n.getMessage('actionUserSpecified');
    case ext.constants.Actions.GET_PASSPHRASE:
      return chrome.i18n.getMessage('actionUnlockKeyring');
  }

  return '';
};


/**
 * Enables the user to select the PGP action they'd like to execute.
 * @param {!goog.events.Event} evt The event generated by the user's
 *     selection.
 * @private
 */
ui.Prompt.prototype.selectAction_ = function(evt) {
  var menuContainer = goog.dom.getElement(constants.ElementId.MENU_CONTAINER);
  // goog.dom.classlist.remove(menuContainer, constants.CssClass.HIDDEN);
  this.removeChildren();

  this.processSelectedContent_(
      /** @type {constants.Actions} */ (evt.target.getValue()));
};


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.Prompt.prototype.displayFailure_ = function(error) {
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
ui.Prompt.prototype.clearFailure_ = function() {
  this.displayFailure_(null);
};


});  // goog.scope
