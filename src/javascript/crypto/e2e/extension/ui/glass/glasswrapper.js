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
 * @fileoverview Wrapper for the looking glass. Adds install and remove methods.
 */

goog.provide('e2e.ext.ui.BaseGlassWrapper');
goog.provide('e2e.ext.ui.ComposeGlassWrapper');
goog.provide('e2e.ext.ui.GlassWrapper');

goog.require('e2e.ext.MessageApi');
goog.require('e2e.openpgp.ArmoredMessage');
goog.require('goog.Disposable');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.events.EventType'); //@yahoo
goog.require('goog.events.KeyEvent'); //@yahoo
goog.require('goog.style');

goog.scope(function() {
var ui = e2e.ext.ui;
var messages = e2e.ext.messages;


/**
 * Constructor for the glass wrapper.
 * @param {Element} targetElem The element that will host the looking glass.
 * @param {string=} opt_type The type could either be compose or read
 * @constructor
 * @extends {goog.Disposable}
 */
ui.BaseGlassWrapper = function(targetElem, opt_type) {
  goog.base(this);

  /**
   * The element that will host the glass.
   * @type {Element}
   * @protected
   */
  this.targetElem = targetElem;

  /**
   * The type of the glass, either compose or read
   * @type {string}
   * @private
   */
  this.glassType_ = opt_type === 'compose' ? 'composeglass' : 'glass';

  /**
   * The Message API
   * @type {e2e.ext.MessageApi}
   */
  this.api_ = new e2e.ext.MessageApi('ymail-' + this.glassType_);

  /**
   * The CSS class name for the elements we created
   * @type {string}
   * @private
   */
  this.cssClass_ = goog.string.getRandomString();
};
goog.inherits(ui.BaseGlassWrapper, goog.Disposable);


/**
 * Add a request handler.
 * @param {string} reqCall The request call
 * @param {function(*):*} callback The callback function that takes reqArgs and
 *     returns something that will be passed to reqSendResponse.
 * @return {ui.BaseGlassWrapper} this
 */
ui.BaseGlassWrapper.prototype.onApiRequest = function(reqCall, callback) {
  this.api_.getRequestHandler().set(reqCall, goog.bind(callback, this));
  return this;
};


/**
 * Prepare the glass frame
 * @return {!Element} The glass frame
 */
ui.BaseGlassWrapper.prototype.getGlassFrame = function() {
  // create the iframe
  var glassFrame = goog.dom.createElement(goog.dom.TagName.IFRAME);

  // set up the message api with the frame when it's loaded
  glassFrame.addEventListener('load', goog.bind(function() {
    this.api_.bootstrapServer(glassFrame.contentWindow,
        chrome.runtime.getURL(''),
        goog.bind(this.displayFailure, this));
  }, this), false);

  // configure CssClass
  glassFrame.classList.add('e2e' + this.glassType_);
  glassFrame.classList.add(this.cssClass_);

  // configure default style
  goog.style.setSize(glassFrame, '100%', '200px');
  glassFrame.style.border = 0;

  // configure src
  glassFrame.src = chrome.runtime.getURL(this.glassType_ + '.html');

  // configure the default request handler
  this.
      onApiRequest('setSize', goog.bind(function(args) {
        this.setHeight_(glassFrame, args.height);
        return this.getScrollOffset_(glassFrame);
      }, this)).
      onApiRequest('shortcut', goog.bind(function(args) {
        glassFrame.focus();
        // possibly have encryptr natively support these ymail specific actions
        this.handleShortcut_(args.keyId);
        return true;
      }, this));

  return glassFrame;
};


/**
 * Set the height of the glassFrame
 * @param {!Element} glassFrame
 * @param {!string} height
 * @protected
 */
ui.BaseGlassWrapper.prototype.setHeight_ = function(
    glassFrame, height) {
  glassFrame.style.height = height;
};


/**
 * Calculate the scrolling offset of glassFrame relative to the thread list.
 * @param {Element} glassFrame The glassFrame
 * @return {{y: ?number}} The offset
 */
ui.BaseGlassWrapper.prototype.getScrollOffset_ = function(glassFrame) {
  var threadList = goog.dom.getAncestorByTagNameAndClass(
      glassFrame, 'div', 'thread-item-list');
  return {y: threadList ?
      threadList.clientHeight - 
          goog.style.getRelativePosition(glassFrame, threadList).y :
      null};
};


/**
 * Suppress checkVars to create a FocusEvent
 * @param {string} type The event type
 * @suppress {checkVars}
 */
ui.BaseGlassWrapper.prototype.getFocusEvent_ = function(type) {
  return new FocusEvent(type);
};


/**
 * Handle the shortcut action that is specific to the website being interacted.
 * This assumes the thread triggering the shortcut key is already in focus
 * @param {string} shortcutId The shortcut identifier
 * @private
 */
ui.BaseGlassWrapper.prototype.handleShortcut_ = function(shortcutId) {
  var disabled = undefined,
      elem, focusedElem = document.querySelector(
          '.tab-content:not(.offscreen) .thread-focus');

  if (!focusedElem) { // NOT in conversation mode
    shortcutId = ({
      reply: '#btn-reply-sender',
      replyall: '#btn-reply-all',
      forward: '#btn-forward',
      unread: '[data-action=unread]',
      flag: '[data-action=msg-flag]',

      // disable the following shortcuts
      replyCov: disabled,
      replyallCov: disabled,
      forwardCov: disabled,
      unreadCov: disabled,
      flagCov: disabled,

      prev: disabled,
      next: disabled,
      display: disabled
    })[shortcutId] || shortcutId;
  }

  // map the keyId to a ymail selector string
  shortcutId = ({
    compose: '.btn-compose',
    inbox: '.btn-inbox',
    settings: '[data-mad=options]',
    newfolder: '#btn-newfolder',

    // printCov: '', TODO: support print
    prevCov: '#btn-prev-msg',
    nextCov: '#btn-next-msg',
    moveCov: '#btn-move',
    archiveCov: '#btn-archive',
    deleteCov: '#btn-delete',

    replyCov: '#btn-reply-sender',
    replyallCov: '#btn-reply-all',
    forwardCov: '#btn-forward',
    unreadCov: '[data-action=thread-unread]',
    flagCov: '[data-action=thread-flag]',

    reply: '[data-action=reply_sender]',
    replyall: '[data-action=reply_all]',
    forward: '[data-action=forward]',
    unread: '[data-action=thread-item-unread]',
    flag: '[data-action=thread-item-flag]',
    display: '.thread-item-header'

  })[shortcutId] || shortcutId;
  
  switch (shortcutId) {
    case '.btn-inbox':
    case '.btn-compose':
    case '[data-mad=options]':
    case '#btn-newfolder':
    case '#btn-prev-msg':
    case '#btn-next-msg':
    case '#btn-move':
    case '#btn-archive':
    case '#btn-delete':
    case '#btn-reply-sender':
    case '#btn-reply-all':
    case '#btn-forward':
    case '[data-action=unread]':
    case '[data-action=msg-flag]':
      elem = document.querySelector(shortcutId);
      if (elem) {
        elem.dispatchEvent(new MouseEvent('mousedown'));
        elem.click();
      }
      break;
    case 'moveToCov':
      elem = document.querySelector('#btn-move');
      if (elem) {
        elem.dispatchEvent(new MouseEvent('mousedown'));
        elem.click();
      }
      elem = document.querySelector('#menu-move input'); //first input
      elem && elem.focus();
      break;
    case 'closeCov':
      elem = document.querySelector([
          '.nav-tab-li.removable.active [data-action=close-tab]',
          '#btn-closemsg',
          '[data-action=qr-cancel]'].join(','));
      elem && elem.click();
      break;
    case 'prevTab':
    case 'nextTab':
      elem = document.querySelector('.nav-tab-li.removable.active');
      elem = elem && (shortcutId == 'prevTab' ?
          elem.previousElementSibling : elem.nextElementSibling);
      elem &&
          elem.classList.contains('removable') &&
          elem.classList.contains('nav-tab-li') &&
          elem.click();
      break;
    case '[data-action=thread-unread]':
    case '[data-action=thread-flag]':
      elem = document.querySelector(
          '.tab-content:not(.offscreen) ' + shortcutId);
      elem && elem.click();
      break;
    case '[data-action=reply_sender]':
    case '[data-action=reply_all]':
    case '[data-action=forward]':
    case '[data-action=thread-item-unread]':
    case '[data-action=thread-item-flag]':
    case '.thread-item-header':
      elem = focusedElem.querySelector(shortcutId);
      elem && elem.click();
      break;
    case 'prev':
    case 'next':
      elem = focusedElem && (shortcutId == 'prev' ?
          focusedElem.previousElementSibling :
          focusedElem.nextElementSibling);
      if (elem && !elem.hasAttribute('hidden')) {
        focusedElem.dispatchEvent(this.getFocusEvent_('blur'));
        elem.focus();
        elem.dispatchEvent(this.getFocusEvent_('focus'));
        elem = elem.querySelector('iframe');
        elem && elem.focus();
      }
      break;
  }
};


/**
 * Install the glass
 */
ui.BaseGlassWrapper.prototype.installGlass = function() {
  goog.style.setElementShown(this.targetElem, false);
};


/**
 * Remove the glass and restore the original view
 * @override
 */
ui.BaseGlassWrapper.prototype.disposeInternal = function() {
  this.targetElem.glassDisposed = true;
  
  this.api_ = null;

  goog.style.setElementShown(this.targetElem, true);

  goog.base(this, 'disposeInternal');
};


/**
 * Prepend an error message before the targetElem
 * @param {Error=} opt_error The error object
 */
ui.BaseGlassWrapper.prototype.displayFailure = function(opt_error) {
  if (opt_error) {
    var div = document.createElement('div');
    div.style.margin = '6px';
    div.style.color = '#F00';
    div.style.textAlign = 'center';
    div.textContent = opt_error.message;
    goog.dom.insertSiblingBefore(div, this.targetElem);

    div.focus();
    div.scrollIntoView();
  }
};



/**
 * Constructor for the looking glass wrapper. //@yahoo adds opt_text
 * @param {Element} targetElem The element that will host the looking glass.
 * @param {!e2e.openpgp.ArmoredMessage} armor The armored message to decrypt.
 * @constructor
 * @extends {ui.BaseGlassWrapper}
 */
ui.GlassWrapper = function(targetElem, armor) {
  goog.base(this, targetElem);

  this.originalContent_ = this.targetElem.innerText;

  this.onApiRequest('getPgpContent', function() {
    return armor;
  });
};
goog.inherits(ui.GlassWrapper, ui.BaseGlassWrapper);


/** @override */
ui.GlassWrapper.prototype.installGlass = function() {
  goog.base(this, 'installGlass');
  goog.dom.insertSiblingBefore(this.getGlassFrame(), this.targetElem);
};


/**
 * Returns the original content of the target element where the looking glass is
 * installed.
 * @return {string} The original content.
 */
ui.GlassWrapper.prototype.getOriginalContent = function() {
  return this.originalContent_;
};



/**
 * Constructor for the compose glass wrapper.
 * @param {Element} targetElem Element that hosts the looking glass.
 * @param {!messages.e2ebindDraft} draft Draft data
 * @constructor
 * @extends {ui.BaseGlassWrapper}
 */
ui.ComposeGlassWrapper = function(targetElem, draft) {
  goog.base(this, targetElem, 'compose');

  this.draft_ = draft;
};
goog.inherits(ui.ComposeGlassWrapper, ui.BaseGlassWrapper);


/**
 * @override
 */
ui.ComposeGlassWrapper.prototype.installGlass = function() {
  this.styleTop = goog.style.getClientPosition(this.targetElem).y;

  goog.base(this, 'installGlass');

  var glassFrame = this.getGlassFrame();
  glassFrame.style.minHeight = '330px';
  this.setHeight_(glassFrame, '330px');
  
  goog.dom.insertSiblingBefore(glassFrame, this.targetElem);

  var threadList = goog.dom.getAncestorByTagNameAndClass(
      glassFrame, 'div', 'thread-item-list');

  this.onApiRequest('getDraft', function() {
    this.draft_.insideConv = Boolean(threadList);
    return this.draft_;
  });

  this.onApiRequest('exit', function(args) {
    glassFrame.focus();
    if (this.targetElem) {
      var elem;

      // discard the draft if so requested
      if (args && args['discardDraft']) {
        elem = this.targetElem.querySelector('.draft-delete-btn');
        elem && elem.click();
      }

      // trigger YMail's compose to resize, i.e., blur event for To recipients
      elem = this.targetElem.querySelector('input.cm-to-field');
      elem && elem.dispatchEvent(this.getFocusEvent_('blur'));

      goog.dom.removeNode(glassFrame);

      this.dispose();
      return true;
    }
    return new Error('the original message view is missing');
  });

  // Send scroll offset to compose glass for positioning action buttons
  if (threadList) {
    this.boundSendScrollOffset_ = goog.bind(
        this.sendScrollOffset_, this, this.api_, threadList, glassFrame);
    goog.events.listen(threadList, goog.events.EventType.SCROLL,
        this.boundSendScrollOffset_);
  }

  glassFrame.focus();
  glassFrame.scrollIntoView();
};


/**
 * Set the height of the glassFrame
 * @param {!Element} glassFrame
 * @param {!string} height
 * @protected
 */
ui.ComposeGlassWrapper.prototype.setHeight_ = function(
    glassFrame, height) {
  goog.base(this, 'setHeight_', glassFrame, height)

  if (this.styleTop < 150) { // a separate compose window
    var max = window.innerHeight - this.styleTop;
    glassFrame.style.maxHeight = max + 'px';
    glassFrame.style.minHeight = 662 < max ? '662px' : max + 'px';
  }
};


/**
 * Send scroll offset to compose glass
 * @param {e2e.ext.MessageApi} api
 * @param {Element} threadList
 * @param {Element} glassFrame
 * @private
 */
ui.ComposeGlassWrapper.prototype.sendScrollOffset_ = function(
    api, threadList, glassFrame) {
  if (!api) {
    goog.events.unlisten(threadList, goog.events.EventType.SCROLL,
        this.boundSendScrollOffset_);
    return;
  }
  api.sendRequest('setScrollOffset',
      goog.nullFunction, goog.nullFunction, // best effort
      this.getScrollOffset_(glassFrame));
};

});  // goog.scope
