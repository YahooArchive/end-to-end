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
 * @fileoverview Provides common utility methods to the extension.
 */

goog.provide('e2e.ext.utils');
goog.provide('e2e.ext.utils.Error');

goog.require('e2e.async.Result');
goog.require('e2e.ext.config');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.ElementId');
goog.require('goog.object');

goog.scope(function() {
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;
var utils = e2e.ext.utils;


/**
 * Creates a blob URL to download a file.
 * @param {string} content The content to write to the new file.
 * @param {!function(string)} callback The callback to invoke with the URL of
 *     the created file.
 */
utils.writeToFile = function(content, callback) {
  var blob = new Blob(
      [content], {type: 'application/pgp-keys; format=text;'});
  var url = URL.createObjectURL(blob);
  callback(url);
};


/**
 * Reads the contents of the provided file returns it via the provided callback.
 * Automatically handles both binary OpenPGP packets and text files.
 * @param {(string|!File)} file The file to read.
 * @param {!function(string)} callback The callback to invoke with the file's
 *     contents.
 */
utils.readFile = function(file, callback) {
  utils.readFile_(false, file, function(contents) {
    // The 0x80 bit is always set for the Packet Tag for OpenPGP packets.
    if (contents.charCodeAt(0) >= 0x80) {
      callback(contents);
    } else {
      utils.readFile_(true, file, callback);
    }
  });
};


/**
 * Reads the contents of the provided file as text and returns them via the
 * provided callback.
 * @param {boolean} asText If true, then read as text.
 * @param {(string|!File)} file The file to read. If it's a string, call the
 *     callback immediately.
 * @param {!function(string)} callback The callback to invoke with the file's
 *     contents.
 * @private
 */
utils.readFile_ = function(asText, file, callback) {
  if (typeof file === 'string') {
    callback(/** @type {string} */ (file));
    return;
  }
  var reader = new FileReader();
  reader.onload = function() {
    if (reader.readyState != reader.LOADING) {
      reader.onload = null;
      callback(/** @type {string} */ (reader.result));
    }
  };
  if (asText) {
    reader.readAsText(file);
  } else {
    reader.readAsBinaryString(file);
  }
};


/**
 * Logs errors to console.
 * @param {*} error The error to log.
 */
utils.errorHandler = function(error) {
  console.error(error);
};



/**
 * Constructor for a i18n friendly error.
 * @param {string} defaultMsg The default error message.
 * @param {string} msgId The i18n message id.
 * @constructor
 * @extends {Error}
 */
utils.Error = function(defaultMsg, msgId) {
  goog.base(this, defaultMsg);
  this.messageId = msgId;
};
goog.inherits(utils.Error, Error);


/**
 * Displays Chrome notifications to the user.
 * @param {string} msg The message to display to the user.
 * @param {!function()} callback A callback to invoke when the notification
 *     has been displayed.
 */
utils.showNotification = function(msg, callback) {
  chrome.notifications.create(constants.ElementId.NOTIFICATION_SUCCESS, {
    type: 'basic',
    iconUrl: '/images/yahoo/icon-48.png',
    title: chrome.i18n.getMessage('extName'),
    message: msg
  }, function() {
    window.setTimeout(function() {
      chrome.notifications.clear(
          constants.ElementId.NOTIFICATION_SUCCESS,
          goog.nullFunction); // Dummy callback to keep Chrome happy.
    }, constants.NOTIFICATIONS_DELAY);
    callback();
  });
};


/**
 * Sends a request to the launcher to perform some action.
 * @param {messages.ApiRequest} args The message to send to the launcher
 * @param {function(messages.e2ebindResponse)=} opt_callback optional callback
 *   to call with the result.
 * @param {function(Error)=} opt_errback The callback to invoke if an
 *     error is encountered. If omitted, the default error callback will be
 *     invoked.
 */
utils.sendExtensionRequest = function(args, opt_callback, opt_errback) {
  var port = chrome.runtime.connect();
  if (!port) {
    return;
  }
  port.postMessage(args);

  opt_callback = opt_callback || goog.nullFunction;

  var respHandler = typeof opt_errback === 'function' ?
      function(response) {
        if (response.error) {
          opt_errback(new Error(response.error));
        } else {
          try {
            opt_callback(response);
          } catch (ex) {
            opt_errback(ex);
          }
        }
        port.disconnect();
      } :
      function(response) {
        opt_callback(response);
        port.disconnect();
      };
  port.onMessage.addListener(respHandler);
  port.onDisconnect.addListener(function() {
    port = null;
  });
};


/**
 * Sends a request from a content script to proxy a message to the active tab.
 * @param {messages.proxyMessage} args The message to proxy
 * @return {e2e.async.Result.<Object>}
 */
utils.sendProxyRequest = function(args) {
  var result = new e2e.async.Result;

  args.proxy = true;
  chrome.runtime.sendMessage(args, function(response) {
    if (chrome.runtime.lastError) {
      result.errback(chrome.runtime.lastError);
    } else if (response.error) {
      result.errback(new Error(response.error));
    } else {
      result.callback(response);
    }
  });

  return result;
};


/**
 * Checks if the given window runs as part of a Chrome App execution
 * environment.
 * @param {Window=} opt_window Window object to test. Defaults to current.
 * @return {boolean} True iff the code runs in a Chrome App.
 */
utils.runsInChromeApp = function(opt_window) {
  var win = opt_window ? opt_window : window;
  return Boolean(win.chrome.runtime) &&
      goog.isFunction(win.chrome.runtime.getManifest) &&
      goog.object.containsKey(win.chrome.runtime.getManifest(), 'app');
};


/**
 * Checks if the given window runs as part of a Chrome Extension execution
 * environment.
 * @param {Window=} opt_window Window object to test. Defaults to current.
 * @return {boolean} True iff the code runs in a Chrome Extension.
 */
utils.runsInChromeExtension = function(opt_window) {
  var win = opt_window ? opt_window : window;
  return Boolean(win.chrome.runtime) &&
      goog.isFunction(win.chrome.runtime.getManifest) &&
      !goog.object.containsKey(win.chrome.runtime.getManifest(), 'app');
};


/**
 * Checks if the given window is a Chrome App window. Defaults to checking
 * current window.
 * @param {Window=} opt_window Window object to test.
 * @return {boolean}
 */
utils.isChromeAppWindow = function(opt_window) {
  var win = opt_window ? opt_window : window;
  return (utils.runsInChromeApp(opt_window) &&
      win.location.protocol == 'chrome-extension:');
};


/**
 * Checks if the given window is a view/background page of a Chrome extension.
 * Defaults to checking current window. Will return false in a content script.
 * @param {Window=} opt_window Window object to test.
 * @return {boolean}
 */
utils.isChromeExtensionWindow = function(opt_window) {
  var win = opt_window ? opt_window : window;
  return (utils.runsInChromeExtension(opt_window) &&
      win.location.protocol == 'chrome-extension:');
};


/**
 * Returns true if the current execution context is a content script.
 * @return {boolean}
 */
utils.isContentScript = function() {
  return Boolean(chrome.runtime) &&
      Boolean(chrome.runtime.getURL) && // Running as Chrome extension/app
      !Boolean(chrome.runtime.getBackgroundPage); // Running in a content script
};


/**
 * Opens a window to requests for authentication, callback when the user has
 * successfully authenticated.
 * @param {string} email The email address that requires authentication
 * @return {!e2e.async.Result<boolean>} The authentication result
 */
utils.openAuthWindow = function(email) {
  var result = new e2e.async.Result;

  // TODO: url now hardcoded. support openid type
  var authUrl = 'https://by.bouncer.login.yahoo.com/login?url=' +
      encodeURIComponent(
          e2e.ext.config.CONAME.realms[0].addr + '/auth/cookies');

  chrome.windows.create({
    url: authUrl,
    // url: e2e.coname.getRealmByEmail(email).addr +
    //         '/auth?email=' + encodeURIComponent(email),
    width: 500,
    height: 640,
    type: 'popup'
  }, function(win) {

    var onClose_ = function(closedWinId) {
      if (win.id === closedWinId) {
        chrome.windows.onRemoved.removeListener(onClose_);
        result.callback(true);
      }
    };
    chrome.windows.onRemoved.addListener(onClose_);

  });
  return result;
};

});  // goog.scope
