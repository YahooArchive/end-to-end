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
goog.require('goog.style');

goog.scope(function() {
var ui = e2e.ext.ui;
var messages = e2e.ext.messages;



/**
 * Constructor for the glass wrapper.
 * @param {Element} targetElem The element that will host the glass.
 * @param {!e2e.ext.MessageApi} stubApi The API that the stub can provide to
 *     the glass.
 * @param {string=} opt_type The type could either be compose or read.
 * @constructor
 * @extends {goog.Disposable}
 */
ui.BaseGlassWrapper = function(targetElem, stubApi, opt_type) {
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
   * The Message API to communicate with the glass
   * @type {e2e.ext.MessageApi}
   * @protected
   */
  this.api = new e2e.ext.MessageApi('ymail-' + this.glassType_);
  this.registerDisposable(this.api);

  /**
   * The Message API to communicate with the website
   * @type {!e2e.ext.MessageApi}
   * @protected
   */
  this.stubApi = stubApi;
  // don't dispose stubApi for compose glass, as user might switch it back on
  this.glassType_ === 'glass' && this.registerDisposable(stubApi);
};
goog.inherits(ui.BaseGlassWrapper, goog.Disposable);


/**
 * Prepare the glass frame
 * @param {function()=} opt_onBootstrapReady
 * @return {!Element} The glass frame
 */
ui.BaseGlassWrapper.prototype.getGlassFrame = function(opt_onBootstrapReady) {
  // create the iframe
  var glassFrame = goog.dom.createElement(goog.dom.TagName.IFRAME);
  this.glassFrame = glassFrame;

  // set up the message api with the frame when it's loaded
  glassFrame.addEventListener('load', goog.bind(function() {
    this.api.bootstrapServer(glassFrame.contentWindow,
        chrome.runtime.getURL(''),
        goog.bind(function(err) {
          if (err instanceof Error) {
            this.displayFailure(err);
          } else if (opt_onBootstrapReady) {
            opt_onBootstrapReady();
          }
        }, this));
  }, this), false);

  // configure CssClass
  glassFrame.classList.add('e2e' + this.glassType_);

  // configure default style
  goog.style.setSize(glassFrame, '100%', '200px');
  glassFrame.style.border = 0;

  // configure src
  glassFrame.src = chrome.runtime.getURL(this.glassType_ + '.html');

  this.addAPIHandlers();

  return glassFrame;
};


/**
 * Register APIs to serve the glass
 * @return {e2e.ext.MessageApi}
 * @protected
 */
ui.BaseGlassWrapper.prototype.addAPIHandlers = function() {
  // configure the default request handler
  return this.api.
      setRequestHandler('evt.trigger', goog.bind(function(args) {
        // must explicit focus on glassFrame once, so it knows to fire blur
        this.glassFrame.focus();
        return this.stubApi.req('evt.trigger', args);
      }, this));
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
 * @param {!e2e.ext.MessageApi} stubApi The API that the stub can provide to
 *     the glass.
 * @param {!e2e.openpgp.ArmoredMessage} armor The armored message to decrypt.
 * @param {boolean=} opt_isRichText Whether the armor text is HTML
 * @constructor
 * @extends {ui.BaseGlassWrapper}
 */
ui.GlassWrapper = function(targetElem, stubApi, armor, opt_isRichText) {
  goog.base(this, targetElem, stubApi);
  this.armor_ = armor;
  this.isRichText_ = !!opt_isRichText;
};
goog.inherits(ui.GlassWrapper, ui.BaseGlassWrapper);


/** @override */
ui.GlassWrapper.prototype.installGlass = function() {
  goog.base(this, 'installGlass');
  goog.dom.insertSiblingBefore(this.getGlassFrame(), this.targetElem);
  this.targetElem.focus();
};


/**
 * Register APIs to serve the glass
 * @override
 */
ui.GlassWrapper.prototype.addAPIHandlers = function() {
  // proxy the stub-provided handlers to the glass
  return goog.base(this, 'addAPIHandlers').
      setRequestHandler('read.get', goog.bind(function() {
        return {armor: this.armor_, isRichText: this.isRichText_};
      }, this)).
      setRequestHandler('ctrl.resizeGlass', goog.bind(function(args) {
        this.setHeight(args.height);
        return true;
      }, this));
};



/**
 * Constructor for the compose glass wrapper.
 * @param {!Element} targetElem Element that hosts the compose glass.
 * @param {!e2e.ext.MessageApi} stubApi The API that the stub can provide to
 *     the glass.
 * @constructor
 * @extends {ui.BaseGlassWrapper}
 */
ui.ComposeGlassWrapper = function(targetElem, stubApi) {
  goog.base(this, targetElem, stubApi, 'compose');

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
  // must be after setResizeAndScrollEventHandlers_().
  // 292 assumes that the editor is sized with its min-height (i.e., 100)
  this.setHeight(292);
  // insert the glass into dom, and focus it
  goog.dom.insertSiblingBefore(glassFrame, this.targetElem);
  glassFrame.focus();

  goog.events.listen(glassFrame.parentElement, goog.events.EventType.FOCUS,
      this.focusHandler_, false, this);
};


/**
 * shift the focus from glassFrame's parent to glassFrame
 * @private
 */
ui.ComposeGlassWrapper.prototype.focusHandler_ = function() {
  this.glassFrame && this.glassFrame.focus();
};


/**
 * Add handlers to serve API calls from the stub
 * @protected
 */
ui.ComposeGlassWrapper.prototype.addStubAPIHandlers = function() {
  var stubApi = this.stubApi;
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
 * Register APIs to serve the glass
 * @override
 */
ui.ComposeGlassWrapper.prototype.addAPIHandlers = function() {
  var stub = this.stubApi;
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
        // do not dispose this.stubApi here, as it might be switched back on
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
    this.registerDisposable(
        e2e.ext.utils.addAnimationDelayedListener(this.threadList_,
            goog.events.EventType.SCROLL, this.boundSendScrollOffset_));

    this.boundResizeHandler_ = this.boundSendScrollOffset_;
  } else {
    this.boundResizeHandler_ = goog.bind(this.setMinMaxHeight_, this);
  }
  // resize the glassFrame when window is resized
  this.registerDisposable(
      e2e.ext.utils.addAnimationDelayedListener(window,
          goog.events.EventType.RESIZE, this.boundResizeHandler_));
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
        min = Math.max(window.innerHeight - this.styleTop_, 252);

    glassFrameStyle.maxHeight = glassFrameStyle.minHeight = min + 'px';

    this.api && this.api.req('evt.minMaxSize', {
      minHeight: min,
      maxHeight: min
    });
  } else {
    this.dispose();
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
    this.dispose();
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
      this.focusHandler_, false, this);
};

});  // goog.scope
