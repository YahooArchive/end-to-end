/**
 * @license
 * Copyright 2013 Google Inc. All rights reserved.
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
 * @fileoverview The launcher for the End-To-End extension. Establishes
 * communication with the content scripts. Instantiates the required UI bits
 * that allow the user to interact with the extension.
 */

goog.provide('e2e.ext.Launcher');

goog.require('e2e.ext.api.Api');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.ui.preferences');
goog.require('e2e.ext.utils.action');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.Context');
goog.require('e2e.openpgp.ContextImpl');
goog.require('goog.array');

goog.scope(function() {
var ext = e2e.ext;
var preferences = e2e.ext.ui.preferences;
var utils = e2e.ext.utils;
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;



/**
 * Constructor for the End-To-End extension launcher.
 * @constructor
 */
ext.Launcher = function() {
  /**
   * The ID of the last used tab.
   * @type {number}
   * @private
   */
  this.lastTabId_ = window.NaN;

  /**
   * The PGP context used by the extension.
   * @type {e2e.openpgp.Context}
   * @private
   */
  this.pgpContext_ = new e2e.openpgp.ContextImpl();

  /**
   * The context API that the rest of the extension can use to communicate with
   * the PGP context.
   * @type {!ext.api.Api}
   * @private
   */
  this.ctxApi_ = new ext.api.Api();

  /**
   * Whether the launcher was started correctly.
   * @type {boolean}
   * @private
   */
  this.started_ = false;
};


/**
 * Sets the provided content into the element on the page that the user has
 * selected.
 * Note: This function might not work while debugging the extension.
 * @param {string} content The content to write inside the selected element.
 * @param {!Array.<string>} recipients The recipients of the message.
 * @param {string} origin The web origin where the original message was created.
 * @param {boolean} expectMoreUpdates True if more updates are expected. False
 *     if this is the final update to the selected content.
 * @param {!function(...)} callback The function to invoke once the content has
 *     been updated.
 * @param {string=} opt_subject The subject of the message if applicable.
 * @expose
 */
ext.Launcher.prototype.updateSelectedContent =
    function(content, recipients, origin, expectMoreUpdates,
             callback, opt_subject) {
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.sendMessage(tabId, {
      value: content,
      response: true,
      detach: !Boolean(expectMoreUpdates),
      origin: origin,
      recipients: recipients,
      subject: opt_subject
    });
    callback();
  }, this), true);
};


/**
 * Retrieves the content that the user has selected.
 * @param {!function(...)} callback The callback where the selected content will
 *     be passed.
 * @expose
 */
ext.Launcher.prototype.getSelectedContent = function(callback) {
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.sendMessage(tabId, {
      editableElem: true,
      enableLookingGlass: preferences.isLookingGlassEnabled(),
      hasDraft: false
    }, callback);
  }, this), true);
};


/**
 * Finds the current active tab.
 * @param {!function(...)} callback The function to invoke once the active tab
 *     is found.
 * @param {boolean=} opt_runHelper Whether the helper script must be run first.
 * @private
 */
ext.Launcher.prototype.getActiveTab_ = function(callback, opt_runHelper) {
  var runHelper = opt_runHelper || false;
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, goog.bind(function(tabs) {
    var tab = tabs[0];
    if (!goog.isDef(tab)) {
      // NOTE(radi): In some operating systems (OSX, CrOS), the query will be
      // executed against the window holding the browser action. In such
      // situations we'll provide the last used tab.
      callback(this.lastTabId_);
      return;
    } else {
      this.lastTabId_ = tab.id;
    }

    // NOTE(yan): The helper script is executed automaticaly on ymail pages.
    if (utils.text.isYmailOrigin(tab.url) || !runHelper) {
      callback(tab.id);
    } else {
      try {
        chrome.tabs.executeScript(tab.id, {file: 'helper_binary.js'},
                                  function() {
                                    callback(tab.id);
                                  });
      } catch (e) {
        // chrome-extension:// tabs throw an error. Ignore.
        callback(tab.id);
      }
    }
  }, this));
};


/**
 * Asks for the keyring passphrase and start the launcher. Will throw an
 * exception if the password is wrong.
 * @param {string=} opt_passphrase The passphrase of the keyring.
 * @expose
 */
ext.Launcher.prototype.start = function(opt_passphrase) {
  this.start_(opt_passphrase || '');
};


/**
 * Starts the launcher.
 * @param {string} passphrase The passphrase of the keyring.
 * @private
 */
ext.Launcher.prototype.start_ = function(passphrase) {
  this.updatePassphraseWarning_();
  this.pgpContext_.setKeyRingPassphrase(passphrase);

  // All ymail tabs need to be reloaded for the e2ebind API to work
  utils.action.refreshYmail();

  if (goog.global.chrome &&
      goog.global.chrome.runtime &&
      goog.global.chrome.runtime.getManifest) {
    var manifest = chrome.runtime.getManifest();
    this.pgpContext_.setArmorHeader(
        'Version',
        manifest.name + ' v' + manifest.version);
  }
  this.ctxApi_.installApi();
  this.started_ = true;
  this.updatePassphraseWarning_();
  preferences.initDefaults();

  this.showWelcomeScreen_();

  chrome.runtime.onMessage.addListener(goog.bind(function(message, sender) {
    this.proxyMessage(message, sender);
  }, this));
};


/**
 * Proxies a message to the active tab.
 * @param {messages.proxyMessage} incoming
 * @param {!MessageSender} sender
 */
ext.Launcher.prototype.proxyMessage = function(incoming, sender) {
  if (incoming.proxy === true) {
    var message = /** @type {messages.proxyMessage} */ (incoming);
    this.getActiveTab_(goog.bind(function(tabId) {
      // Execute the action, then forward the response to the correct tab.
      var response = this.executeRequest_(message, tabId);
      if (response) {
        console.log('launcher proxying', response, tabId);
        chrome.tabs.sendMessage(tabId, response);
      }
    }, this));
  }
};


/**
 * Stops the launcher. Called to lock the keyring.
 */
ext.Launcher.prototype.stop = function() {
  this.started_ = false;
  // Unset the passphrase on the keyring
  this.pgpContext_.unsetKeyringPassphrase();
  // Remoeve the API
  this.ctxApi_.removeApi();
  this.updatePassphraseWarning_();
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.reload(tabId);
  }, this));
};


/**
* Executes an action from a proxy request.
* @param {messages.proxyMessage} args The message request
* @param {number} tabId The ID of the active tab
* @return {?(messages.proxyMessage|messages.BridgeMessageResponse|
*           messages.GetSelectionRequest)}
* @private
*/
ext.Launcher.prototype.executeRequest_ = function(args, tabId) {
  if (args.action === constants.Actions.GLASS_CLOSED ||
      args.action === constants.Actions.SET_GLASS_SIZE) {
    return /** @type {messages.proxyMessage} */ ({
      content: args.content,
      action: args.action
    });
  } else if (args.action === constants.Actions.SET_AND_SEND_DRAFT) {
    var content = args.content;
    return /** @type {messages.BridgeMessageResponse} */ ({
      value: content.value,
      response: content.response,
      detach: content.detach,
      origin: content.origin,
      recipients: content.recipients,
      subject: content.subject,
      from: content.from
    });
  } else if (args.action === constants.Actions.GET_SELECTED_CONTENT) {
    return /** @type {messages.GetSelectionRequest} */ ({
      editableElem: true,
      hasDraft: true,
      enableLookingGlass: preferences.isLookingGlassEnabled()
    });
  } else if (args.action === constants.Actions.CHANGE_PAGEACTION) {
    chrome.browserAction.setTitle({
      tabId: tabId,
      title: chrome.i18n.getMessage('composeGlassTitle')
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128-green.png'
    });
    return null;
  } else if (args.action === constants.Actions.RESET_PAGEACTION) {
    chrome.browserAction.setTitle({
      title: chrome.i18n.getMessage('extName'),
      tabId: tabId
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128.png'
    });
    return null;
  }
};


/**
 * Returns the PGP context used within the extension.
 * @return {e2e.openpgp.Context} The PGP context.
 * @expose
 */
ext.Launcher.prototype.getContext = function() {
  return this.pgpContext_;
};


/**
 * Indicates if the keyring was loaded with the correct passphrase.
 * @return {boolean} True if the keyring was loaded with the correct passphrase.
 * @expose
 */
ext.Launcher.prototype.hasPassphrase = function() {
  return this.started_;
};


/**
 * Display a warning to the user if there is no available passphrase to access
 * the keyring.
 * @private
 */
ext.Launcher.prototype.updatePassphraseWarning_ = function() {
  if (this.hasPassphrase()) {
    chrome.browserAction.setBadgeText({text: ''});
    chrome.browserAction.setTitle({
      title: chrome.i18n.getMessage('extName')
    });
  } else {
    chrome.browserAction.setBadgeText({text: '!'});
    chrome.browserAction.setTitle({
      title: chrome.i18n.getMessage('passphraseEmptyWarning')
    });
  }
};


/**
 * Shows the welcome screen to first-time users.
 * @private
 */
ext.Launcher.prototype.showWelcomeScreen_ = function() {
  if (preferences.isWelcomePageEnabled()) {
    window.open('setup.html');
    preferences.setWelcomePageEnabled(false);
  }
};


});  // goog.scope
