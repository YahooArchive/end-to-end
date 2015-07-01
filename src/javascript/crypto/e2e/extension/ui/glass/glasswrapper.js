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

goog.provide('e2e.ext.ui.ComposeGlassWrapper');
goog.provide('e2e.ext.ui.GlassWrapper');

goog.require('e2e.ext.messages.e2ebindDraft');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Disposable');
goog.require('goog.array');
goog.require('goog.crypt.base64');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.style');

// Read glass
goog.scope(function() {
var ui = e2e.ext.ui;



/**
 * Constructor for the looking glass wrapper.
 * @param {Element} targetElem The element that will host the looking glass.
 * @param {string=} opt_text Optional text to be decrypted in the glass.
 * @constructor
 * @extends {goog.Disposable}
 */
ui.GlassWrapper = function(targetElem, opt_text) {
  goog.base(this);

  /**
   * The element that will host the looking glass.
   * @type {Element}
   * @private
   */
  this.targetElem_ = targetElem;
  this.targetElem_.setAttribute('original_content', opt_text ? opt_text :
                                this.targetElem_.innerText);

  /**
   * The original children of the target element.
   * @type {!Array.<Node>}
   * @private
   */
  this.targetElemChildren_ = [];
};
goog.inherits(ui.GlassWrapper, goog.Disposable);


/** @override */
ui.GlassWrapper.prototype.disposeInternal = function() {
  this.removeGlass();

  goog.base(this, 'disposeInternal');
};


/**
 * Installs the looking glass into the hosting page.
 * @param {function()=} opt_callback Callback function to call when the glass
 *     frame was loaded.
 */
ui.GlassWrapper.prototype.installGlass = function(opt_callback) {
  this.targetElem_.lookingGlass = this;
  goog.array.extend(this.targetElemChildren_, this.targetElem_.childNodes);

  var glassFrame = goog.dom.createElement(goog.dom.TagName.IFRAME);
  glassFrame.scrolling = 'no';
  goog.style.setSize(glassFrame, goog.style.getSize(this.targetElem_));
  glassFrame.style.border = 0;

  var pgpMessage =
      e2e.openpgp.asciiArmor.extractPgpBlock(this.targetElem_.innerText);
  var surroundings = this.targetElem_.innerText.split(pgpMessage);

  this.targetElem_.textContent = '';
  var before = surroundings[0] ? surroundings[0].split('\n') : '';
  var after = surroundings[1] ? surroundings[1].split('\n') : '';

  var p1 = this.targetElem_.appendChild(document.createElement('p'));
  goog.array.forEach(before, function(item) {
    p1.appendChild(document.createTextNode(item));
    p1.appendChild(document.createElement('br'));
  });
  this.targetElem_.appendChild(glassFrame);
  var p2 = this.targetElem_.appendChild(document.createElement('p'));
  goog.array.forEach(after, function(item) {
    p2.appendChild(document.createTextNode(item));
    p2.appendChild(document.createElement('br'));
  });

  glassFrame.addEventListener('load', goog.bind(function() {
    glassFrame.contentWindow.postMessage(
        goog.crypt.base64.encodeString(pgpMessage, true),
        chrome.runtime.getURL(''));
    if (opt_callback) {
      opt_callback();
    }
  }, this), false);

  /*
  glassFrame.addEventListener('mousewheel', function(evt) {
    evt.stopPropagation();
    evt.preventDefault();
  });
  */
  // Loading the document after an onload handler has been bound.
  glassFrame.src = chrome.runtime.getURL('glass.html');
};


/**
 * Removes the looking glass from the hosting page.
 */
ui.GlassWrapper.prototype.removeGlass = function() {
  this.targetElem_.lookingGlass = undefined;
  this.targetElem_.textContent = '';
  goog.array.forEach(this.targetElemChildren_, function(child) {
    this.targetElem_.appendChild(child);
  }, this);

  this.targetElemChildren_ = [];
};


/**
 * Returns the original content of the target element where the looking glass is
 * installed.
 * @return {string} The original content.
 */
ui.GlassWrapper.prototype.getOriginalContent = function() {
  return this.targetElem_.getAttribute('original_content');
};

});  // goog.scope


// Compose glass. Unlike read glass, does not preserve children.

goog.scope(function() {
var ui = e2e.ext.ui;
var messages = e2e.ext.messages;

/**
   * Constructor for the compose glass wrapper.
   * @param {Element} targetElem Element that hosts the looking glass.
   * @param {messages.e2ebindDraft} draft Draft data
   * @param {string} hash Hash to uniquely identify this wrapper
   * @constructor
   * @extends {goog.Disposable}
   */
ui.ComposeGlassWrapper = function(targetElem, draft, hash) {
  goog.base(this);

  this.targetElem_ = targetElem;
  this.draft = draft;
  this.targetElem_.setAttribute('original_content', this.draft.body);
  this.mode = 'scroll';
  this.hash = hash;
};
goog.inherits(ui.ComposeGlassWrapper, goog.Disposable);

/** @override */
ui.ComposeGlassWrapper.prototype.disposeInternal = function() {
  this.removeGlass();
  goog.base(this, 'disposeInternal');
};

/**
   * Installs compose glass
   */
ui.ComposeGlassWrapper.prototype.installGlass = function() {
  this.targetElem_.composeGlass = this;

  var glassFrame = goog.dom.createElement(goog.dom.TagName.IFRAME);
  glassFrame.src = chrome.runtime.getURL('composeglass.html');
  var targetSize = goog.style.getSize(this.targetElem_);
  goog.style.setWidth(glassFrame, targetSize.width);
  // Make the frame fit a bit better?
  goog.style.setHeight(glassFrame, targetSize.height);
  glassFrame.style.border = 0;
  glassFrame.classList.add('e2eComposeGlass');

  // Hide the original compose window
  goog.array.forEach(this.targetElem_.children, function(elem) {
    if (elem.style.display != 'none') {
      elem.setAttribute('hidden_by_compose_glass', true);
      goog.style.setElementShown(elem, false);
    }
  });

  this.targetElem_.appendChild(glassFrame);
  this.glassFrame = glassFrame;

  glassFrame.addEventListener('load', goog.bind(function() {
    glassFrame.contentWindow.postMessage({
      draft: this.draft,
      mode: this.mode,
      hash: this.hash,
      height: targetSize.height
    }, chrome.runtime.getURL(''));
  }, this), false);
};

/**
   * Removes compose glass
   */
ui.ComposeGlassWrapper.prototype.removeGlass = function() {
  this.targetElem_.composeGlass = undefined;
  if (this.glassFrame) {
    this.glassFrame.parentNode.removeChild(this.glassFrame);
  }
  goog.array.forEach(this.targetElem_.children, function(elem) {
    if (elem.getAttribute('hidden_by_compose_glass')) {
      goog.style.setElementShown(elem, true);
      elem.removeAttribute('hidden_by_compose_glass');
    }
  });
};
});  // goog.scope
