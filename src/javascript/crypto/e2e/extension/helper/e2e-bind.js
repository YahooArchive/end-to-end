// Copyright 2014 Yahoo Inc. All rights reserved.
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
 * @fileoverview Provides a wrapper around the E2E bind API for interacting
 * with Yahoo Mail.
 * @author Jonathan Pierce <jonathanpierce@outlook.com>
 * @author Yan Zhu <yzhu@yahoo-inc.com>
 */

goog.provide('e2e.ext.e2ebind');

goog.require('e2e.ext.Launcher');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.ui.ComposeGlassWrapper');
goog.require('e2e.ext.ui.GlassWrapper');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Uri');
goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.structs.Map');


goog.scope(function() {
var e2ebind = e2e.ext.e2ebind;
var ext = e2e.ext;
var constants = ext.constants;
var utils = e2e.ext.utils;
var ui = ext.ui;

// If we see these actions, we are seeing a response
var responseActions = ['has_draft', 'get_draft', 'set_draft',
  'get_current_message', 'popup_opened', 'popup_closed'];
// If we see these actions, we are seeing a request
var requestActions = ['start', 'install_read_glass', 'install_compose_glass',
  'validate_signer', 'validate_recipients', 'set_signer'];

/**
* Hash table for associating unique IDs with request/response pairs
* @class hash
* @private
*/
var hash_ = (function() {
  var table = {};

  /**
  * Generates a non-cryptographically random string of length 10
  * @public
  */
  var genRandom = function() {
    var input = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    var result = '';
    for (var i = 0; i < 10; i++) {
      var next = input.charAt(Math.floor(Math.random(Date.now()) * input.length));
      result += next;
    }
    return result;
  };

  /**
  * Generates a hash and associates it with an action and callback
  * @param {string} action - The action associated with the hash
  * @param {Function=} callback - The callback associated with the hash.
  * @return {string} - The generated hash
  * @public
  */
  var add = function(action, callback) {
    var hash = genRandom();
    while (table[hash]) {
      // Ensure unqiueness.
      hash = genRandom();
    }
    table[hash] = {
      action: action,
      callback: callback
    };
    return hash;
  };

  /**
  * Returns the action/callback pair associated with a hash
  * @param {string} hash - The hash we are comparing to in the store
  * @param {string} action - The action we are checking against
  * @return {?Object} - The action/callback pair associated with the
  *   hash, or null if not found
  * @public
  */
  var get = function(hash, action) {
    var result = null;
    if (table[hash] && table[hash].action === action) {
      result = table[hash];
    }
    delete table[hash];
    return result;
  };

  return {
    add: add,
    get: get,
    random: genRandom
  };
})();

e2ebind.started = false;

/**
* Listen for responses and requests to/from the provider.
*/
e2ebind.start = function() {
  var uri = new goog.Uri(window.location.href);
  if (!uri.getParameterValue('endtoend')) {
    uri.setParameterValue('endtoend', 1);
    uri.setParameterValue('composev3', 0);
    window.location.href = uri.toString();
    return;
  }
  window.addEventListener('message', function(message) {
    if (!message.data || message.data[0] !== '{') {
      return;
    }

    // Makes sure the received messages comes from an appropoved source.
    function validateOrigin() {
      if (message.source === window.self &&
          message.origin === window.location.origin) {
        return true;
      }
      return false;
    }

    try {
      var data = JSON.parse(message.data);

      if (!validateOrigin() || !data || data.api !== 'e2ebind' || !data.hash ||
          !data.action || !data.source || data.source === 'E2E') {
        // Silently drop.
        return;
      }
      console.log('e2ebind got message', message);

      if (requestActions.indexOf(data.action) !== -1) {
        // This is a request
        handleRequest_(data);
      } else {
        if (responseActions.indexOf(data.action) !== -1) {
          // This is a response
          handleResponse_(data);
        } else {
          return;
        }
      }
    } catch (ex) {
      return;
    }
  });
  // Listen for when the encryption icon is clicked
  goog.events.listen(window, goog.events.EventType.CLICK, function(e) {
    var elt = e.target;
    if (elt.id === 'endtoend') {
      console.log('Got click on element', elt);
      sendExtensionRequest_({
        action: 'get_started'
      }, goog.bind(function(response) {
        if (!response.started) {
          window.alert(chrome.i18n.getMessage('glassKeyringLockedError'));
        } else {
          var composeElem = goog.dom.getAncestorByTagNameAndClass(elt,
                                                                 'div',
                                                                 'compose');
          var draft = {};
          var mode = 'scroll';
          draft.from = '<' + window.config.signer + '>';

          e2ebind.has_draft(goog.bind(function(has_draft_result) {
            if (has_draft_result.has_draft) {
              e2ebind.get_draft(goog.bind(function(get_draft_result) {
                console.log('e2ebind got draft', get_draft_result);
                draft.body = e2e.openpgp.asciiArmor
                  .extractPgpBlock(get_draft_result.body);
                draft.to = get_draft_result.to;
                draft.cc = get_draft_result.from;
                draft.bcc = get_draft_result.bcc;
                draft.subject = get_draft_result.subject;
                installComposeGlass_(composeElem, draft, mode);
              }, this));
            } else {
              e2ebind.get_current_message(goog.bind(function(get_msg_result) {
                console.log('e2ebind got current message', get_msg_result);
                var DOMelem = document.querySelector(get_msg_result.elem);
                if (get_msg_result.text) {
                  draft.body = get_msg_result.text;
                } else if (DOMelem) {
                  draft.body = e2e.openpgp.asciiArmor.extractPgpBlock(
                    goog.isDef(DOMelem.lookingGlass) ?
                    DOMelem.lookingGlass.getOriginalContent() :
                    DOMelem.innerText
                  );
                }
                installComposeGlass_(composeElem, draft, mode);
              }, this));
            }
          }, this));
        }
      }, this));
    }
  }, true);
};

/**
* Sends a request to the provider.
* @param {string} action - The action we wish the complete
* @param {?Object} args - The arguments to this action
* @param {Function=} callback - The function to callback with the response
* @public
*/
e2ebind.sendRequest = function(action, args, callback) {
  if (responseActions.indexOf(action) === -1) {
    return;
  }

  var reqObj = {
    api: 'e2ebind',
    source: 'E2E',
    action: action,
    args: args,
    hash: hash_.add(action, callback)
  };

  console.log('e2ebind sending message to page', reqObj);
  window.postMessage(window.JSON.stringify(reqObj), window.location.origin);
};

/**
* Sends a response to a request from a provider
* @param {Object} result - The result field of the response message
* @param {Object} request - The request we are responding to
* @param {Boolean} success - Whether or not the request was successful.
* @private
*/
var sendResponse_ = function(result, request, success) {
  var returnObj = {
    api: 'e2ebind',
    result: result,
    success: success,
    action: request.action,
    hash: request.hash,
    source: 'E2E'
  };

  window.postMessage(window.JSON.stringify(returnObj), window.location.origin);
};

/**
* Handles a response to a request we sent
* @param {Object} response - The response to a request we sent.
* @private
*/
var handleResponse_ = function(response) {
  // Call the callback associated with this request
  var request = hash_.get(response.hash, response.action);

  if (!request) {
    return;
  }

  if (request.callback) {
    request.callback(response);
  }
};

/**
* Sends a response to a request from a provider
* @param {Object} message - The message revied from the extension
* @private
*/
var glassSizeHandler_ = function(message) {
  if (!message.e2ebind || !message.args || !message.action ||
      message.action !== 'set_glass_size' || !message.args.height ||
      !message.args.selector) {
    return;
  }

  // console.log('E2E GLASS RESIZE: ' + message.args.height);

  var elem = document.querySelector(message.args.selector);

  elem.style.height = message.args.height + 'px';
  elem.children[0].style.height = message.args.height + 'px';
};

/**
* Handle an incoming request from the provider.
* @param {Object} request - The request from the provider.
* @private
*/
var handleRequest_ = function(request) {
  if (request.action !== 'start' && !e2ebind.started) {
    console.log("e2e cannot handle request since it hasn't started", request);
    // We can't respond to any requests from the provider until we've started.
    return;
  }

  var args = request.args;

  switch (request.action) {
    case 'start':
      (function() {
        console.log('e2e got request to start');
        if (!e2ebind.started) {
          // Note that we've attempted to start, and set the config
          e2ebind.started = true;
          window.config = {
            signer: String(args.signer),
            version: String(args.version),
            read_glass_enabled: Boolean(args.read_glass_enabled),
            compose_glass_enabled: Boolean(args.compose_glass_enabled)
          };

          // Verify the signer
          validateSigner_(String(args.signer), function(valid) {
            window.valid = valid;
            sendResponse_({valid: valid}, request, true);

            if (valid) {
              // Start listening for glass resize events
              chrome.runtime.onMessage.addListener(glassSizeHandler_);
            }
          });
        } else {
          // We've already started. Dispose.
          sendResponse_(null, request, false);
          window.helper.dispose();
        }
      })();

      break;

    case 'install_read_glass':
      (function() {
        if (window.config.read_glass_enabled && args.messages && args.mode &&
            window.valid) {
          try {
            goog.array.forEach(args.messages, function(message) {
              // Due to legacy code in Storm, message.elem is actually
              // a selector, not a DOM element. TODO(yan): Fix Storm.
              var DOMelem = document.querySelector(message.elem);
              var selector = message.elem;
              installReadGlass_(DOMelem,
                                message.text,
                                String(args.mode),
                                selector);
            });
            sendResponse_(null, request, true);
          } catch (ex) {
            console.log('install read glass failed');
            success = false;
            sendResponse_(null, request, false);
          }
        }
      })();

      break;

    case 'install_compose_glass':
      // Obsolete until YMail API is modified to be more useful
      break;

    case 'set_signer':
      (function() {
        // Same as validateSigner_, but updates the signer/valid in E2E
        if (!args.signer) {
          return;
        }
        window.config.signer = String(args.signer);
        try {
          validateSigner_(String(args.signer), function(valid) {
            window.valid = valid;
            sendResponse_({valid: valid}, request, true);
          });
        } catch (ex) {
          sendResponse_(null, request, false);
        }
      })();

      break;

    case 'validate_signer':
      (function() {
        try {
          if (!args.signer) {
            return;
          }
          validateSigner_(String(args.signer), function(valid) {
            sendResponse_({valid: valid}, request, true);
          });
        } catch (ex) {
          sendResponse_(null, request, false);
        }
      })();

      break;

    case 'validate_recipients':
      (function() {
        try {
          if (!args.recipients || !(args.recipients instanceof Array) ||
             !window.valid) {
            return;
          }
          validateRecipients_(args.recipients, function(results) {
            sendResponse_({results: results}, request, true);
          });
        } catch (ex) {
          sendResponse_(null, request, false);
        }
      })();

      break;
  }
};

/**
* Installs a read looking glass in the page.
* @param {Element} elem -  element to install the glass in
* @param {string=} text - Optional alternative text to elem's innerText
* @param {string=} mode - String literal 'scroll' or 'resize', indicating glass's behavior
* @param {string=} selector - selector for the element to install glass in
*   (needed for resizing/scrolling)
* @private
*/
var installReadGlass_ = function(elem, text, mode, selector) {
  var DOMelem = elem;
  text = text ? String(text) : null;

  if (!DOMelem) {
    throw 'Element not found.';
  }

  if (Boolean(DOMelem.lookingGlass)) {
    console.log('DOM element has lookingGlass');
    return;
  }

  var selectionBody = e2e.openpgp.asciiArmor.extractPgpBlock(
    text ? text : DOMelem.innerText
  );
  var action = utils.text.getPgpAction(selectionBody, true);

  if (action == constants.Actions.DECRYPT_VERIFY) {
    var glassWrapper = new ui.GlassWrapper(DOMelem, text, mode, selector);
    window.helper.registerDisposable(glassWrapper);
    glassWrapper.installGlass();
  }
};

/**
* Installs a compose glass in the page.
* @param {Element} elem -  element to install the glass in
* @param {Object} draft - The draft content to put in the glass
* @param {string=} mode - String literal 'scroll' or 'resize', indicating glass's behavior
*   (needed for resizing/scrolling)
* @private
*/
var installComposeGlass_ = function(elem, draft, mode) {
  var DOMelem = elem;

  if (!DOMelem) {
    throw 'Element not found.';
  }

  if (Boolean(DOMelem.composeGlass)) {
    console.log('DOM element already has composeGlass');
    return;
  }

  var hash = hash_.random();
  var glassWrapper = new ui.ComposeGlassWrapper(elem, draft, mode, hash);
  window.helper.registerDisposable(glassWrapper);
  glassWrapper.installGlass();

  var closeHandler = function(message) {
    if (message.e2ebind && message.glass_closed &&
        (message.hash === glassWrapper.hash)) {
      console.log('e2ebind got glass closed');
      glassWrapper.dispose();
      chrome.runtime.onMessage.removeListener(closeHandler);
    }
  };

  // Listen for when the glass should be removed
  chrome.runtime.onMessage.addListener(closeHandler);
};

/**
* Gets the currently selected message, if any, from the provider
* @param {Function=} callback - The callback to call with the result
* @public
*/
e2ebind.get_current_message = function(callback) {
  e2ebind.sendRequest('get_current_message', null, function(data) {
    var elem = null;
    var text = null;

    if (data.result && data.success) {
      var result = data.result;
      elem = result.elem ? result.elem : null;
      text = result.text ? result.text : null;
    }

    callback({elem: elem, text: text});
  });
};

/**
* Gets the current draft/compose from the provider.
* @param {Function=} callback - The callback to call with the result
* @public
*/
e2ebind.get_draft = function(callback) {
  e2ebind.sendRequest('get_draft', null, function(data) {
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
 * @expose
 * @public
 */
e2ebind.has_draft = function(callback) {
  e2ebind.sendRequest('has_draft', null, function(data) {
    var result = {has_draft: false};

    if (data.success && data.result.has_draft) {
      result.has_draft = true;
    }

    callback(result);
  });
};

/**
* Sets the currently active draft/compose in the provider
* @param {Object} args - The data to set the draft with.
* @public
*/
e2ebind.set_draft = function(args) {
  // TODO(yan): Doesn't work when multiple provider compose windows are open
  // on the same page
  e2ebind.sendRequest('set_draft', {
    to: args.to || [],
    cc: args.cc || [],
    bcc: args.bcc || [],
    subject: args.subject || '',
    body: args.body || ''
  }, null);
};

/**
* Tells the provider when the extension's popup is opened, and then when its closed.
* @public
*/
e2ebind.popup_opened = function() {
  if (window.valid) {

    // Inform the page that the poppup opened
    e2ebind.sendRequest('popup_opened', null, null);

    // Listen for when we close
    var closeHandler = function(message) {
      if (message.e2ebind && message.popup_closed) {
        e2ebind.sendRequest('popup_closed', null, null);

        chrome.runtime.onMessage.removeListener(closeHandler);
      }
    };

    chrome.runtime.onMessage.addListener(closeHandler);
  }
};

/**
* Sends a request to the launcher to perform some action.
* @param {Object} args - The message we wish to send to the launcher,
*   should heve an 'action' property.
* @param {Function=} callback - Callback to call with the result.
* @private
*/
var sendExtensionRequest_ = function(args, callback) {
  var respHandler = function(message) {
    if (!message.e2ebind || !(message.keys ||
                              message.hasOwnProperty('started'))) {
      return;
    }

    console.log('E2E REQUEST SUCCESS: ' + JSON.stringify(message));
    if (callback) {
      callback(message);
    }
    chrome.runtime.onMessage.removeListener(respHandler);
  };

  chrome.runtime.onMessage.addListener(respHandler);
  args.e2ebind = true;
  chrome.runtime.sendMessage(args);
};

/**
* Validates whather or not we have a private key for this signer.
* @param {string} signer - The signer ("name@domain.com") we wish to validate
* @param {Function} callback - Callback to call with the result.
* @private
*/
var validateSigner_ = function(signer, callback) {
  sendExtensionRequest_({
    action: 'get_private_keys'
  }, function(response) {
    var valid = false;
    if (response.keys.indexOf('<' + signer + '>') >= 0) {
      valid = true;
    }
    // console.log('E2E validateSigner_: valid->' + valid);
    callback(valid);
  });
};

/**
* Validates whether we have a public key these recipients.
* @param {string[]} recipients - The recipients we are checking
* @param {Function} callback - Callback to call with the result.
* @private
*/
var validateRecipients_ = function(recipients, callback) {
  sendExtensionRequest_({
    action: 'get_public_keys'
  }, function(response) {
    var results = [];
    for (var i = 0; i < recipients.length; i++) {
      var valid = false;
      if (response.keys.indexOf('<' + recipients[i] + '>') >= 0) {
        valid = true;
      }
      results.push({valid: valid, recipient: recipients[i]});
    }
    callback(results);
  });
};

}); // goog.scope
