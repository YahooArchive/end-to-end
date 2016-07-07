// Copyright 2016 Yahoo Inc. All rights reserved.
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
 * @fileoverview The rich text editor
 */

goog.provide('e2e.ext.ui.RichTextEditor');

goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.PGPHtmlMessage');
goog.require('e2e.ext.ui.editor.Purifier');
goog.require('e2e.ext.ui.editor.LinkDialogPlugin');
goog.require('e2e.ext.ui.editor.LinkEditPlugin');
goog.require('e2e.ext.ui.editor.SpacesTabHandler');
goog.require('e2e.ext.ui.editor.Toolbars');
goog.require('e2e.ext.utils');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.array');
goog.require('goog.async.Deferred');
goog.require('goog.async.DeferredList');
goog.require('goog.async.Throttle');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.editor.Field');
goog.require('goog.editor.SeamlessField');
goog.require('goog.editor.plugins.BasicTextFormatter');
goog.require('goog.editor.plugins.EnterHandler');
goog.require('goog.editor.plugins.ListTabHandler');
goog.require('goog.editor.plugins.UndoRedo');
goog.require('goog.editor.range');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.style');


goog.scope(function() {
var constants = e2e.ext.constants;
var ui = e2e.ext.ui;
var utils = e2e.ext.utils;



/**
 * Constructor for the seamless rich text editor.
 * @param {ui.ComposeGlass} composeGlass The composeGlass instance
 * @param {string} id An identifer for the field. This is used to find the
 *     field and the element associated with this field.
 * @param {!string} toolbarId An identifer for the toolbar.
 * @param {Document=} opt_doc The document that the element with the given
 *     id can be found it.
 * @constructor
 * @extends {goog.editor.SeamlessField}
 */
ui.RichTextEditor = function(composeGlass, id, toolbarId, opt_doc) {
  goog.base(this, id, opt_doc);

  this.composeGlass_ = composeGlass;
  this.toolbarId_ = toolbarId;

  // Create and register all of the editing plugins you want to use.
  this.registerPlugin(new goog.editor.plugins.BasicTextFormatter());
  this.registerPlugin(new goog.editor.plugins.EnterHandler());
  this.registerPlugin(new goog.editor.plugins.ListTabHandler());
  this.registerPlugin(new goog.editor.plugins.UndoRedo());
  this.registerPlugin(new ui.editor.SpacesTabHandler());
  this.registerPlugin(new ui.editor.Purifier());

  this.registerPlugin(new ui.editor.LinkDialogPlugin());
  this.registerPlugin(new ui.editor.LinkEditPlugin());


  // force editor to scroll when maxheight is reached
  this.composeGlass_.setApiRequestHandler('evt.minMaxSize', goog.bind(
      function(args) {
        var elem = this.getOriginalElement(),
            editorStyle = elem.style,
            offset = 101 + 18 + goog.style.getPosition(elem).y;
        editorStyle.minHeight = (Math.max(args.minHeight, 80) - offset) + 'px';
        editorStyle.maxHeight = (args.maxHeight - offset) + 'px';
      }, this));

  // resize the editor when window is resized
  this.registerDisposable(
      utils.addAnimationDelayedListener(window,
          goog.events.EventType.RESIZE,
          goog.bind(this.resize_, this, false)));
};
goog.inherits(ui.RichTextEditor, goog.editor.SeamlessField);


/** @override */
ui.RichTextEditor.prototype.makeEditableInternal = function() {
  goog.base(this, 'makeEditableInternal');

  // update extension icon as green when the editor is in focus
  this.listen(goog.editor.Field.EventType.FOCUS, goog.bind(
      utils.sendExtensionRequest, null, {
        action: constants.Actions.CHANGE_PAGEACTION
      }, goog.nullFunction, goog.bind(this.displayFailure_, this)));
  // update extension icon when the editor is in blur
  this.listen(goog.editor.Field.EventType.BLUR, goog.bind(
      utils.sendExtensionRequest, null, {
        action: constants.Actions.RESET_PAGEACTION
      }, goog.nullFunction, goog.bind(this.displayFailure_, this)));

  // resize the glass and scroll up if content needs more space
  goog.events.listen(this.getElement(), goog.events.EventType.INPUT,
      goog.bind(this.resize, this, false));

  // listen to beforepaste events
  goog.events.listen(this.getElement(), goog.events.EventType.PASTE,
      this.cleanPasteContents_, true, this);

  this.toolbar_ = new e2e.ext.ui.editor.Toolbars(this,
      /** @type {!Element} */ (goog.dom.getElement(this.toolbarId_)));
};


/** @override */
ui.RichTextEditor.prototype.setHtml = function(
    addParas, html, opt_dontFireDelayedChange, opt_applyLorem) {
  goog.base(this, 'setHtml',
      addParas, html, opt_dontFireDelayedChange, opt_applyLorem);

  if (this.isLoaded()) {
    this.decryptAsciiArmors_();
  }
};


/**
 * Creates a DIV element with the provided html, and appends it to the editor.
 * @param {string} html
 * @param {string=} opt_className
 */
ui.RichTextEditor.prototype.appendHtml = function(html, opt_className) {
  html = this.getInjectableContents(html, {});
  var elem, dh;
  if (html) {
    this.manipulateDom(function() {
      dh = this.getEditableDomHelper();
      elem = dh.createDom(goog.dom.TagName.DIV, {
        className: opt_className || '',
        innerHTML: html
      });
      dh.appendChild(this.getElement(), elem);
    }, true, this);
    this.decryptAsciiArmors_(elem);
  }
};


/**
 * Parses a DOM element for PGP ASCII armors. Each armor is then sequentially
 * decrypted one after another, amid preserving surronding DOM elements.
 * @param {Node=} opt_root The root node to begin search for ASCII armors.
 *     Defaulted to use the editor element.
 * @private
 */
ui.RichTextEditor.prototype.decryptAsciiArmors_ = function(opt_root) {
  // specify the root element to search for text nodes
  !opt_root && (opt_root = /** @type {Node} */ (this.getElement()));

  if (opt_root) {
    var range,
        nodeFilter = /** @type {NodeFilter} */ ({
          acceptNode: function(node) {
            var i = node.data.indexOf('-----BEGIN PGP MESSAGE-----');
            if (i !== -1) {
              range = document.createRange();
              range.setStart(node, i);
            }
            i = node.data.indexOf('-----END PGP MESSAGE-----');
            if (i !== -1 && range) {
              range.setEnd(node, i + 25);
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        }),
        iterator = document.createNodeIterator(
            opt_root, NodeFilter.SHOW_TEXT, nodeFilter);

    this.iteratePGPBlockRange_({
      nextRange: function() {
        return iterator.nextNode() && range;
      }
    });
  }
};


/**
 * Iterates over PGP blocks and decrypts it one by one. Delayed change events
 * are stopped until all blobs are decrypted.
 * @param {{nextRange: function() : ?Range}} iterator Yields the next range
 *     which contains a PGP blob.
 * @param {Array<goog.async.Deferred>=} opt_deferredResults for recursive use.
 * @private
 */
ui.RichTextEditor.prototype.iteratePGPBlockRange_ = function(
    iterator, opt_deferredResults) {
  if (!opt_deferredResults) {
    // stop change events
    this.stopChangeEvents(true, true);
    // initiate the decrypt results to wait
    opt_deferredResults = [];
  }

  var range = iterator.nextRange(), armor, text;
  if (range) {
    text = range.cloneContents().textContent;
    try {
      armor = e2e.openpgp.asciiArmor.parse(text);
    } catch (err) {
      range.detach();
      this.displayFailure_(err);
      this.iteratePGPBlockRange_(iterator);
    }

    if (armor.type === 'BINARY') {
      range.detach();
      return;
    }

    opt_deferredResults.push(
        this.decrypt_(text).addCallback(function(decryptedContent) {
          var parentElement = range.startContainer.parentElement,
              newNode = goog.dom.createElement(goog.dom.TagName.DIV);
          // TODO: support content sniffing to determine HTML message?
          if (parentElement.title === constants.PGPHtmlMessage.TITLE) {
            newNode.innerHTML = this.getInjectableContents(
                decryptedContent, {});
            goog.dom.removeNode(parentElement);
          } else {
            newNode.style.fontFamily = 'inherit';
            newNode.style.whiteSpace = 'pre';
            newNode.textContent = decryptedContent;
            range.deleteContents();
          }
          range.insertNode(newNode);
        }, this).addBoth(function() {
          range.detach();
          this.iteratePGPBlockRange_(iterator, opt_deferredResults);
        }, this));

  } else {
    // all pgp block ranges are exhausted
    (opt_deferredResults.length ?
        goog.async.DeferredList.gatherResults(opt_deferredResults) :
        goog.async.Deferred.succeed(undefined)).
        addCallback(goog.bind(this.resize_, this, true)).
        addBoth(goog.bind(this.startChangeEvents, this, false, false));
  }

};


/**
 * Decrypt PGP blocks
 * @param {!string} content The PGP content
 * @return {!goog.async.Deferred.<string>} The decrypted content
 * @private
 */
ui.RichTextEditor.prototype.decrypt_ = function(content) {
  var result = new goog.async.Deferred;

  // @yahoo sendExtensionRequest is used instead of actionExecutor
  utils.sendExtensionRequest(/** @type {!e2e.ext.messages.ApiRequest} */ ({
    action: constants.Actions.DECRYPT,
    content: content
    // @yahoo no passphrase dialog can be hooked from content script
    // passphraseCallback: goog.bind(this.renderPassphraseDialog, this)
  }), function(text) {
    if (text && (text = text.decrypt)) {
      result.callback(text.text || '');
    }
  }, goog.bind(this.displayFailure_, this));

  return result;
};


/**
 * Clean up pasted contents
 * @param {goog.events.BrowserEvent} evt
 * @return {boolean}
 * @private
 */
ui.RichTextEditor.prototype.cleanPasteContents_ = function(evt) {
  var browserEvent = /** @type {Event} */ (evt.getBrowserEvent());
  var clipboardData = (/** @type {{clipboardData: {
      *   getData:function(string),
      *   setData:function(string, *)
      * }}} */ (browserEvent)).clipboardData;

  var html = clipboardData.getData('text/html');
  if (html) {
    browserEvent.preventDefault();
    browserEvent.stopPropagation();

    // Stop change events while we make multiple field changes.
    this.manipulateDom(function() {
      var dh = this.getEditableDomHelper();
      var range = this.getRange();
      // Inserting nodes below completely messes up the selection, doing the
      // deletion here before it's messed up. Only delete if text is selected,
      // otherwise we would remove the character to the right of the cursor.
      if (range && !range.isCollapsed()) {
        dh.getDocument().execCommand('delete', false, null);
        // Safari 3 has some DOM exceptions if we don't reget the range here,
        // doing it all the time just to be safe.
        range = this.getRange();
      }

      var elem = dh.createDom(goog.dom.TagName.SPAN, {
        innerHTML: this.getInjectableContents(html, {})
      }), lastElementChild = elem.lastElementChild;
      elem = range.insertNode(elem, false);
      goog.dom.flattenElement(elem);

      goog.editor.range.placeCursorNextTo(lastElementChild, false);

      this.resize_();
    }, false, this);

    return false;
  }

  return true;
};


/**
 * Configure the editor according to the given preferences
 * @param {e2e.ext.YmailType.Preferences} pref
 */
ui.RichTextEditor.prototype.setPreferences = function(pref) {
  var style = this.getElement().style;

  style.fontFamily = pref.fontFamily;
  style.fontSize = pref.fontSize;

  goog.array.some(e2e.ext.ui.editor.Toolbars.FONTS, function(font) {
    if (font.value === pref.fontFamily) {
      this.toolbar_.fontFaceButton.setDefaultCaption(font.caption);
      return true;
    }
    return false;
  }, this);

  var fontSizeConverted = ({
    '10px': 1, '13px': 2, '16px': 3, '24px': 5, '32px': 6, '48px': 7
  })[pref.fontSize];

  goog.array.some(e2e.ext.ui.editor.Toolbars.FONT_SIZES, function(font) {
    if (font.value === fontSizeConverted) {
      this.toolbar_.fontSizeButton.setDefaultCaption(font.caption);
      return true;
    }
    return false;
  }, this);
};


/**
 * Retrieve the HTML contents and encloses them with the default font family
 * and size.
 * @return {!string} The wrapped HTML contents
 */
ui.RichTextEditor.prototype.getWrappedCleanContents = function() {
  var style = this.getElement().style;
  var div = this.getEditableDomHelper().createDom('div', {
    innerHTML: this.getCleanContents()
  });
  div.style.fontFamily = style.fontFamily;
  div.style.fontSize = style.fontSize;
  return div.outerHTML;
};


/**
 * Scroll up the editor, and trigger the iframe to resize. Throttled to happen
 * no more than 4 times per second.
 * @param {boolean=} opt_skipForcedScroll Whether to skip scrolling by delta
 *     height
 */
ui.RichTextEditor.prototype.resize = function(opt_skipForcedScroll) {
  !this.throttledResize_ &&
      (this.throttledResize_ = new goog.async.Throttle(
          goog.bind(this.resize_, this), 250));

  this.throttledResize_.fire(opt_skipForcedScroll);
};


/**
 * Scroll up the editor, and trigger the iframe to resize
 * @param {boolean=} opt_skipForcedScroll Whether to skip scrolling by delta
 *     height
 * @private
 */
ui.RichTextEditor.prototype.resize_ = function(opt_skipForcedScroll) {
  var elem = this.getElement() || this.getOriginalElement();
  var newHeight = elem.clientHeight;
  var maxHeight = parseInt(elem.style.maxHeight, 10);
  var minHeight = parseInt(elem.style.minHeight, 10);

  newHeight > maxHeight && (newHeight = maxHeight);
  if (newHeight === this.lastHeight_ ||
      newHeight < minHeight) {
    return;
  }

  // apply scroll by delta height also in compose that spans the whole tab
  var deltaHeight = maxHeight && (newHeight - this.lastHeight_);
  if (deltaHeight) {
    !opt_skipForcedScroll && (elem.style.scrollTop += deltaHeight);
  }

  this.composeGlass_.resize(opt_skipForcedScroll);
  this.focus();

  this.lastHeight_ = newHeight;
};


/**
 * Reuse the displayFailure_ of composeGlass
 * @param {Error} error The error to display.
 * @private
 */
ui.RichTextEditor.prototype.displayFailure_ = function(error) {
  this.composeGlass_.displayFailure(error);
};

});  // goog.scope
