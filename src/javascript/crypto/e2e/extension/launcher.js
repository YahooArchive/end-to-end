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
goog.require('e2e.ext.ui.preferences');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.Context');
goog.require('e2e.openpgp.ContextImpl');
goog.require('goog.array');

goog.scope(function() {
var ext = e2e.ext;
var preferences = e2e.ext.ui.preferences;
var utils = e2e.ext.utils;



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
      enableLookingGlass: preferences.isLookingGlassEnabled()
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
  // Add listeners to change Browser Action state
  chrome.tabs.onActivated.addListener(goog.bind(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, goog.bind(function(tab) {
      if (utils.text.isYmailOrigin(tab.url)) {
        this.updateYmailBrowserAction_(activeInfo.tabId);
      } else {
        this.updatePassphraseWarning_();
      }
    }, this));
  }, this));
  chrome.tabs.onUpdated.addListener(goog.bind(function(tabId, changeInfo, tab) {
    if (utils.text.isYmailOrigin(tab.url)) {
      this.updateYmailBrowserAction_(tabId);
    } else {
      this.updatePassphraseWarning_();
    }
  }, this));

  this.pgpContext_.setKeyRingPassphrase(passphrase);
  this.installResponseHandler_();

  // All ymail tabs need to be reloaded for the e2ebind API to work
  chrome.tabs.query({url: 'https://*.mail.yahoo.com/*'}, function(tabs) {
    goog.array.forEach(tabs, function(tab) {
      chrome.tabs.reload(tab.id);
    });
  });

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
  preferences.initDefaults();

  this.showWelcomeScreen_();

  // Proxy requests between content scripts in the active tab
  chrome.runtime.onMessage.addListener(goog.bind(function(message, sender) {
    if (message.e2ebind || message.composeGlass) {
      console.log('launcher.js got message to proxy', message);
      this.getActiveTab_(goog.bind(function(tabId) {
        // Execute the action, then forward the response to the correct tab.
        this.executeRequest_(message, tabId, function(response) {
          if (message.e2ebind) {
            response.e2ebind = true;
          } else if (message.composeGlass) {
            response.composeGlass = true;
          }
          console.log('launcher.js sending', response);
          chrome.tabs.sendMessage(tabId, response);
        });
      }, this));
    }
  }, this));
};


/**
 * Stops the launcher. Called to lock the keyring.
 */
ext.Launcher.prototype.stop = function() {
  this.started_ = false;
  // Remove HTTP response modifier
  this.removeResponseHandler_();
  // Set the browseraction icon to red
  this.getActiveTab_(goog.bind(function(tabId) {
    this.updateYmailBrowserAction_(tabId);
    chrome.tabs.reload(tabId);
  }, this));
  // Remove the API
  this.ctxApi_.removeAPI();
  // Unset the passphrase on the keyring
  this.pgpContext_.unsetKeyringPassphrase();
};


/**
* Execute a message request on the PGP content, then forward the response.
* @param {Object} args - The args of this request. Always has at least an
*   action property.
* @param {number} tabId - The ID of the active tab
* @param {Function} callback - Function to call with the result.
* @private
*/
ext.Launcher.prototype.executeRequest_ = function(args, tabId, callback) {
  if (args.action === 'show_notification') {
    utils.showNotification(args.msg, function() {
      callback({});
    });
  } else if (args.action === 'popup_closed') {
    callback({popup_closed: true});
  } else if (args.action === 'glass_closed') {
    callback({
      glass_closed: true,
      hash: args.hash
    });
  } else if (args.action === 'set_draft') {
    callback({
      value: args.value,
      response: args.response,
      detach: args.detach,
      origin: args.origin,
      recipients: args.recipients,
      subject: args.subject
    });
  } else if (args.action === 'get_selected_content') {
    callback({
      editableElem: true,
      enableLookingGlass: preferences.isLookingGlassEnabled()
    });
  } else if (args.action === 'open_options') {
    chrome.tabs.create({
      url: 'settings.html',
      active: true
    });
    callback({});
  } else if (args.action === 'change_pageaction') {
    chrome.browserAction.setTitle({
      tabId: tabId,
      title: chrome.i18n.getMessage('composeGlassTitle')
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128-green.png'
    });
    callback({});
  } else if (args.action === 'reset_pageaction') {
    chrome.browserAction.setTitle({
      title: chrome.i18n.getMessage('extName'),
      tabId: tabId
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128.png'
    });
    callback({});
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
 * Changes the browser action state when Yahoo Mail page is active.
 * @param {number} tabId - The ID of the active tab
 * @private
 */
ext.Launcher.prototype.updateYmailBrowserAction_ = function(tabId) {
  chrome.browserAction.setPopup({
    tabId: tabId,
    popup: 'yprompt.html'
  });
  chrome.browserAction.setBadgeText({text: ''});
  if (this.hasPassphrase()) {
    chrome.browserAction.setTitle({
      tabId: tabId,
      title: chrome.i18n.getMessage('extName')
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128.png'
    });
  } else {
    chrome.browserAction.setTitle({
      tabId: tabId,
      title: chrome.i18n.getMessage('passphraseEmptyWarning')
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128-red.png'
    });
  }
};


/**
 * Shows the welcome screen to first-time users.
 * @private
 */
ext.Launcher.prototype.showWelcomeScreen_ = function() {
  if (preferences.isWelcomePageEnabled()) {
    window.open('welcome.html');
  }
};


/**
 * Modifies HTTP responses relevant to E2E on Yahoo Mail.
 * @param {Object} details
 * @private
 */
ext.Launcher.prototype.modifyResponse_ = function(details) {
  details.responseHeaders.push({
    name: 'Content-Security-Policy',
    value: 'object-src \'none\'; frame-src chrome-extension:'
  });
  return {responseHeaders: details.responseHeaders};
};


/**
 * Installs the handler for HTTP responses to be modified by E2E on Yahoo Mail.
 * @private
 */
ext.Launcher.prototype.installResponseHandler_ = function() {
  chrome.webRequest.onHeadersReceived.addListener(
      ext.Launcher.prototype.modifyResponse_,
      {urls: ['https://*.mail.yahoo.com/*']},
      ['blocking', 'responseHeaders']);
};


/**
 * Removes handler for HTTP responses.
 * @private
 */
ext.Launcher.prototype.removeResponseHandler_ = function() {
  chrome.webRequest.onHeadersReceived.removeListener(
    ext.Launcher.prototype.modifyResponse_);
};
});  // goog.scope
