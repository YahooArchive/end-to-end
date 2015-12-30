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
 * @fileoverview The launcher for the End-To-End extension. Establishes
 * communication with the content scripts. Instantiates the required UI bits
 * that allow the user to interact with the extension.
 */

goog.provide('e2e.ext.yExtensionLauncher');
goog.require('e2e.ext.ExtensionLauncher');

goog.require('e2e.ext.Preferences');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.utils.action');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.Context');
goog.require('e2e.openpgp.ContextImpl');
goog.require('goog.array');

goog.scope(function() {
var ext = e2e.ext;
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;



/**
 * Constructor to use in End-To-End Chrome extension.
 * @param {!e2e.openpgp.Context} pgpContext The OpenPGP context to use.
 * @param {!goog.storage.mechanism.IterableMechanism} preferencesStorage Storage
 * mechanism for user preferences.
 * @constructor
 * @extends {ext.ExtensionLauncher}
 */
ext.yExtensionLauncher = function(pgpContext, preferencesStorage) {
  /**
   * The ID of the last used tab.
   * @type {number}
   * @private
   */
  this.lastTabId_ = window.NaN;

  ext.yExtensionLauncher.base(this, 'constructor', pgpContext,
      preferencesStorage);
};
goog.inherits(ext.yExtensionLauncher, ext.ExtensionLauncher);


/** @override */
ext.yExtensionLauncher.prototype.start = function(opt_passphrase) {

  // All ymail tabs need to be reloaded for the e2ebind API to work
  e2e.ext.utils.action.refreshYmail();

  return goog.base(this, 'start', opt_passphrase).addCallback(function(){

    // add message listener
    chrome.runtime.onMessage.addListener(goog.bind(function(message, sender) {
      this.proxyMessage(message, sender);
    }, this));

  }, this);
};


/**
 * Stops the launcher. Called to lock keyring in extension/ui/prompt/prompt.js
 */
ext.yExtensionLauncher.prototype.stop = function() {
  this.started_ = false;
  // Unset the passphrase on the keyring
  // TODO: add unsetKeyringPassphrase() into Context
  this.getContext().keyring_ = null;
  // Remoeve the API
  this.ctxApi_.removeApi();
  this.updatePassphraseWarning();
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.reload(tabId);
  }, this));
};


/** @override */
ext.yExtensionLauncher.prototype.showWelcomeScreen = function() {
  var preferences = this.getPreferences();
  if (preferences.isWelcomePageEnabled()) {
    this.createWindow('setup.html', true, goog.nullFunction);
    preferences.setWelcomePageEnabled(false);
  }
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
 * @export
 */
ext.yExtensionLauncher.prototype.updateSelectedContent =
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
 * @export
 */
ext.yExtensionLauncher.prototype.getSelectedContent = function(callback) {
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.sendMessage(tabId, {
      editableElem: true,
      enableLookingGlass: this.getPreferences().isLookingGlassEnabled(),
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
ext.yExtensionLauncher.prototype.getActiveTab_ = function(callback, opt_runHelper) {
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
    if (e2e.ext.utils.text.isYmailOrigin(tab.url) || !runHelper) {
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
 * Proxies a message to the active tab.
 * @param {messages.proxyMessage} incoming
 * @param {!MessageSender} sender
 */
ext.yExtensionLauncher.prototype.proxyMessage = function(incoming, sender) {
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
* Executes an action from a proxy request.
* @param {messages.proxyMessage} args The message request
* @param {number} tabId The ID of the active tab
* @return {?(messages.proxyMessage|messages.BridgeMessageResponse|
*           messages.GetSelectionRequest)}
* @private
*/
ext.yExtensionLauncher.prototype.executeRequest_ = function(args, tabId) {
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
      enableLookingGlass: this.getPreferences().isLookingGlassEnabled()
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

});  // goog.scope
