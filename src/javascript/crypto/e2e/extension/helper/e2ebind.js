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
 * @fileoverview Provides a wrapper around the E2E bind API for interacting
 *   with Yahoo Mail.
 * @author jonathanpierce@outlook.com (Jonathan Pierce)
 * @author yzhu@yahoo-inc.com (Yan Zhu)
 */

goog.provide('e2e.ext.e2ebind');

goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.constants.StorageKey');
goog.require('e2e.ext.constants.e2ebind.requestActions');
goog.require('e2e.ext.constants.e2ebind.responseActions');
goog.require('e2e.ext.ui.ComposeGlassWrapper');
goog.require('e2e.ext.ui.GlassWrapper');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.CallbacksMap');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.string');
goog.require('goog.style');

goog.scope(function() {
var e2ebind = e2e.ext.e2ebind;
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;
var utils = e2e.ext.utils;
var ui = e2e.ext.ui;


/**
 * Timeout for requests sent to website API connectors (in ms).
 * @type {number}
 * @const
 */
e2ebind.REQUEST_TIMEOUT = 5000;


/**
 * True if e2ebind has been started.
 * @type {boolean}
 * @private
 */
e2ebind.started_ = false;


/**
 * Checks if e2ebind has been started.
 * @return {boolean}
 */
e2ebind.isStarted = function() {
  return e2ebind.started_;
};


/**
* Start listening for responses and requests to/from the provider.
*/
e2ebind.start = function() {
  // init the config first
  window.config = {};

  /**
   * Object storing response callbacks for API calls in progress
   * @type {!e2e.ext.utils.CallbacksMap}
   * @private
   */
  e2ebind.pendingCallbacks_ = new e2e.ext.utils.CallbacksMap();

  // Register the click handler
  goog.events.listen(document.body, goog.events.EventType.CLICK,
                     e2ebind.clickHandler_, true);

  // Register handler for when the compose area is focused
  goog.events.listen(document.body, goog.events.EventType.FOCUS,
                     e2ebind.clickHandler_, true);


  // Register the handler for messages from the provider
  window.addEventListener('message', e2ebind.messageHandler_);
};


/**
 * Stops the e2ebind API
 */
e2ebind.stop = function() {
  window.removeEventListener('message', e2ebind.messageHandler_);
  e2ebind.started_ = false;
  goog.events.unlisten(document.body, goog.events.EventType.CLICK,
                       e2ebind.clickHandler_);
  goog.events.unlisten(document.body, goog.events.EventType.FOCUS,
                       e2ebind.clickHandler_);
};


/**
 * Custom click event handler for e2ebind page elements.
 * @param {Event} e The click event object.
 * @private
 */
e2ebind.clickHandler_ = function(e) {
  var elt = e.target || document.activeElement;
  // The encryptr icon was clicked; initiate the compose glass
  if (elt.id === constants.ElementId.E2EBIND_ICON && e.type === 'click') {
    e2ebind.initComposeGlass_(elt, true);
    return;
  }

  // the event target must not be nested under '.reply-text'
  if (!goog.dom.getAncestorByTagNameAndClass(
      elt, 'div', constants.CssClass.COMPOSE_CONTAINER_REPLY_EXCEPTION) &&
      // get parent element whose class is 'compose'
      (elt = goog.dom.getAncestorByTagNameAndClass(
          elt, 'div', constants.CssClass.COMPOSE_CONTAINER)) &&
      // the parent element must not be nested under '.iris-window'
      !goog.dom.getAncestorByTagNameAndClass(
          elt, 'div', constants.CssClass.COMPOSE_CONTAINER_IRIS_EXCEPTION)) {

    // default to open the compose glass if so configured
    utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
      action: constants.Actions.GET_PREFERENCE,
      content: constants.StorageKey.ENABLE_COMPOSE_GLASS
    }), function(response) {
      response.content == 'true' && e2ebind.initComposeGlass_(elt);
    });

  }

};


/**
 * On focus event handler.
 * @param {Element} e The element that was focused
 * @private
 */
e2ebind.focusHandler_ = function(e) {
  // Default it to require clicking the encryptr icon to install compose glass
  // TODO: uncomment the following, and make this configurable

  // var elt = e.target;
  // if (goog.dom.getAncestorByTagNameAndClass(elt,
  //                                       'div',
  //                                       constants.CssClass.COMPOSE_BODY)) {
  //   // The user focused on the email body editor. If all the recipients have
  //   // keys, initiate the compose glass
  //   try {
  //     e2ebind.getDraft(goog.bind(function(draft) {
  //       draft.to = draft.to || [];
  //       draft.cc = draft.cc || [];
  //       draft.bcc = draft.bcc || [];
  //       var recipients = draft.to.concat(draft.cc).concat(draft.bcc);

  //       utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
  //         action: constants.Actions.LIST_ALL_UIDS,
  //         content: 'public'
  //       }), function(response) {
  //         response.content = response.content || [];
  //         var invalidRecipients = /** @type {!Array.<string>} */ ([]);

  //         var emails = utils.text.getValidEmailAddressesFromArray(
  //             response.content, true);
  //         goog.array.forEach(recipients, function(recipient) {
  //           var valid = goog.array.contains(emails, recipient);
  //           if (!valid) {
  //             invalidRecipients.push(recipient);
  //           }
  //         });

  //         if (invalidRecipients.length === 0) {
  //           e2ebind.initComposeGlass_(null);
  //         }
  //       });
  //     }, this));
  //   } catch (ex) {
  //     console.error(ex);
  //   }
  // }
};


/**
 * onmessage event listener.
 * @param {!Object} response The message sent from the page via
 *   window.postMessage.
 * @private
 */
e2ebind.messageHandler_ = function(response) {
  try {
    var data = window.JSON.parse(response.data);
    if (response.source !== window.self ||
        response.origin !== window.location.origin ||
        data.api !== 'e2ebind' || data.source === 'E2E') {
      return;
    }

    var action = data.action.toUpperCase();
    if (action in constants.e2ebind.requestActions) {
      e2ebind.handleProviderRequest_(/** @type {messages.e2ebindRequest} */
                                     (data));
    } else if (action in constants.e2ebind.responseActions) {
      e2ebind.handleProviderResponse_(/** @type {messages.e2ebindResponse} */
                                      (data));
    }
  } catch (e) {}
};


/**
* Sends a request to the provider.
* @param {string} action The action requested.
* @param {Object} args The arguments to the action.
* @param {function(messages.e2ebindResponse)} callback The function to
*   callback with the response
*/
e2ebind.sendRequest = function(action, args, callback) {
  var hash = e2ebind.pendingCallbacks_.addCallbacks(
      callback, goog.nullFunction);

  var reqObj = /** @type {messages.e2ebindRequest} */ ({
    api: 'e2ebind',
    source: 'E2E',
    action: action,
    args: args,
    hash: hash
  });
  var timeoutResponse = /** @type {messages.e2ebindResponse} */ ({
    action: action,
    error: 'Timeout occurred while processing the request.',
    hash: hash
  });
  // Set a timeout for a function that would simulate an error response.
  // If the response was processed before the timeout, handleProviderResponse_
  // will just silently bail out.
  setTimeout(
      goog.bind(e2ebind.handleProviderResponse_, e2ebind, timeoutResponse),
      e2ebind.REQUEST_TIMEOUT);

  window.postMessage(window.JSON.stringify(reqObj), window.location.origin);
};


/**
* Handles a response to a request we sent
* @param {messages.e2ebindResponse} response The provider's response to a
*   request we sent.
* @private
*/
e2ebind.handleProviderResponse_ = function(response) {
  if (response.hash) {
    try {
      var callbacks = e2ebind.pendingCallbacks_.getAndRemove(response.hash);
      callbacks && callbacks.callback(response);
    } catch (err) {}
  }
};


/**
* Handle an incoming request from the provider.
* @param {messages.e2ebindRequest} request The request from the provider.
* @private
*/
e2ebind.handleProviderRequest_ = function(request) {
  var actions = constants.e2ebind.requestActions;

  if (request.action !== actions.START && !e2ebind.started_) {
    return;
  }

  var args = request.args;

  switch (request.action) {
    case actions.START:
      if (e2ebind.started_) {
        // We've already started.
        e2ebind.sendResponse_(null, request, false);
        break;
      }

      // Note that we've attempted to start, and set the config
      e2ebind.started_ = true;
      window.config = {
        signer: String(args.signer),
        version: String(args.version)
      };

      // Verify the signer
      e2ebind.validateSigner_(args.signer);
      // Always return true to add encryptr button
      e2ebind.sendResponse_({valid: true}, request, true);
      break;

    case actions.INSTALL_READ_GLASS:
      if (args.messages) {
        try {
          goog.array.forEach(args.messages, function(message) {
            // XXX: message.elem is a selector string, not a DOM element
            e2ebind.installReadGlass_(
                document.querySelector(message.elem),
                message.text);
          });
          e2ebind.sendResponse_(null, request, true);
        } catch (ex) {
          e2ebind.sendResponse_(null, request, false);
        }
      }
      break;

    case actions.INSTALL_COMPOSE_GLASS:
      // TODO: YMail should send the draft element instead of null!
      e2ebind.initComposeGlass_(args.elem);
      break;

    case actions.SET_SIGNER:
      // TODO: Page doesn't send message when selected signer changes.
      // validates and updates the signer/validity in E2E
      if (!args.signer) {
        break;
      }
      window.config.signer = String(args.signer);

    case actions.VALIDATE_SIGNER:
      try {
        e2ebind.validateSigner_(args.signer, function(valid) {
          e2ebind.sendResponse_({valid: valid}, request, true);
        });
      } catch (ex) {
        e2ebind.sendResponse_(null, request, false);
      }
      break;

    case actions.VALIDATE_RECIPIENTS:
      try {
        e2ebind.validateRecipients_(args.recipients, function(response) {
          e2ebind.sendResponse_({results: response}, request, true);
        });
      } catch (ex) {
        e2ebind.sendResponse_(null, request, false);
      }
      break;
  }
};


/**
* Sends a response to a request from a provider
* @param {Object} result The result field of the response message
* @param {messages.e2ebindRequest} request The request we are responding to
* @param {boolean} success Whether or not the request was successful.
* @private
*/
e2ebind.sendResponse_ = function(result, request, success) {
  var returnObj = /** @type {messages.e2ebindResponse} */ ({
    api: 'e2ebind',
    result: result,
    success: success,
    action: request.action,
    hash: request.hash,
    source: 'E2E'
  });

  window.postMessage(window.JSON.stringify(returnObj), window.location.origin);
};


/**
 * The active compose element.
 * @type {Element}
 * @private
 */
e2ebind.activeComposeElem_ = null;


/**
 * Starts initializing the compose glass if either the lock icon was clicked
 * or if at least one recipient has a PGP key or the message is a PGP message.
 * @param {Element} elt Element for the lock icon or null if one was not clicked
 * @param {boolean=} opt_isExplicit Whether it is explicitly triggered by user.
 * @private
 */
e2ebind.initComposeGlass_ = function(elt, opt_isExplicit) {
  elt = elt || e2ebind.activeComposeElem_;

  // quit under the following conditions
  // - no valid compose element to install the glass in
  // - the glass is already installed
  // - skip auto trigger since this is implicitly triggered by clicks/focuses
  if (!elt || elt.composeGlass || (!opt_isExplicit && elt.glassDisposed)) {
    return;
  }
  elt.composeGlass = true;

  // get parent element whose class is 'compose'
  e2ebind.activeComposeElem_ = goog.dom.getAncestorByTagNameAndClass(
      elt, 'div', constants.CssClass.COMPOSE_CONTAINER);

  // // We have to unhide the PGP blob so that text shows up in compose glass
  // var textElem = goog.dom.getElement(constants.ElementId.E2EBIND_TEXT);
  // if (textElem) {
  //   goog.style.setElementShown(textElem, true);
  // }

  // Get the compose window associated with the clicked icon
  var draft = /** @type {messages.e2ebindDraft} */ ({
    from: window.config.signer || ''
  });

  e2ebind.hasDraft(function(hasDraftResult) {
    if (hasDraftResult) {
      e2ebind.getDraft(function(getDraftResult) {
        draft.body = e2e.openpgp.asciiArmor.
            extractPgpBlock(getDraftResult.body);
        draft.to = getDraftResult.to;
        draft.cc = getDraftResult.cc;
        draft.bcc = getDraftResult.bcc;
        draft.subject = getDraftResult.subject;
        draft.contacts = getDraftResult.contacts;
        e2ebind.installComposeGlass_(e2ebind.activeComposeElem_, draft);
      });
    } else {
      e2ebind.getCurrentMessage(function(result) {
        var DOMelem = document.querySelector(result.elem);
        draft.contacts = result.contacts || [];
        if (result.text) {
          draft.body = result.text;
        } else if (DOMelem) {
          draft.body = e2e.openpgp.asciiArmor.extractPgpBlock(
              goog.isDef(DOMelem.glass_) ?
              DOMelem.glass_.getOriginalContent() :
              DOMelem.innerText);
        }
        e2ebind.installComposeGlass_(e2ebind.activeComposeElem_, draft);
      });
    }
  });
};


/**
* Install a compose glass for the target element
* @param {Element} elem Element to install the glass in
* @param {!messages.e2ebindDraft} draft The draft content to put in the glass
* @private
*/
e2ebind.installComposeGlass_ = function(elem, draft) {
  var glassWrapper = new ui.ComposeGlassWrapper(elem, draft);
  window.helper && window.helper.registerDisposable(glassWrapper);
  glassWrapper.installGlass();
};


/**
 * Install looking glasses for a message Element
 * @param {Element} targetElem element to install the glasses in
 * @param {string=} opt_text Optional alternative text to elem's innerText
 * @param {number=} opt_limit Stop parsing once opt_limit armors have been
 *     parsed. Otherwise, the limit is hardcoded as 20.
 * @private
 */
e2ebind.installReadGlass_ = function(targetElem, opt_text, opt_limit) {
  if (targetElem.lookingGlass) {
    return;
  }
  targetElem.lookingGlass = true;

  var content = opt_text ? opt_text : targetElem.innerText;
  var armors, div, plaintext, glassWrapper, lastEndOffset = 0;

  try {
    armors = e2e.openpgp.asciiArmor.parseAll(content, opt_limit || 20);

    // no armor needs glass, or ignore binary OpenPGP message
    if (armors.length === 0 || armors[0].type === 'BINARY') {
      return;
    }
    
    goog.array.forEach(armors, function(armor) {
      var isValidDecryptVerifyArmor = false, textStartOffset = 0;

      if (armor.type === 'SIGNATURE') {
        // adjust startOffset to also capture whole message body
        textStartOffset = lastEndOffset + content.slice(lastEndOffset).
            indexOf('-----BEGIN PGP SIGNED MESSAGE-----');

        isValidDecryptVerifyArmor = true;
      } else if (armor.type === 'MESSAGE') {
        textStartOffset = armor.startOffset;
        isValidDecryptVerifyArmor = true;
      }

      // capture the text upto the next valid armor (or include it if invalid)
      plaintext = content.slice(lastEndOffset,
          isValidDecryptVerifyArmor ? textStartOffset : armor.endOffset);

      // insert the text before the next armor
      if (plaintext && goog.string.trim(plaintext)) {
        div = document.createElement('div');
        div.className = targetElem.className;
        div.innerHTML = (glassWrapper ? '<hr/>' : '') +
            goog.string.newLineToBr(goog.string.htmlEscape(plaintext)) +
            '<hr/>';
        goog.dom.insertSiblingBefore(div, targetElem);
      }

      // insert a glass to decrypt the next armor
      if (isValidDecryptVerifyArmor) {
        // add the original text to the armor object
        armor.text = content.slice(textStartOffset, armor.endOffset);

        glassWrapper = new ui.GlassWrapper(targetElem, armor);
        window.helper && window.helper.registerDisposable(glassWrapper);
        glassWrapper.installGlass();
      }

      lastEndOffset = armor.endOffset;
    });

    // hide the original target element if it's not hidden by a glass.
    if (!glassWrapper) {
      goog.style.setElementShown(targetElem, false);
    }

    // insert the remaining text
    plaintext = content.slice(lastEndOffset);
    if (plaintext && goog.string.trim(plaintext)) {
      div = document.createElement('div');
      div.className = targetElem.className;
      div.innerHTML = '<hr/>' + goog.string.newLineToBr(
        goog.string.htmlEscape(plaintext));
      goog.dom.insertSiblingBefore(div, targetElem);
    }

    targetElem.focus();

  } catch (err) {
    new ui.BaseGlassWrapper(targetElem).displayFailure(err);
  }
};


/**
* Gets the currently selected message, if any, from the provider
* @param {!function(Object)} callback The callback to call with the result
*/
e2ebind.getCurrentMessage = function(callback) {
  e2ebind.sendRequest(constants.e2ebind.responseActions.GET_CURRENT_MESSAGE,
                      null, function(data) {
        var result = data.result;

        if (result && data.success) {
          callback({
            elem: result.elem,
            text: result.text,
            contacts: result.contacts || []
          });
        } else {
          callback({});
        }
      });
};


/**
* Gets the current draft/compose from the provider.
* @param {!function(messages.e2ebindDraft)} callback The handler for draft
*/
e2ebind.getDraft = function(callback) {
  e2ebind.sendRequest(constants.e2ebind.responseActions.GET_DRAFT, null,
                      function(data) {
        var result = null;

        if (data.success) {
          result = data.result;
        }

        callback(result);
      });
};


/**
 * Indicates if there is an active draft in the provider.
 * @param {!function(boolean)} callback The callback where the active draft
 *     information should be passed.
 */
e2ebind.hasDraft = function(callback) {
  e2ebind.sendRequest(constants.e2ebind.responseActions.HAS_DRAFT, null,
                      function(data) {
        var result = false;

        data.result.has_draft = data.result.has_draft || false;
        if (data.success && data.result.has_draft) {
          result = true;
        }

        callback(result);
      });
};


/**
* Sets the currently active draft/compose in the provider
* @param {Object} args The data to set the draft with.
*/
e2ebind.setDraft = function(args) {
  // XXX: ymail doesn't handle setting the 'from' field when user has multiple
  // addresses.
  var selects = document.querySelectorAll('select#from-field');
  if (args.from && selects.length) {
    goog.array.forEach(selects, function(item) {
      goog.array.some(item.options, function(option) {
        if (utils.text.extractValidEmail(option.value) ===
            utils.text.extractValidEmail(args.from)) {
          item.value = option.value;
          return true;
        }
        return false;
      });
    });
  }

  // TODO(yan): Doesn't work when multiple provider compose windows are open
  // on the same page
  e2ebind.sendRequest(
      constants.Actions.SET_DRAFT,
      /** @type {messages.e2ebindDraft} */ ({
        to: args.to || [],
        cc: args.cc || [],
        // bcc must be empty as pgp doesn't support bcc
        subject: args.subject || '',
        body: args.body || '',
        send: args.send
      }), goog.nullFunction);
};


/**
 * Replaces encrypted/signed blob with an "Show encrypted/signed message" link.
 * @param {string} blob The encrypted/signed message
 * @private
 */
e2ebind.hideBlob_ = function(blob) {
  var textElem = goog.dom.getElement(constants.ElementId.E2EBIND_TEXT);
  if (!textElem) {
    console.warn('No text element found for e2ebind');
    return;
  }

  // Change the "show ..." link depending on whether encrypted or signed
  var hideMessage;
  var showMessage;
  if (e2e.openpgp.asciiArmor.isClearSign(blob)) {
    hideMessage = chrome.i18n.getMessage('e2ebindHideSigned');
    showMessage = chrome.i18n.getMessage('e2ebindShowSigned');
  // } else if (e2e.openpgp.asciiArmor.isEncrypted(blob)) {
  } else if (blob.indexOf('-----BEGIN PGP MESSAGE-----') !== -1) {
    hideMessage = chrome.i18n.getMessage('e2ebindHideEncrypted');
    showMessage = chrome.i18n.getMessage('e2ebindShowEncrypted');
  } else {
    return;
  }

  // Add a link to toggle encrypted text visibility as a sibling element
  var showEncryptedLink =
      goog.dom.getElement(constants.ElementId.E2EBIND_SHOW_ENCRYPTED_LINK);
  if (!showEncryptedLink) {
    showEncryptedLink = document.createElement('a');
    showEncryptedLink.href = '#';
    showEncryptedLink.id = constants.ElementId.E2EBIND_SHOW_ENCRYPTED_LINK;
    showEncryptedLink.style.color = '#878C91'; // FUJI grey 6
    showEncryptedLink.style['line-height'] = '50px';
    goog.dom.insertSiblingBefore(showEncryptedLink, textElem);
  }

  // Hide the encrypted blob by default
  goog.style.setElementShown(textElem, false);
  showEncryptedLink.textContent = showMessage;

  // Toggle message display when the "show ..." link is clicked
  showEncryptedLink.onclick = function() {
    if (goog.style.isElementShown(textElem)) {
      goog.style.setElementShown(textElem, false);
      showEncryptedLink.textContent = showMessage;
    } else {
      goog.style.setElementShown(textElem, true);
      showEncryptedLink.textContent = hideMessage;
    }
  };
};


/**
* Validates whether or not a private key exist for the signer, and that the
* server has a consistent keyring with the local.
* @param {string} signer The signer ("name@domain.com") we wish to validate
* @param {!function(boolean)=} opt_callback Callback to call with the result.
* @private
*/
e2ebind.validateSigner_ = function(signer, opt_callback) {
  if (!signer) {
    return;
  }
  signer = String(signer);

  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: constants.Actions.GET_ALL_KEYS_BY_EMAILS,
    recipients: [signer],
    content: 'private_exist'
  }), function(privKeyResponse) {
    if (privKeyResponse.content === false) {
      opt_callback && opt_callback(false);
      return;
    }

    utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
      action: constants.Actions.SYNC_KEYS,
      content: signer
    }), function(response) {
      if (response.content === false) {
        if (window.confirm(chrome.i18n.getMessage('confirmUserSyncKeys'))) {
          utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
            action: constants.Actions.CONFIGURE_EXTENSION,
            content: signer
          }));
        }
      }
      opt_callback && opt_callback(response.content);

    }, function(err) {
      opt_callback && opt_callback(false);
    });


  }, function(err) {
    opt_callback && opt_callback(false);
  });
};


/**
* Validates whether we have a public key for these recipients or if one
* is available on the keyserver.
* @param {Array.<string>} recipients The recipients we are checking
* @param {!function(!Object.<string, boolean>)} callback Callback to call with
*   the result.
* @private
*/
e2ebind.validateRecipients_ = function(recipients, callback) {
  if (!recipients || !goog.isArray(recipients)) {
    return;
  }
  // Check if the recipient is already in the keyring
  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: constants.Actions.GET_ALL_KEYS_BY_EMAILS,
    recipients: recipients,
    content: 'public_exist'
  }), function(response) {
    var hasKeysPerRecipient = response.content;

    callback(goog.array.map(recipients, function(recipient, i) {
      return {recipient: recipient, valid: hasKeysPerRecipient[i]};
    }));

  }, function() {
    // ignored error
    callback([]);
  });
};

});  // goog.scope
