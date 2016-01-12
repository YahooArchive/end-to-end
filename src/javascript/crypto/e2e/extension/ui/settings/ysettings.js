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
 * @fileoverview Provides the UI for the extension's settings page.
 */
goog.provide('e2e.ext.ui.ySettings');

goog.require('e2e.async.Result');
goog.require('e2e.cipher.Algorithm');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.ui.Settings');
goog.require('e2e.ext.utils.Error');
goog.require('e2e.ext.utils.text');
goog.require('e2e.signer.Algorithm');
goog.require('goog.array');
goog.require('goog.object');


goog.scope(function() {
var ext = e2e.ext;
var constants = e2e.ext.constants;
var dialogs = e2e.ext.ui.dialogs;
var messages = e2e.ext.messages;
var panels = e2e.ext.ui.panels;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;



/**
 * Constructor for the yahoo settings page.
 * @constructor
 * @extends {e2e.ext.ui.Settings}
 */
ui.ySettings = function() {
  goog.base(this);
};
goog.inherits(ui.ySettings, ui.Settings);


/**
 * //@yahoo override to add email validity and priv key duplicate check
 * @suppress {accessControls}
 * @override
 * @private
 */
ui.ySettings.prototype.generateKey_ =
    function(panel, name, email, comments, expDate) {

  var normalizedEmail = utils.text.extractValidYahooEmail(email);

  var result = new e2e.async.Result();
  result.addCallback(function() {

    // almost same as the base generateKey_ except using panel.sendKeys()
    var defaults = constants.KEY_DEFAULTS;
    return this.pgpContext_.generateKey(e2e.signer.Algorithm[defaults.keyAlgo],
        defaults.keyLength, e2e.cipher.Algorithm[defaults.subkeyAlgo],
        defaults.subkeyLength, name, comments, email, expDate)
        .addCallback(function(key) {
          panel.sendKeys(key, goog.bind(function(resp) {
            this.renderNewKey_(key[0].uids[0]);
            panel.reset();
          }, this), this.pgpContext_);
        }, this).addErrback(this.displayFailure_, this);


  }, this).addErrback(function(e) {
    window.setTimeout(goog.bind(function() {
      this.displayFailure_(e);
    }, this), 5);
  }, this);

  if (normalizedEmail) {
    this.actionExecutor_.execute(/** @type {!messages.ApiRequest} */ ({
      action: e2e.ext.constants.Actions.LIST_KEYS,
      content: 'private'
    }), this, goog.bind(function(privateKeyResult) {
      var email = normalizedEmail.toLowerCase();
      var emailLabels = goog.object.getKeys(privateKeyResult);
      var privKeyExisted = goog.array.some(emailLabels, function(label) {
        label = utils.text.extractValidEmail(label);
        return goog.isDefAndNotNull(label) && label.toLowerCase() === email;
      });

      if (privKeyExisted) {
        result.errback(new utils.Error(
            'There is already a key for this address in the keyring',
            'duplicateKeyWarning'));
      } else {
        result.callback();
      }

    }, this));

  } else {
    result.errback(new utils.Error(
        'Please enter a valid email address', 'invalidEmailWarning'));
  }

  return result;
};

});  // goog.scope
