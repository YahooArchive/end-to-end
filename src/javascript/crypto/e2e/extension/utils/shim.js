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
 * @fileoverview Provides a common interface for Chrome and Firefox to access
 * browser-specific extension functions.
 */

goog.provide('e2e.ext.utils.shim');
goog.provide('e2e.ext.utils.shim.runtime');
goog.provide('e2e.ext.utils.shim.tabs');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.config');
goog.require('e2e.ext.utils.text');
goog.require('goog.array');

goog.scope(function() {
var utils = e2e.ext.utils;
var shim = e2e.ext.utils.shim;
var FF = e2e.ext.config.FIREFOX;
var require = require || goog.nullFunction;


/**
 * Get a localized message string.
 * @type {function(string, ...string): string}
 */
shim.getLocalizedMessage = FF ? require('sdk/l10n').get :
    chrome.i18n.getMessage;

/**
 * Gets the runtime URL.
 * @type {function(string): string}
 */
shim.runtime.getURL = FF ? require('sdk/self').data.url :
    chrome.runtime.getURL;

/**
 * Gets the extension version.
 * @type {function(string): string}
 */
shim.runtime.getVersion = FF ? require('sdk/self').version :
    chrome.runtime.getManifest().version;

/**
 * Reloads all ymail tabs.
 */
shim.tabs.reloadYmail = function() {
  if (FF) {
    goog.array.forEach(require('sdk/tabs').tabs, function(tab) {
      if (utils.text.isYmailOrigin(tab.url)) {
        tab.reload();
      }
    });
  } else {
    chrome.tabs.query({url: 'https://*.mail.yahoo.com/*'}, function(tabs) {
      goog.array.forEach(tabs, function(tab) {
        chrome.tabs.reload(tab.id);
      });
    });
  }
};

/**
 * Reloads the currently active tab(s).
 */
shim.tabs.reload = function() {
  if (FF) {
    require('sdk/tabs').activeTab.reload();
  } else {
    chrome.tabs.query({active: true}, function(tabs) {
      goog.array.forEach(tabs, function(tab) {
        chrome.tabs.reload(tab.id);
      });
    });
  }
};

/**
 * Sends a message to the currently active tab.
 * @param {Object} message The message to send.
 */
shim.tabs.sendMessage = function(message) {
  if (FF) {
    var activeTab = require('sdk/tabs').activeTab;
    if (!utils.text.isYmailOrigin(activeTab.url)) {
      return;
    }
    // Run the helper script in the tab. Note that this is declaratively run on
    // all Yahoo mail pages in Chrome using chrome.manifest.
    var worker = activeTab.attach({
      contentScriptFile: './helper_binary.js'
    });
    worker.port.emit(message);
  } else {
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      var tab = tabs[0];
      if (!goog.isDef(tab)) {
        console.error('Missing active tab!');
        return;
      } else {
        chrome.tabs.sendMessage(tab.id, message);
      }
    });
  }
};

/**
 * Creates a tab with the given extension path.
 * @param {string} path The path to open.
 */
shim.tabs.open = function(path) {
  if (FF) {
    var url = shim.runtime.getURL('path');
    require('sdk/tabs').open(url);
  } else {
    chrome.tabs.create({
      url: path
    }, goog.nullFunction);
  }
};

});  // goog.scope

