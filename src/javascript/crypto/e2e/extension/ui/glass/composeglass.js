// Copyright 2013 Yahoo Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Similar to prompt.js, but operates as a content script instead
 * of in the main process.
 */

goog.provide('e2e.ext.ui.ComposeGlass');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.panels.Chip');
goog.require('e2e.ext.ui.panels.ChipHolder');
goog.require('e2e.ext.ui.templates.composeglass');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events.EventType');
goog.require('goog.object');
goog.require('goog.string');
goog.require('goog.string.format');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var ext = e2e.ext;
var messages = e2e.ext.messages;
var panels = e2e.ext.ui.panels;
var templates = e2e.ext.ui.templates.composeglass;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;



/**
 * Constructor for the UI compose glass.
 * @param {!messages.e2ebindDraft} draft Message draft
 * @param {string} mode Either scroll mode or resize mode
 * @param {string} origin The origin that requested the compose glass
 * @param {string} hash Hash to uniquely identify this compose glass instance
 * @constructor
 * @extends {goog.ui.Component}
 */
ui.ComposeGlass = function(draft, mode, origin, hash) {
  goog.base(this);

  this.recipients = draft.to.concat(draft.cc).concat(draft.bcc);
  this.subject = draft.subject;
  this.selection = draft.body;
  this.origin = origin;
  this.mode = mode;
  this.hash = hash;
  this.from = draft.from;

  /**
   * Placeholder for calling out to preferences.js.
   * TODO: Switch preferences.js to chrome.storage.sync
   */
  this.preferences_ = {
    isActionSniffingEnabled: true,
  };
};
goog.inherits(ui.ComposeGlass, goog.ui.Component);


/**
 * A holder for the intended recipients of a PGP message.
 * @type {panels.ChipHolder}
 * @private
 */
ui.ComposeGlass.prototype.chipHolder_ = null;


/** @override */
ui.ComposeGlass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  soy.renderElement(elem, templates.main, {
    extName: chrome.i18n.getMessage('extName')
  });

  var styles = elem.querySelector('link');
  styles.href = chrome.extension.getURL('composeglass_styles.css');

  // This tells the helper to attach the set_draft handler in e2ebind
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.GET_SELECTED_CONTENT
  }));
  this.processActiveContent_();
};


/**
 * Process the retrieved content blob and display it into the prompt UI.
 * @private
 */
ui.ComposeGlass.prototype.processActiveContent_ = function() {
  this.clearFailure_();
  var action = constants.Actions.ENCRYPT_SIGN;
  var content = this.selection;
  var origin = this.origin;
  var recipients = this.recipients;
  var subject = this.subject;
  var from = this.from;

  var elem = goog.dom.getElement(constants.ElementId.BODY);
  var title = goog.dom.getElement(constants.ElementId.TITLE);
  title.textContent = chrome.i18n.getMessage('promptEncryptSignTitle');
  goog.style.setElementShown(title, false);

  this.renderEncrypt_(elem, recipients, origin, subject, from, content);

  this.getHandler().listen(
      elem, goog.events.EventType.CLICK,
      goog.bind(this.buttonClick_, this, action, origin));
};


/**
 * Sets the provided content into the currently active page.
 * Note: This function might not work while debugging the extension.
 * @param {string} content The content to write inside the selected element.
 * @param {!Array.<string>} recipients The recipients of the message.
 * @param {string} subject Subject of the message
 * @param {!function(...)} callback The function to invoke once the message to
 *   update active content has been sent
 * @private
 */
ui.ComposeGlass.prototype.updateActiveContent_ =
    function(content, recipients, subject, callback) {
  var response = /** @type {messages.BridgeMessageResponse} */ ({
    value: content,
    response: true,
    detach: true,
    origin: this.origin,
    recipients: recipients,
    subject: subject
  });
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.SET_DRAFT,
    content: response
  }));
  callback();
};


/**
 * @param {constants.Actions} action
 * @param {string} origin
 * @param {Event} event
 * @private
 */
ui.ComposeGlass.prototype.buttonClick_ = function(
    action, origin, event) {
  var elem = goog.dom.getElement(constants.ElementId.BODY);
  var target = event.target;

  if (target instanceof HTMLImageElement) {
    target = target.parentElement;
  }

  if (target instanceof Element) {
    if (goog.dom.classlist.contains(target, constants.CssClass.ACTION)) {
      this.executeAction_(action, elem, origin);
    } else if (
        // TODO(yan): make this go back to normal compose
        goog.dom.classlist.contains(target, constants.CssClass.BACK)) {
      this.close();
    }
  }
};


/**
 * Extracts user addresses from user IDs and creates an email to user IDs map.
 * Ignores user IDs without a valid e-mail address.
 * @param  {!Array.<string>} recipients user IDs of recipients
 * @return {!Object.<string, !Array.<string>>} email to user IDs map
 * @private
 */
ui.ComposeGlass.prototype.getRecipientsEmailMap_ = function(recipients) {
  var map = {};
  goog.array.forEach(recipients, function(recipient) {
    var email = utils.text.extractValidEmail(recipient);
    if (email) {
      if (!map.hasOwnProperty(email)) {
        map[email] = [];
      }
      map[email].push(recipient);
    }
  });
  return map;
};


/**
 * Renders the UI elements needed for PGP encryption.
 * @param {Element} elem The element into which the UI elements are to be
 *     rendered.
 * @param {!Array.<string>} recipients The initial list of identified
 *     recipients for the encrypted message.
 * @param {string} origin The web origin where the message was created.
 * @param {string} subject The subject of the message
 * @param {string} from Address that the message is from
 * @param {string} content Body of the message
 * @private
 */
ui.ComposeGlass.prototype.renderEncrypt_ =
    function(elem, recipients, origin, subject, from, content) {
  var intendedRecipients = [];

  var sniffedAction = utils.text.getPgpAction(
      content, this.preferences_.isActionSniffingEnabled);

  // Pre-populate the list of recipients during an encrypt/sign action.
  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.LIST_KEYS,
    content: 'public'
  }), goog.bind(function(response) {
    var searchResult = response.content;
    console.log('got LIST_KEYS public result', searchResult);
    var allAvailableRecipients = goog.object.getKeys(searchResult);
    var recipientsEmailMap = this.getRecipientsEmailMap_(
        allAvailableRecipients);
    goog.array.forEach(recipients, function(recipient) {
      if (recipientsEmailMap.hasOwnProperty(recipient)) {
        goog.array.extend(intendedRecipients,
            recipientsEmailMap[recipient]);
      }
    });

    utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.LIST_KEYS,
      content: 'private'
    }), goog.bind(function(response) {
      var privateKeyResult = response.content;
      console.log('got LIST_KEYS private result', privateKeyResult);
      var availableSigningKeys = goog.object.getKeys(privateKeyResult);

      soy.renderElement(elem, templates.renderEncrypt, {
        signerCheckboxTitle: chrome.i18n.getMessage('promptSignMessageAs'),
        fromLabel: chrome.i18n.getMessage('promptFromLabel'),
        noPrivateKeysFound: chrome.i18n.getMessage('promptNoPrivateKeysFound'),
        availableSigningKeys: availableSigningKeys,
        actionButtonTitle: chrome.i18n.getMessage(
            'promptEncryptSignActionLabel'),
        backButtonTitle: chrome.i18n.getMessage('actionBackToMenu'),
        subject: subject
      });

      var textArea = /** @type {HTMLTextAreaElement} */
          (elem.querySelector('textarea'));

      // Show green icon in the URL bar when the secure text area is in focus
      // so page XSS attacks are less likely to compromise plaintext
      textArea.onfocus = function() {
        utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
          action: constants.Actions.CHANGE_PAGEACTION
        }));
      };
      textArea.onblur = function() {
        utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
          action: constants.Actions.RESET_PAGEACTION
        }));
      };

      textArea.value = content;

      if (sniffedAction == constants.Actions.DECRYPT_VERIFY) {
        console.log('got decrypt_verify');
        utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
          action: constants.Actions.DECRYPT_VERIFY,
          content: content
        }), goog.bind(function(response) {
          var decrypted = response.content || '';
          if (e2e.openpgp.asciiArmor.isDraft(content)) {
            console.log('renderEncrypt setting draft content');
            textArea.value = decrypted;
          } else {
            console.log('renderEncrypt setting reply content');
            this.renderReply_(textArea, decrypted);
          }
        }, this));
      }

      this.chipHolder_ = new panels.ChipHolder(
          intendedRecipients, allAvailableRecipients);
      this.addChild(this.chipHolder_, false);
      this.chipHolder_.decorate(
          goog.dom.getElement(constants.ElementId.CHIP_HOLDER));
    }, this));
  }, this));
};


/**
 * Renders the original message to which the user wants to reply.
 * @param {HTMLTextAreaElement} textArea The text area where the reply body will
 *     be displayed.
 * @param {string} originalMsg The original message.
 * @private
 */
ui.ComposeGlass.prototype.renderReply_ = function(textArea, originalMsg) {
  var replyLineToken = '\n> ';
  var replyBody = utils.text.prettyTextWrap(
      originalMsg, (78 - replyLineToken.length));
  textArea.value = goog.string.format(
      '\n\n%s:\n%s',
      chrome.i18n.getMessage('promptEncryptSignReplyHeader'),
      replyLineToken + replyBody.split('\n').join(replyLineToken));
  textArea.setSelectionRange(0, 0);
};


/**
 * Closes the prompt.
 */
ui.ComposeGlass.prototype.close = function() {
  // Clear all input and text area fields to ensure that no data accidentally
  // leaks to the user.
  goog.array.forEach(
      document.querySelectorAll('textarea,input'), function(elem) {
        elem.value = '';
      });
  goog.dispose(this);
  console.log('compose glass sending glass_closed');
  utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
    action: constants.Actions.GLASS_CLOSED,
    content: this.hash
  }));
};


/**
 * Executes the PGP action and displays the result to the user.
 * @param {constants.Actions} action The PGP action that the user has
 *     requested.
 * @param {Element} elem The element with the textarea where the result of the
 *     action will be displayed.
 * @param {string} origin The web origin for which the PGP action is performed.
 * @private
 */
ui.ComposeGlass.prototype.executeAction_ = function(action, elem, origin) {
  var textArea = elem.querySelector('textarea');
  this.clearFailure_();
  switch (action) {
    case ext.constants.Actions.ENCRYPT_SIGN:
      var request = /** @type {!messages.ApiRequest} */ ({
        action: constants.Actions.ENCRYPT_SIGN,
        content: textArea.value,
        signMessage: true,
        currentUser:
            goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value
      });

      if (this.chipHolder_) {
        request.recipients = this.chipHolder_.getSelectedUids();
      }

      utils.sendExtensionRequest(
          request, goog.bind(function(result) {
            var encrypted = result.content || '';
            this.insertMessageIntoPage_(origin, encrypted);
          }, this));
  }
};


/**
 * Displays an error message to the user.
 * @param {Error} error The error to display.
 * @private
 */
ui.ComposeGlass.prototype.displayFailure_ = function(error) {
  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  var errorMsg = goog.isDef(error.messageId) ?
      chrome.i18n.getMessage(error.messageId) : error.message;
  utils.errorHandler(error);
  errorDiv.textContent = errorMsg;
};


/**
 * Clears the error message notfication area.
 * @private
 */
ui.ComposeGlass.prototype.clearFailure_ = function() {
  var errorDiv = goog.dom.getElement(constants.ElementId.ERROR_DIV);
  errorDiv.textContent = '';
};


/**
 * Notifies user of successful operation.
 * @param {string} msg The message to display
 * @param {!function(...)} callback function to invoke when notification has
 *   been displayed
 * @private
 */
ui.ComposeGlass.prototype.displaySuccess_ = function(msg, callback) {
  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: 'show_notification',
    content: msg}), callback);
};


/**
 * Inserts the encrypted content into the page.
 * @param {string} origin The web origin for which the PGP action is performed.
 * @param {string} text The encrypted text to insert into the page.
 * @private
 */
ui.ComposeGlass.prototype.insertMessageIntoPage_ = function(origin, text) {
  var recipients = this.chipHolder_.getSelectedUids();
  var subject = this.getElement().querySelector('#subjectHolder input').value;
  this.updateActiveContent_(
      text, recipients, subject, goog.bind(this.close, this));
};

});  // goog.scope
