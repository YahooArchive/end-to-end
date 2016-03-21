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
 * @fileoverview Utility methods to help End-to-End actions interact better with
 * the PGP context.
 */

goog.provide('e2e.ext.utils.action');

goog.require('e2e.ext.constants.Keyserver');
goog.require('e2e.ext.utils.text');
goog.require('goog.array');
goog.require('goog.string');

goog.scope(function() {
var messages = e2e.ext.messages;
var action = e2e.ext.utils.action;


/**
 * Extract user IDs from array of Keys.
 * @param {!Array.<!e2e.openpgp.Key>} keys
 * @return {string} All user IDs, separated by comma.
 */
action.extractUserIds = function(keys) {
  var result = goog.array.flatten(goog.array.map(keys, function(key) {
    return key.uids;
  }));
  goog.array.removeDuplicates(result);
  return result.join(', ');
};


/**
 * Gets the End-to-End launcher.
 * @param {!function(!e2e.ext.Launcher)} callback The callback where
 *     the PGP context is to be passed.
 * @param {!function(Error)} errorCallback The callback to invoke if an error is
 *     encountered.
 * @param {T=} opt_scope Optional. The scope in which the function and the
 *     callbacks will be called.
 * @template T
 */
action.getLauncher = function(callback, errorCallback, opt_scope) {
  var scope = opt_scope || goog.global;
  chrome.runtime.getBackgroundPage(
      function(backgroundPage) {
        var page =
            /** @type {{launcher: !e2e.ext.Launcher}} */ (backgroundPage);
        if (backgroundPage) {
          callback.call(scope, page.launcher);
        } else {
          errorCallback.call(
              scope, /** @type {Error} */ (chrome.runtime.lastError));
        }
      });
};


/**
 * Gets the OpenPGP context.
 * @param {!function(!e2e.openpgp.ContextImpl)} callback The callback where
 *     the PGP context is to be passed.
 * @param {!function(Error)} errorCallback The callback to invoke if an error is
 *     encountered.
 * @param {T=} opt_scope Optional. The scope in which the function and the
 *     callbacks will be called.
 * @template T
 */
action.getContext = function(callback, errorCallback, opt_scope) {
  var scope = opt_scope || goog.global;
  action.getLauncher(function(launcher) {
    callback.call(
        scope, /** @type {!e2e.openpgp.ContextImpl} */ (launcher.getContext()));
  }, errorCallback, opt_scope);
};


/**
 * Gets the Preferences object.
 * @param {!function(!e2e.ext.Preferences)} callback The callback where
 *     the Preferences object is to be passed.
 * @param {!function(Error)} errorCallback The callback to invoke if an error is
 *     encountered.
 * @param {T=} opt_scope Optional. The scope in which the function and the
 *     callbacks will be called.
 * @template T
 */
action.getPreferences = function(callback, errorCallback, opt_scope) {
  var scope = opt_scope || goog.global;
  action.getLauncher(function(launcher) {
    callback.call(
        scope, /** @type {!e2e.ext.Preferences} */ (launcher.getPreferences()));
  }, errorCallback, opt_scope);
};


/**
 * //@yahoo
 * Tries to guess the user's ymail address. Will not work from a content script
 * due to potential security issues with exposing YBY.
 * @param {!function((string|undefined|null))} callback
 */
action.getUserYmailAddress = function(callback) {
  var email;
  try {
    // If this is called in the context of a ymail page, get the email from
    // NeoConfig
    if (e2e.ext.utils.text.isYmailOrigin(window.location.href) &&
        typeof window.NeoConfig === 'object' &&
        window.NeoConfig.emailAddress) {
      email = e2e.ext.utils.text.extractValidYahooEmail(
          window.NeoConfig.emailAddress);
      callback(email);
    } else {
      action.getAddressFromYBY_(callback);
    }
  } catch (ex) {
    console.warn('Error getting ymail address from page', ex);
    try {
      action.getAddressFromYBY_(callback);
    } catch (e) {
      console.warn('Error getting ymail address from YBY', e);
      callback(undefined);
    }
  }
};


/**
 * //@yahoo
 * Tries to get an email address from the YBY cookie. Only useful for yahoo-inc
 * users right now. Sorry open source.
 * @param {!function((string|undefined|null))} callback
 * @private
 */
action.getAddressFromYBY_ = function(callback) {
  var email;

  if (!chrome.cookies || !chrome.cookies.get) {
    // Someone tried to call this from a content script. Abort.
    callback(email);
    return;
  }

  chrome.cookies.get({url: e2e.ext.constants.Keyserver.DEFAULT_LOCATION,
    name: e2e.ext.constants.Keyserver.AUTH_COOKIE},
  function(cookie) {
    var params;
    var param;
    var i;
    var yby = cookie ? cookie.value : undefined;

    if (typeof yby === 'string') {
      // Extract userid out of the YBY cookie
      params = goog.string.urlDecode(yby).split('&');
      for (i = 0; i < params.length; i++) {
        param = params[i].split('=');
        if (param[0] === 'userid') {
          // TODO: This may be at a different yahoo domain!
          email = [param[1], 'yahoo-inc.com'].join('@');
          break;
        }
      }
    }

    callback(email);
  });
};

});  // goog.scope
