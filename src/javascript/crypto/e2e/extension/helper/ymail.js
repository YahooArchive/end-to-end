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
 * @fileoverview Respond to events from Yahoo Mail stub
 */
goog.provide('e2e.ext.YmailHelper');

goog.require('e2e.ext.MessageApi');
/** @suppress {extraRequire} */
goog.require('e2e.ext.YmailData');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.StorageKey');
goog.require('e2e.ext.ui.ComposeGlassWrapper');
goog.require('e2e.ext.ui.GlassWrapper');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Disposable');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.string');
goog.require('goog.style');

goog.scope(function() {
var ext = e2e.ext;
var constants = ext.constants;
var messages = ext.messages;
var utils = ext.utils;
var ui = ext.ui;



/**
 * Constructor for the Ymail Helper
 * @constructor
 * @extends {goog.Disposable}
 */
ext.YmailHelper = function() {

  // assummed ymail storm
  this.injectStub('ymail.storm.js');

  var body = document.body;
  body.addEventListener('openCompose',
      goog.bind(this.installAutoComposeGlass, this), true);
  body.addEventListener('openEncryptedCompose',
      goog.bind(this.installComposeGlass, this), true);
  body.addEventListener('openMessage',
      goog.bind(this.installReadGlasses, this), true);
  body.addEventListener('queryPublicKey',
      goog.bind(this.queryPublicKey, this), true);
  body.addEventListener('loadUser',
      goog.bind(this.loadUser, this), true);
};
goog.inherits(ext.YmailHelper, goog.Disposable);


/**
 * Injects stub script into the web application DOM
 * @param {string} stubFilename name of the stub to inject
 */
ext.YmailHelper.prototype.injectStub = function(stubFilename) {
  if (this.stubInjected_) {
    return;
  }

  var script = document.createElement('script');
  script.src = chrome.runtime.getURL('stubs/' + stubFilename);
  script.setAttribute('data-version', chrome.runtime.getManifest().version);
  document.documentElement.appendChild(script);

  this.stubInjected_ = true;
};


/**
 * Trigger auto installation of compose glass
 * @param {Event} evt The openCompose event
 * @protected
 */
ext.YmailHelper.prototype.installAutoComposeGlass = function(evt) {
  evt.stopPropagation();

  var detail = /** @type {e2e.ext.YmailData.OpenComposeDetail} */ (
      evt.detail);

  // always initialize the stub api regardless of auto-open config
  var stubApi = this.initComposeStubApi_(evt, goog.bind(function() {
    // install glass if the original message has a PGP blob
    stubApi.req('draft.getQuoted').addCallbacks(function(quotedBody) {
      if (quotedBody &&
          goog.string.contains(quotedBody, '-----BEGIN PGP')) {
        this.installComposeGlass(evt);
      }
    }, utils.displayFailure, this);

  }, this));

  // install glass if the current body is a draft
  if (detail.isEncryptedDraft) {
    this.installComposeGlass(evt);
    return;
  }

  // default to open the compose glass if so configured
  utils.getConfig(constants.StorageKey.ENABLE_COMPOSE_GLASS,
      goog.bind(function(isEnabled) {
        isEnabled === 'true' && this.installComposeGlass(evt);
      }, this), utils.displayFailure);
};


/**
 * Trigger auto installation of compose glass
 * @param {Event} evt The openCompose event
 * @protected
 */
ext.YmailHelper.prototype.installComposeGlass = function(evt) {
  evt.stopPropagation();

  var elem = /** @type {Element} */ (evt.target);
  var detail = /** @type {e2e.ext.YmailData.OpenComposeDetail} */ (
      evt.detail);

  if (!elem.composeGlass || elem.glassDisposed) {
    elem.composeGlass = true;
    elem.focus();

    var glassWrapper = new ui.ComposeGlassWrapper(
        elem, this.initComposeStubApi_(evt));
    glassWrapper.installGlass();

    this.registerDisposable(glassWrapper);
  }
};


/**
 * Trigger auto installation of read glass
 * @param {Event} evt The openMessage event
 * @param {number=} opt_limit Stop parsing once opt_limit armors have been
 *     parsed. Otherwise, the limit is hardcoded as 20.
 * @protected
 */
ext.YmailHelper.prototype.installReadGlasses = function(evt, opt_limit) {
  evt.stopPropagation();

  var elem = /** @type {Element} */ (evt.target);
  var detail = /** @type {ext.YmailData.OpenMessageDetail} */ (
      evt.detail);

  if (elem.lookingGlass) {
    return;
  }
  elem.lookingGlass = true;

  try {
    // TODO: support rich text and let PGP message quotable
    var message = detail.body + detail.quotedBody;
    var armors = e2e.openpgp.asciiArmor.parseAll(message, opt_limit || 20);

    // no armor needs glass, or ignore binary OpenPGP message
    if (armors.length === 0 || armors[0].type === 'BINARY') {
      return;
    }

    this.installReadGlassPerArmor(elem, message, armors);

  } catch (err) {
    utils.displayFailure(err);
  }
};


/**
 * Install read glass for every valid armor found, and preserve surronding text
 * @param {!Element} elem The elem where the glasses and texts will be inserted
 * @param {!string} message The message body
 * @param {!Array.<!e2e.openpgp.ArmoredMessage>} armors The valid armors
 * @protected
 */
ext.YmailHelper.prototype.installReadGlassPerArmor = function(
    elem, message, armors) {
  var div, plaintext, glassWrapper, lastEndOffset = 0;

  goog.array.forEach(armors, function(armor) {
    var isValidDecryptVerifyArmor = false, textStartOffset = 0;

    if (armor.type === 'SIGNATURE') {
      // adjust startOffset to also capture whole message body
      textStartOffset = lastEndOffset + message.slice(lastEndOffset).
          indexOf('-----BEGIN PGP SIGNED MESSAGE-----');

      isValidDecryptVerifyArmor = true;
    } else if (armor.type === 'MESSAGE') {
      textStartOffset = armor.startOffset;
      isValidDecryptVerifyArmor = true;
    }

    // capture the text upto the next valid armor (or include it if invalid)
    plaintext = message.slice(lastEndOffset,
        isValidDecryptVerifyArmor ? textStartOffset : armor.endOffset);

    // insert the text before the next armor
    if (plaintext && goog.string.trim(plaintext)) {
      div = document.createElement('div');
      div.className = elem.className +
          (glassWrapper ? ' plaintext-above' : '') + ' plaintext-below';
      div.textContent = plaintext;

      goog.dom.insertSiblingBefore(div, elem);
    }

    // insert a glass to decrypt the next armor
    if (isValidDecryptVerifyArmor) {
      // add the original text to the armor object
      armor.text = message.slice(textStartOffset, armor.endOffset);

      glassWrapper = new ui.GlassWrapper(elem, armor);
      window.helper && window.helper.registerDisposable(glassWrapper);
      glassWrapper.installGlass();
    }

    lastEndOffset = armor.endOffset;
  });

  // hide the original target element if it's not hidden by a glass.
  if (!glassWrapper) {
    goog.style.setElementShown(elem, false);
  }

  // insert the remaining text
  plaintext = message.slice(lastEndOffset);
  if (plaintext && goog.string.trim(plaintext)) {
    div = document.createElement('div');
    div.className = elem.className + ' plaintext-above';
    div.textContent = plaintext;
    goog.dom.insertSiblingBefore(div, elem);
  }

  elem.focus();
};


/**
 * Add has-key or no-key as className to the event target depending if the
 * email address specified in event detail has a public key. No className is
 * added in case an error (e.g., keyserver unreachable) has occurred
 * @param {Event} evt The queryPublicKey event
 * @protected
 */
ext.YmailHelper.prototype.queryPublicKey = function(evt) {
  var elem = /** @type {Element} */ (evt.target);
  var email = /** @type {!string} */ (evt.detail);

  // Check if a public can be found for the email
  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: constants.Actions.GET_ALL_KEYS_BY_EMAILS,
    recipients: [email],
    content: 'public_exist'
  }), function(response) {
    var hasKey = response.content && response.content[0];
    elem.classList.add(hasKey ? 'has-key' : 'no-key');
  }, utils.displayFailure); // no additional color in error
};


/**
 * Check if the YMail user has a key that is in sync with server
 * @param {Event} evt The queryPublicKey event
 * @protected
 */
ext.YmailHelper.prototype.loadUser = function(evt) {
  var uid, elem = /** @type {Element} */ (evt.target);

  this.primaryUser_ = /** @type {!ext.YmailData.EmailUser} */ (
      evt.detail);
  uid = utils.text.userObjectToUid(this.primaryUser_);

  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: constants.Actions.SYNC_KEYS,
    content: uid
  }), function(response) {
    if (response.content === false) {
      if (window.confirm(chrome.i18n.getMessage('confirmUserSyncKeys', uid))) {
        utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
          action: constants.Actions.CONFIGURE_EXTENSION,
          content: uid
        }));
      }
    }
  }, utils.displayFailure);

};


/**
 * Initialize a stub api for compose-related calls
 * @param {Event} evt The OpenCompose or OpenEncryptedCompose event
 * @param {Function=} opt_callback Callback when the Message API is initiated
 * @return {!e2e.ext.MessageApi} the stub api
 * @private
 */
ext.YmailHelper.prototype.initComposeStubApi_ = function(evt, opt_callback) {
  var elem = /** @type {Element} */ (evt.target);
  var detail = /** @type {e2e.ext.YmailData.OpenComposeDetail} */ (
      evt.detail);

  if (!elem.stubApi_) {
    elem.stubApi_ = new e2e.ext.MessageApi(detail.apiId);
    elem.stubApi_.setRequestHandler('evt.close', function() {
      elem.stubApi_.dispose();
    });
    // TODO: inserting an error message on ymail top doesn't look good
    elem.stubApi_.bootstrapServer(
        window, window.location.origin, function(err) {
          if (err instanceof Error) {
            utils.displayFailure(err);
          } else if (opt_callback) {
            opt_callback();
          }
        });
  }
  return elem.stubApi_;
};


/**
 * Return the primary account user
 * @return {ext.YmailData.EmailUser} The user
 */
ext.YmailHelper.prototype.getUser = function() {
  return this.primaryUser_;
};


});  // goog.scope
