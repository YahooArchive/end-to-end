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
 * @fileoverview Respond to different kinds of events in Yahoo Mail
 */

goog.provide('e2e.ext.Helper.YmailApi');
goog.provide('e2e.ext.Helper.YmailApi.StormUI');

goog.require('e2e.ext.e2ebind');
goog.require('goog.Disposable');
goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');


goog.scope(function() {
var ext = e2e.ext;
var constants = ext.constants;
var messages = ext.messages;
var utils = ext.utils;
var e2ebind = ext.e2ebind;

var Helper = e2e.ext.Helper;
var YmailApi = Helper.YmailApi;



/**
 * Constructor for the Ymail Helper
 * @constructor
 * @extends {goog.Disposable}
 */
Helper.YmailApi = function() {

  var websiteEvents = new YmailApi.StormUI();

  goog.events.listen(websiteEvents, 'compose',
      goog.bind(this.installAutoComposeGlass, this));

  goog.events.listen(websiteEvents, 'encrypted-compose',
      goog.bind(this.installComposeGlass, this));


  this.registerDisposable(websiteEvents);
};
goog.inherits(Helper.YmailApi, goog.Disposable);


/**
 * Execute the callback with the fetched config
 * @param {!string} property The config property name
 * @param {!function(*)} callback The callback to receive the config value
 */
Helper.YmailApi.prototype.getConfig = function(property, callback) {
  utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: constants.Actions.GET_PREFERENCE,
    content: property
  }), function(response) {
    callback(response.content);
  }, callback);
};


/**
 * Trigger auto installation of compose glass
 * @param {Event} evt The compose event
 * @protected
 */
Helper.YmailApi.prototype.installAutoComposeGlass = function(evt) {
  // default to open the compose glass if so configured
  this.getConfig(constants.StorageKey.ENABLE_COMPOSE_GLASS, 
    goog.bind(function(value) {
      value === 'true' && this.installComposeGlass(evt);
    }, this));
};


/**
 * Trigger auto installation of compose glass
 * @param {Event} evt The encrypted-compose event
 * @protected
 */
Helper.YmailApi.prototype.installComposeGlass = function(evt) {
  var elem = /** @type {Element} */ (evt.target);

  if (!elem.composeGlass || elem.glassDisposed) {
    elem.composeGlass = true;
    elem.focus();

    var glassWrapper = new e2e.ext.ui.ComposeGlassWrapper(elem);
    glassWrapper.onApiRequest('getDraft', function() {
      return asyncDraftResult;
    });

    // TODO: draft.body (or equiv., .innerText) preserves line breaks only if
    // the element is visible.
    var asyncDraftResult = new e2e.async.Result;
    e2ebind.getDraft(goog.bind(function(draft) {
        asyncDraftResult.callback(draft ? {
          from: this.getUid() || '',
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          subject: draft.subject,
          body: e2e.openpgp.asciiArmor.extractPgpBlock(draft.body),
          contacts: draft.contacts,
          insideConv: Boolean(goog.dom.getAncestorByTagNameAndClass(
              /** @type {Node} */ (elem), 'div', 'thread-item-list'))
        } : {from: this.getUid || ''});

        glassWrapper.installGlass();
      }, this));

    this.registerDisposable(glassWrapper);
  }
};


/**
 * Return the current user id
 * @return {string|null} The user id
 */
Helper.YmailApi.prototype.getUid = function() {
  var metaData = document.getElementById('yucs-meta');
  return metaData && metaData.getAttribute('data-userid');
};



/**
 * Constructor for the YMail Event Target Helper class.
 * @constructor
 * @extends {goog.events.EventTarget}
 */
YmailApi.StormUI = function() {
  goog.base(this);

  this.addCSS();
  this.monitorComposeEvent_();
};
goog.inherits(YmailApi.StormUI, goog.events.EventTarget);


/** @override */
YmailApi.StormUI.prototype.disposeInternal = function() {
  this.composeObserver_ && this.composeObserver_.disconnect();
  goog.base(this, 'disposeInternal');
};


/**
 * Monitor for creations of compose element, firing compose event
 * @private
 */
YmailApi.StormUI.prototype.monitorComposeEvent_ = function() {
  var target = document.querySelector('#shellinner');
  if (!target) {
    return;
  }

  // monitor the compose creation
  this.composeObserver_ = new MutationObserver(goog.bind(function(mutations) {
    goog.array.some(mutations, function(mutation) {
      var target = mutation.target && mutation.addedNodes.length &&
          (mutation.target.classList.contains('thread-item') ||
              mutation.target.classList.contains('tab-content')) &&
          goog.array.find(mutation.addedNodes, function(node) {
            return node.classList.contains('compose');
          });
      if (target) {
        // this.monitorComposeRemovalEvent_(target);
        this.addEncryptrIcon_(target);
        this.dispatchEvent(new goog.events.Event('compose', target));
        return true;
      }
      return false;
    }, this);
  }, this));

  this.composeObserver_.observe(target, /** @type {MutationObserverInit} */ ({
    childList: true, subtree: true
  }));
};


/**
 * //@yahoo TODO: put these CSS inside Ymail
 * Add inline CSS to the page
 * @protected
 */
YmailApi.StormUI.prototype.addCSS = function() {
  var style = document.createElement('style');
  style.appendChild(document.createTextNode(
      '.lozenge-secure .lozenge-static:before,' +
          ' .lozenge-secure.lozengfy:before {content:""}' +
      '#endtoend.icon-encrypt {display:none}' +
      '.icon-encrypt {position:relative;float:right;padding:0;opacity:.6}' +
      '.icon-encrypt:hover {opacity:1}' +
      '.icon-encrypt + .cm-rtetext {padding-right:25px}'));
  document.head.appendChild(style);
};


/**
 * Add encryptr icon to compose, firing encrypted-compose event when clicked.
 * @param {Element} target The compose element
 * @private
 */
YmailApi.StormUI.prototype.addEncryptrIcon_ = function(target) {
  var textArea = target.querySelector('.cm-rtetext');
  var encryptrIcon = document.createElement('div');
  encryptrIcon.classList.add('icon', 'icon-encrypt');
  encryptrIcon.addEventListener('click', goog.bind(function(evt) {
    this.dispatchEvent(new goog.events.Event('encrypted-compose', target));
  }, this), false);

  textArea.parentElement.insertBefore(encryptrIcon, textArea);
};


// YmailApi.StormUI.prototype.monitorComposeRemovalEvent_ = function(target) {
//   this.removalObserver_ = new MutationObserver(
//       goog.bind(function(mutations) {
//         goog.array.forEach(mutations, function(mutation) {
//           mutation.removedNodes.length &&
//               mutation.removedNodes[0] === target &&
//               this.dispatchEvent(
//                   new goog.events.Event('composeRemoved', target));
//         }, this);
//       }, this));

//   target.parentElement &&
//       this.removalObserver_.observe(
//           target.parentElement, {childList: true});
// };


});  // goog.scope
