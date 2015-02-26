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
 * @fileoverview Utility methods to help End-to-End actions interact better with
 * the PGP context.
 */

goog.provide('e2e.ext.utils.action');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('goog.array');
goog.require('goog.string');

goog.scope(function() {
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;
var utils = e2e.ext.utils.action;
var text = e2e.ext.utils.text;
var baseUtils = e2e.ext.utils;


/**
 * Extract user IDs from array of Keys.
 * @param {!Array.<!e2e.openpgp.Key>} keys
 * @return {string} All user IDs, separated by comma.
 */
utils.extractUserIds = function(keys) {
  var result = goog.array.flatten(goog.array.map(keys, function(key) {
    return key.uids;
  }));
  goog.array.removeDuplicates(result);
  return result.join(', ');
};


/**
 * Gets the extension's launcher.
 * @param {!function(!e2e.ext.Launcher)} callback The callback where
 *     the PGP context is to be passed.
 * @param {!function(Error)} errorCallback The callback to invoke if an error is
 *     encountered.
 * @param {T=} opt_scope Optional. The scope in which the function and the
 *     callbacks will be called.
 * @template T
 */
utils.getExtensionLauncher = function(callback, errorCallback, opt_scope) {
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
 * Gets the PGP context.
 * @param {!function(!e2e.openpgp.ContextImpl)} callback The callback where
 *     the PGP context is to be passed.
 * @param {!function(Error)} errorCallback The callback to invoke if an error is
 *     encountered.
 * @param {T=} opt_scope Optional. The scope in which the function and the
 *     callbacks will be called.
 * @template T
 */
utils.getContext = function(callback, errorCallback, opt_scope) {
  var scope = opt_scope || goog.global;
  utils.getExtensionLauncher(function(launcher) {
    callback.call(
        scope, /** @type {!e2e.openpgp.ContextImpl} */ (launcher.getContext()));
  }, errorCallback, opt_scope);
};


/**
 * Retrieves the content that the user has selected.
 * @param {!function(!messages.BridgeMessageRequest)} callback The callback
 *     where the selected content will be passed.
 * @param {!function(Error)} errorCallback The callback to invoke if an error is
 *     encountered.
 * @param {T=} opt_scope Optional. The scope in which the function and the
 *     callbacks will be called.
 * @template T
 */
utils.getSelectedContent = function(callback, errorCallback, opt_scope) {
  var scope = opt_scope || goog.global;
  utils.getExtensionLauncher(function(launcher) {
    launcher.getSelectedContent(goog.bind(callback, scope));
  }, errorCallback, opt_scope);
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
 * @param {!function(Error)} errorCallback The callback to invoke if an error is
 *     encountered.
 * @param {string=} opt_subject The subject of the message if applicable.
 * @param {T=} opt_scope Optional. The scope in which the function and the
 *     callbacks will be called.
 * @template T
 */
utils.updateSelectedContent = function(content, recipients, origin,
    expectMoreUpdates, callback, errorCallback, opt_subject, opt_scope) {
  var scope = opt_scope || goog.global;
  utils.getExtensionLauncher(function(launcher) {
    launcher.updateSelectedContent(content, recipients, origin,
        expectMoreUpdates, goog.bind(callback, scope), opt_subject);
  }, errorCallback, opt_scope);
};


/**
 * Tries to guess the user's ymail address.
 * @param {!function(?string|undefined)} callback
 */
utils.getUserYmailAddress = function(callback) {
  var email;
  try {
    // If this is called in the context of a ymail page, get the email from
    // NeoConfig
    if (text.isYmailOrigin(window.location.href)  &&
        window.NeoConfig &&
        window.NeoConfig.emailAddress) {
      email = text.extractValidYahooEmail(window.NeoConfig.emailAddress);
      callback(email);
    } else {
      utils.getAddressFromYBY_(callback);
    }
  } catch (ex) {
    console.warn('Error getting ymail address from page', ex);
    utils.getAddressFromYBY_(callback);
  }
};


/**
 * Tries to get an email address from the YBY cookie.
 * @param {!function(?string|undefined)} callback
 * @private
 */
utils.getAddressFromYBY_ = function(callback) {
  var email;
  try {
    baseUtils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.GET_AUTH_TOKEN,
      content: constants.Keyserver.DEFAULT_LOCATION
    }), function(response) {
      var yby = response.content;
      var params;
      var param;
      var i;

      if (yby) {
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
  } catch (e) {
    console.warn('Error getting ymail address from YBY', e);
    callback(email);
  }
};

});  // goog.scope
