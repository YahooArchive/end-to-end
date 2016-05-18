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
 * @fileoverview Wrapper for the glasses.
 */

goog.provide('e2e.ext.ui.BaseGlassWrapper');
goog.provide('e2e.ext.ui.ComposeGlassWrapper');
goog.provide('e2e.ext.ui.GlassWrapper');

goog.require('e2e.ext.MessageApi');
goog.require('e2e.ext.utils');
goog.require('goog.Disposable');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.events');
goog.require('goog.events.EventType'); //@yahoo
goog.require('goog.string');
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
   * @protected
   */
  this.api = new e2e.ext.MessageApi('ymail-' + this.glassType_);
  this.registerDisposable(this.api);

  /**
   * The CSS class name for the elements we created
   * @type {string}
   * @private
   */
  this.cssClass_ = goog.string.getRandomString();
};
goog.inherits(ui.BaseGlassWrapper, goog.Disposable);


/**
 * Prepare the glass frame
 * @return {!Element} The glass frame
 */
ui.BaseGlassWrapper.prototype.getGlassFrame = function() {
  // create the iframe
  var glassFrame = goog.dom.createElement(goog.dom.TagName.IFRAME);
  this.glassFrame = glassFrame;

  // set up the message api with the frame when it's loaded
  glassFrame.addEventListener('load', goog.bind(function() {
    this.api.bootstrapServer(glassFrame.contentWindow,
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

  this.addAPIHandlers();

  return glassFrame;
};


/**
 * Add handlers to serve API calls from the glass
 * @return {e2e.ext.MessageApi}
 * @protected
 */
ui.BaseGlassWrapper.prototype.addAPIHandlers = function() {
  // configure the default request handler
  this.api.setRequestHandler('ctrl.shortcut', goog.bind(function(args) {
    this.glassFrame.focus();
    // possibly have encryptr natively support these ymail specific actions
    this.handleShortcut_(args.keyId);
    return true;
  }, this));
  return this.api;
};


/**
 * Set the height of the glassFrame
 * @param {!number} height
 * @protected
 */
ui.BaseGlassWrapper.prototype.setHeight = function(height) {
  this.glassFrame.style.height = height + 'px';
};


/**
 * Suppress checkVars to create a FocusEvent
 * @param {string} type The event type
 * @return {!Event}
 * @suppress {checkVars}
 * @protected
 */
ui.BaseGlassWrapper.prototype.getFocusEvent = function(type) {
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
        focusedElem.dispatchEvent(this.getFocusEvent('blur'));
        elem.focus();
        elem.dispatchEvent(this.getFocusEvent('focus'));
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
  goog.dom.removeNode(this.glassFrame);
  this.glassFrame = null;

  this.targetElem.glassDisposed = true;
  goog.style.setElementShown(this.targetElem, true);

  this.api = null;

  goog.base(this, 'disposeInternal');
};


/**
 * Prepend an error message before the targetElem
 * @param {Error=} opt_error The error object
 */
ui.BaseGlassWrapper.prototype.displayFailure = function(opt_error) {
  e2e.ext.utils.displayFailure(opt_error);
  // if (opt_error) {
  //   var div = document.createElement('div');
  //   div.style.margin = '6px';
  //   div.style.color = '#F00';
  //   div.style.textAlign = 'center';
  //   div.textContent = opt_error.message;
  //   goog.dom.insertSiblingBefore(div, this.glassFrame || this.targetElem);

  //   div.focus();
  //   div.scrollIntoView();
  // }
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

  this.api.setRequestHandler('getPgpContent', function() {
    return armor;
  });
};
goog.inherits(ui.GlassWrapper, ui.BaseGlassWrapper);


/** @override */
ui.GlassWrapper.prototype.installGlass = function() {
  goog.base(this, 'installGlass');
  goog.dom.insertSiblingBefore(this.getGlassFrame(), this.targetElem);
  this.targetElem.focus();
};


/**
 * Add handlers to serve API calls from/to the glass
 * @override
 */
ui.GlassWrapper.prototype.addAPIHandlers = function() {
  // proxy the stub-provided handlers to the glass
  return goog.base(this, 'addAPIHandlers').
      setRequestHandler('ctrl.resizeGlass', goog.bind(function(args) {
        this.setHeight(args.height);
        return true;
      }, this));
};



/**
 * Constructor for the compose glass wrapper.
 * @param {!Element} targetElem Element that hosts the compose glass.
 * @param {!e2e.ext.MessageApi} stubApi API that can serve the compose glass.
 * @constructor
 * @extends {ui.BaseGlassWrapper}
 */
ui.ComposeGlassWrapper = function(targetElem, stubApi) {
  goog.base(this, targetElem, 'compose');

  /**
   * The Message API to communicate with the website
   * @type {!e2e.ext.MessageApi}
   * @private
   */
  this.stubApi_ = stubApi;
  this.addStubAPIHandlers();
};
goog.inherits(ui.ComposeGlassWrapper, ui.BaseGlassWrapper);


/** @override */
ui.ComposeGlassWrapper.prototype.installGlass = function() {
  this.styleTop_ = goog.style.getClientPosition(this.targetElem).y;
  this.threadList_ = goog.dom.getAncestorByTagNameAndClass(
      this.targetElem, 'div', 'thread-item-list');

  goog.base(this, 'installGlass');

  this.setResizeAndScrollEventHandlers_();

  var glassFrame = this.getGlassFrame();
  this.setHeight(330); // must do it after setResizeAndScrollEventHandlers_()
  // insert the glass into dom, and focus it
  goog.dom.insertSiblingBefore(glassFrame, this.targetElem);
  glassFrame.focus();

  // capture the focus from glassFrame's parent to glassFrame
  this.focusHandler_ = function() {
    glassFrame && glassFrame.focus();
  };
  goog.events.listen(glassFrame.parentElement,
      goog.events.EventType.FOCUS,
      this.focusHandler_);
};


/**
 * Add handlers to serve API calls from the stub
 * @protected
 */
ui.ComposeGlassWrapper.prototype.addStubAPIHandlers = function() {
  var stubApi = this.stubApi_;
  // override evt.close
  stubApi.setRequestHandler('evt.close', goog.bind(function() {
    this.dispose();
    stubApi.dispose();
    // TODO: support save before close?
    // return (this.api ?
    //     this.api.req('evt.close') :
    //     goog.async.Deferred.succeed(undefined)).addCallback(function() {
    //       this.dispose();
    //       stubApi.dispose();
    //       return true;
    //     }, this);
  }, this));
};


/**
 * Add handlers to serve API calls from the glass
 * @override
 */
ui.ComposeGlassWrapper.prototype.addAPIHandlers = function() {
  var stub = this.stubApi_;
  // proxy the stub-provided handlers to the composeglass
  return goog.base(this, 'addAPIHandlers').
      setRequestHandler('draft.get', goog.bind(function(args) {
        return stub.req('draft.get', args).addCallback(function(draft) {
          // append whether compose is rendered inside conversation
          draft.isInConv = Boolean(this.threadList_);
          return draft;
        }, this);
      }, this)).
      setRequestHandler('draft.set', goog.bind(stub.req, stub, 'draft.set')).
      setRequestHandler('draft.save', goog.bind(stub.req, stub, 'draft.save')).
      setRequestHandler('draft.send', goog.bind(stub.req, stub, 'draft.send')).
      setRequestHandler('draft.discard', goog.bind(function() {
        return stub.req('draft.discard').addCallback(this.dispose, this);
      }, this)).
      setRequestHandler('draft.getQuoted',
          goog.bind(stub.req, stub, 'draft.getQuoted')).
      setRequestHandler('draft.triggerEvent', goog.bind(function(args) {
        // must explicit focus on glassFrame once, so it knows to fire blur
        this.glassFrame.focus();
        return stub.req('draft.triggerEvent', args)
      }, this)).
      setRequestHandler('autosuggest.search',
          goog.bind(stub.req, stub, 'autosuggest.search')).
      setRequestHandler('ctrl.resizeGlass', goog.bind(function(args) {
        var threadList = this.threadList_,
            diff = this.glassFrame.clientHeight - args.height;
        if (diff !== 0) {
          this.setHeight(args.height);
          if (threadList) {
            // in order not to hide caret, scroll up by delta height
            // when action bar is pushed to bottom and get affixed
            if (args.scrollByDeltaHeight) {
              threadList.scrollTop -= diff;
            }
            this.sendScrollOffset_();
          }
        }
        return true;
      }, this)).
      setRequestHandler('ctrl.closeGlass', goog.bind(function() {
        this.dispose();
        stub.req('draft.set', {glassClosing: true});
        // do not dispose this.stubApi_ here, as it might be switched back on
        return true;
      }, this));
};


/**
 * Set resize and scroll related event handlers
 * @private
 */
ui.ComposeGlassWrapper.prototype.setResizeAndScrollEventHandlers_ = function() {
  if (this.threadList_) {
    // Send scroll offset to compose glass for positioning action bar
    this.boundSendScrollOffset_ = goog.bind(this.sendScrollOffset_, this);
    goog.events.listen(this.threadList_,
        goog.events.EventType.SCROLL,
        this.boundSendScrollOffset_);

    this.boundResizeHandler_ = this.boundSendScrollOffset_;
  } else {
    this.boundResizeHandler_ = goog.bind(this.setMinMaxHeight_, this);
  }
  // resize the glassFrame when window is resized
  e2e.ext.utils.listenThrottledEvent(window, goog.events.EventType.RESIZE,
      this.boundResizeHandler_);
};


/** @override */
ui.ComposeGlassWrapper.prototype.setHeight = function(height) {
  goog.base(this, 'setHeight', height);
  !this.threadList_ && this.setMinMaxHeight_();
};


/**
 * Set the min and max height of the glassFrame, if it exists in a separate tab
 * @private
 */
ui.ComposeGlassWrapper.prototype.setMinMaxHeight_ = function() {
  if (this.glassFrame) {
    var glassFrameStyle = this.glassFrame.style,
        max = Math.max(window.innerHeight - this.styleTop_, 252),
        min = max > 662 ? 662 : max;

    glassFrameStyle.minHeight = min + 'px';
    glassFrameStyle.maxHeight = max + 'px';

    this.api && this.api.req('evt.minMaxSize', {
      minHeight: min,
      maxHeight: max
    });
  } else {
    goog.events.unlisten(window, 'throttled-resize', this.boundResizeHandler_);
  }
};


/**
 * Send scroll offset to compose glass
 * @private
 */
ui.ComposeGlassWrapper.prototype.sendScrollOffset_ = function() {
  if (this.api) {
    this.api.req('evt.scroll', this.computeScrollOffset_());
  } else {
    this.threadList_ && goog.events.unlisten(
        this.threadList_,
        goog.events.EventType.SCROLL,
        this.boundSendScrollOffset_);
    goog.events.unlisten(window, 'throttled-resize', this.boundResizeHandler_);
  }
};


/**
 * Calculate the scrolling offset of glassFrame relative to the thread list.
 * @return {{y: ?number}} The offset
 * @private
 */
ui.ComposeGlassWrapper.prototype.computeScrollOffset_ = function() {
  var threadList = this.threadList_;
  return {
    y: threadList ?
        threadList.clientHeight - goog.style.getRelativePosition(
            this.glassFrame, threadList).y :
        null
  };
};


/**
 * Remove the glass and restore the original view
 * @override
 */
ui.ComposeGlassWrapper.prototype.disposeInternal = function() {
  goog.base(this, 'disposeInternal');

  this.glassFrame && this.glassFrame.parentElement && goog.events.unlisten(
      this.glassFrame.parentElement,
      goog.events.EventType.FOCUS,
      this.focusHandler_);

  this.threadList_ && goog.events.unlisten(
      this.threadList_,
      goog.events.EventType.SCROLL,
      this.boundSendScrollOffset_);

  goog.events.unlisten(window, 'throttled-resize', this.boundResizeHandler_);
};

});  // goog.scope
