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
goog.require('e2e.ext.keyserver');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.dialogs.InputType');
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

  draft.cc = draft.cc || [];
  draft.bcc = draft.bcc || [];
  // List of raw emails of recipients
  this.recipients = draft.to.concat(draft.cc).concat(draft.bcc);
  this.subject = draft.subject;
  this.selection = draft.body;
  this.origin = origin;
  this.mode = mode;
  this.hash = hash;
  // The email of the sender
  this.from = draft.from;
  // List of all emails with public keys
  this.allAvailableRecipients_ = /** @type {!Array.<string>} */ ([]);
  // Map of email to uids
  this.recipientsEmailMap_ =
      /** @type {!Object.<string, !Array.<string>>} */ ({});
  this.keyserverClient = new ext.keyserver.Client(origin);

  /**
   * Placeholder for calling out to preferences.js.
   * TODO: Switch preferences.js to chrome.storage.sync
   */
  this.preferences_ = {
    isActionSniffingEnabled: true
  };
};
goog.inherits(ui.ComposeGlass, goog.ui.Component);


/**
 * A holder for the intended recipients of a PGP message.
 * @type {panels.ChipHolder}
 * @private
 */
ui.ComposeGlass.prototype.chipHolder_ = null;


/**
 * Whether the user is okay with sending this message unencrypted.
 * @type {boolean}
 * @private
 */
ui.ComposeGlass.prototype.sendUnencrypted_ = false;


/** @override */
ui.ComposeGlass.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  soy.renderElement(elem, templates.main, {
    extName: chrome.i18n.getMessage('extName')
  });

  var titleText = chrome.i18n.getMessage('promptEncryptSignTitle');

  var title = elem.querySelector('h1');
  title.textContent = titleText;

  var headerImg = elem.querySelector('img');
  headerImg.title = titleText;

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
  var subject = this.subject || '';
  var from = this.from || '';

  var elem = goog.dom.getElement(constants.ElementId.BODY);

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
 * @param {string} from Sender of the message
 * @param {!function(...)} callback The function to invoke once the message to
 *   update active content has been sent
 * @private
 */
ui.ComposeGlass.prototype.updateActiveContent_ =
    function(content, recipients, subject, from, callback) {
  var response = /** @type {messages.BridgeMessageResponse} */ ({
    value: content,
    response: true,
    detach: true,
    origin: this.origin,
    recipients: recipients,
    subject: subject,
    from: from
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
    if (goog.dom.classlist.contains(target, constants.CssClass.INSERT)) {
      this.executeAction_(action, elem, origin);
    } else if (
        goog.dom.classlist.contains(target, constants.CssClass.BACK)) {
      if (window.confirm(chrome.i18n.getMessage('composeGlassConfirmBack'))) {
        this.close();
      }
    }
  }
};


/**
 * Extracts user addresses from user IDs and creates email to user IDs map.
 * @param  {!Array.<string>} recipients user IDs of recipients
 * @return {!Object.<string, !Array.<string>>}
 * @private
 */
ui.ComposeGlass.prototype.getEmailMap_ = function(recipients) {
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
  var sniffedAction = utils.text.getPgpAction(
      content, this.preferences_.isActionSniffingEnabled);

  // Pre-populate the list of recipients during an encrypt/sign action.
  utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.LIST_KEYS,
    content: 'public'
  }), goog.bind(function(response) {
    // Get the list of emails with public keys for autocomplete
    var searchResult = response.content;
    var allUids = goog.object.getKeys(searchResult);
    this.recipientsEmailMap_ = this.getEmailMap_(allUids);
    this.allAvailableRecipients_ = goog.object.getKeys(
        this.recipientsEmailMap_);

    utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.LIST_KEYS,
      content: 'private'
    }), goog.bind(function(response) {
      // Get the list of uids with private keys for the 'from' menu
      var privateKeyResult = response.content;
      var allSigningUids = goog.object.getKeys(privateKeyResult);

      soy.renderElement(elem, templates.renderEncrypt, {
        signerCheckboxTitle: chrome.i18n.getMessage('promptSignMessageAs'),
        fromLabel: chrome.i18n.getMessage('promptFromLabel'),
        noPrivateKeysFound: chrome.i18n.getMessage('promptNoPrivateKeysFound'),
        availableSigningKeys: allSigningUids,
        actionButtonTitle: chrome.i18n.getMessage(
            'promptEncryptSignActionLabel'),
        backButtonTitle: chrome.i18n.getMessage('actionBackToMenu'),
        subject: subject
      });

      // Set the 'from' field with the correct uid
      var fromHolder = goog.dom.getElement(constants.ElementId.SIGNER_SELECT);
      var senderEmailMap = this.getEmailMap_(allSigningUids);
      if (goog.object.containsKey(senderEmailMap, from)) {
        // Select the first UID associated with the 'from' address
        fromHolder.value = senderEmailMap[from][0];
      } else {
        // Stick with the default selected value
        console.warn('Expected available signing keys to contain', from);
      }

      var textArea = /** @type {HTMLTextAreaElement} */
          (elem.querySelector('textarea'));

      // Show green icon in the URL bar when the secure text area is in focus
      // so page XSS attacks are less likely to compromise plaintext
      textArea.onfocus = goog.bind(function() {
        this.clearFailure_();
        utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
          action: constants.Actions.CHANGE_PAGEACTION
        }));
        if (!this.sendUnencrypted_) {
          try {
            this.fetchKeys_(goog.bind(function(validRecipients,
                                               invalidRecipients) {
              // Add the valid recipients to the lists of all avail recipients
              goog.array.forEach(validRecipients,
                                 goog.bind(function(recipient) {
                // For now, keyserver entries have uid === email
                goog.object.add(this.recipientsEmailMap_, recipient,
                                ['<' + recipient + '>']);
              }, this));
              this.allAvailableRecipients_ = goog.object.getKeys(
                  this.recipientsEmailMap_);
              // Show them as good in the UI
              if (this.chipHolder_) {
                this.chipHolder_.markGoodChips(validRecipients);
              }
              // Pop up warning to remove the invalid recipients
              this.handleMissingPublicKeys_(invalidRecipients);
              // Tell the user we've imported some keys
              if (validRecipients.length > 0) {
                utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */
                                           ({
                  action: constants.Actions.SHOW_NOTIFICATION,
                  content: chrome.i18n.getMessage(
                      'promptImportKeyNotificationLabel',
                      validRecipients.toString())
                }));
              }
            }, this));
          } catch(e) {
            this.displayFailure_(e);
          }
        }
      }, this);
      textArea.onblur = goog.bind(function() {
        utils.sendProxyRequest(/** @type {messages.proxyMessage} */ ({
          action: constants.Actions.RESET_PAGEACTION
        }));
      }, this);

      textArea.value = content;

      if (sniffedAction == constants.Actions.DECRYPT_VERIFY) {
        utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
          action: constants.Actions.DECRYPT_VERIFY,
          content: content
        }), goog.bind(function(response) {
          var decrypted = response.content || '';
          if (e2e.openpgp.asciiArmor.isDraft(content)) {
            textArea.value = decrypted;
          } else {
            this.renderReply_(textArea, decrypted);
          }
        }, this));
      }

      this.chipHolder_ = new panels.ChipHolder(recipients,
                                               this.allAvailableRecipients_);
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
  var signMessage = this.shouldSignMessage_();
  var content = textArea.value;
  this.clearFailure_();
  switch (action) {
    // For now this is the only supported action. Encrypt/sign and insert.
    case ext.constants.Actions.ENCRYPT_SIGN:
      var request = /** @type {!messages.ApiRequest} */ ({
        action: constants.Actions.ENCRYPT_SIGN,
        content: content,
        signMessage: signMessage,
        currentUser:
            goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value
      });

      if (this.chipHolder_) {
        var invalidRecipients = this.getInvalidRecipients_();
        if (invalidRecipients.length === 0) {
          request.recipients = this.getRecipientUids_();
          this.sendRequestToInsert_(request, origin);
        } else if (!this.sendUnencrypted_) {
          this.handleMissingPublicKeys_(undefined, goog.bind(function() {
            var invalidRecipients = this.getInvalidRecipients_();
            if (invalidRecipients.length === 0) {
              request.recipients = this.getRecipientUids_();
            }
            this.sendRequestToInsert_(request, origin);
          }, this));
        } else {
          this.sendRequestToInsert_(request, origin);
        }
      }
  }
};


/**
 * Returns the UIDs that are currently in the chipholder.
 * @return {!Array.<string>}
 * @private
 */
ui.ComposeGlass.prototype.getRecipientUids_ = function() {
  //TODO: getSelectedUids is a misnomer here - it actually returns emails.
  var recipientEmails = this.chipHolder_.getSelectedUids();
  return goog.array.reduce(recipientEmails, goog.bind(function(prev, current) {
    var uids = /** @type {(!Array.<string>|undefined)} */ (
        this.recipientsEmailMap_[current]);
    return uids ? prev.concat(uids) : prev;
  }, this), []);
};


/**
 * Sends the request to insert the message into the page;
 * @param {!messages.ApiRequest} request The request to send
 * @param {string} origin The origin of the page
 */
ui.ComposeGlass.prototype.sendRequestToInsert_ = function(request, origin) {
  utils.sendExtensionRequest(
      request, goog.bind(function(result) {
        var encrypted = result.content || request.content;
        this.insertMessageIntoPage_(origin, encrypted);
      }, this));
};


/**
 * Checks whether the message should be signed.
 * @private
 */
ui.ComposeGlass.prototype.shouldSignMessage_ = function() {
  var recipients = this.chipHolder_.getSelectedUids();
  // If there are no recipients, don't sign the message.
  if (recipients.length === 0) {
    return false;
  }
  // Issue #26: For corpmail release, only sign if all recipients are yahoo-inc.
  for (var i = 0; i < recipients.length; i++) {
    if (utils.text.extractValidYahooEmail(recipients[i]) === null) {
      return false;
    }
  }
  return true;
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
  var from = goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value;
  this.updateActiveContent_(
      text, recipients, subject, from, goog.bind(this.close, this));
};


/**
 * Fetches and imports missing keys for the email recipients.
 * @param {function(!Array.<string>, !Array.<string>)} callback
 * @private
 */
ui.ComposeGlass.prototype.fetchKeys_ = function(callback) {
  var invalidRecipients = this.getInvalidRecipients_();
  console.log('in fetchKeys with invalid recipients', invalidRecipients);
  this.keyserverClient.fetchAndImportKeys(invalidRecipients,
      goog.bind(function(results) {
        var newValidRecipients = [];
        var newInvalidRecipients = [];
        goog.object.forEach(results, function(value, key) {
          if (value === true) {
            newValidRecipients.push(key);
          } else {
            newInvalidRecipients.push(key);
          }
        });
        callback(newValidRecipients, newInvalidRecipients);
      }, this), goog.bind(function() {
        this.displayFailure_(
            new e2e.ext.keyserver.AuthError('Please login to your ' +
                                            'corpmail account!'));
      }, this));
};


/**
 * Pops a warning if any of the recipients does not have a public key.
 * @param {!Array.<string>=} opt_recipients
 * @param {function()=} opt_callback
 * @private
 */
ui.ComposeGlass.prototype.handleMissingPublicKeys_ = function(opt_recipients,
                                                              opt_callback) {
  var invalidRecipients = opt_recipients || this.getInvalidRecipients_();
  if (invalidRecipients.length > 0) {
    // Show dialog asking user to remove recipients without keys
    var message = goog.array.concat(
        chrome.i18n.getMessage('composeGlassConfirmRecipients'),
        invalidRecipients).join('\n');
    var dialog = new ui.dialogs.Generic(message, goog.bind(function(result) {
          goog.dispose(dialog);
          if (typeof result !== 'undefined') {
            // user clicked ok
            this.chipHolder_.removeUids(invalidRecipients);
          } else {
            this.sendUnencrypted_ = true;
          }
          if (opt_callback) {
            opt_callback();
          }
        }, this), ui.dialogs.InputType.NONE, undefined,
        chrome.i18n.getMessage('composeGlassRemoveRecipients'),
        chrome.i18n.getMessage('composeGlassSendUnencryptedMessage'));
    this.addChild(dialog, false);
    dialog.render(goog.dom.getElement(constants.ElementId.CALLBACK_DIALOG));
  }
};


/**
 * Returns recipients for which public keys are missing.
 * @param {!Array.<string>=} opt_recipients Optional list of
 *   recipients to check. Otherwise gets recipients from chipholder.
 * @return {!Array.<string>}
 * @private
 */
ui.ComposeGlass.prototype.getInvalidRecipients_ = function(opt_recipients) {
  var recipients = opt_recipients || this.chipHolder_.getSelectedUids();
  var validRecipients = this.allAvailableRecipients_;
  var invalidRecipients = [];
  goog.array.forEach(recipients, function(recipient) {
    if (!goog.array.contains(validRecipients,
                             utils.text.extractValidEmail(recipient))) {
      invalidRecipients.push(recipient);
    }
  });
  return invalidRecipients;
};

});  // goog.scope
