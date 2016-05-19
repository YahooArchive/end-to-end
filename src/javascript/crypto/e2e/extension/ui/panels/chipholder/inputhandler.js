/**
 * @license
 * Copyright 2015 Google Inc. All rights reserved.
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
 * @fileoverview Input handler for the ChipHolder autocomplete widget.
 */

goog.provide('e2e.ext.ui.panels.ChipHolderInputHandler');

goog.require('goog.events.KeyCodes');
goog.require('goog.ui.ac.InputHandler');

goog.scope(function() {
var panels = e2e.ext.ui.panels;

/**
 * Constructor for the chip holder input handler.
 * Allows to attach a callback when an autocomplete row has been selected and/or
 * user did not use an autocomplete.
 * @constructor
 * @param {function(string):*} onSelectCallback Callback to call when a row
 *    has been selected.
 * @param {function():!boolean} onFocusToShowRelatedCallback Callback to call
 *    when the input element is focused, return boolean to determine whether
 *    related contacts should be triggered. @yahoo
 * @extends {goog.ui.ac.InputHandler}
 */

panels.ChipHolderInputHandler = function(
    onSelectCallback, onFocusToShowRelatedCallback) {
  // @yahoo increased the throttle time. default is 150ms
  goog.base(this, null, null, true, 500);
  /**
   * Callback to call when a row has been selected.
   * @type {function(string):*}
   * @private
   */
  this.onSelectCallback_ = goog.bind(function(value) {
    onSelectCallback(value);
    // @yahoo trigger related recipient search 
    window.setTimeout(goog.bind(function() {
      this.getAutoComplete().setToken('');
    }, this), 300);
  }, this);
  /**
   * Callback to call when the input element is focused, return boolean to
   * determine whether related contacts should be triggered. @yahoo
   * @type {function():!boolean}
   * @private
   */
  this.onFocusToShowRelatedCallback_ = onFocusToShowRelatedCallback;
};
goog.inherits(panels.ChipHolderInputHandler, goog.ui.ac.InputHandler);


/** @override */
panels.ChipHolderInputHandler.prototype.handleKeyEvent = function(evt) {
  switch (evt.keyCode) {
    case goog.events.KeyCodes.TAB:
    case goog.events.KeyCodes.ENTER:
      // Cover only the case when autocomplete suggestions are not open,
      // the user typed the text and pressed TAB/ENTER.
      if (!this.getAutoComplete().isOpen() &&
          evt.target && evt.target.value && evt.target.value.length > 0) {
        evt.preventDefault();
        evt.stopPropagation();
        evt.target.focus();
        // Call the callback - this will trigger a bad chip.
        this.onSelectCallback_(evt.target.value);
        return false;
      }
    case goog.events.KeyCodes.DOWN: //@yahoo
      this.relatedRecipients(evt);
  }
  return goog.base(this, 'handleKeyEvent', evt);
};


// @yahoo trigger autocomplete when on focus
/** @override */
panels.ChipHolderInputHandler.prototype.handleFocus = function(e) {
  goog.base(this, 'handleFocus', e);
  this.onFocusToShowRelatedCallback_() && this.relatedRecipients(e);
};


/**
 * Make a search for blank for related recipients @yahoo
 * @param {goog.events.Event} e Browser event object.
 * @protected
 */
panels.ChipHolderInputHandler.prototype.relatedRecipients = function(e) {
  var ac = this.getAutoComplete(),
      target = /** @type {Element} */ (e.target);
  if (target && !ac.isOpen()) {
    ac.setTarget(target);
    ac.setToken('');
  }
};


// @yahoo trigger onSelectCallback_ when on blur
/** @override */
panels.ChipHolderInputHandler.prototype.handleBlur = function(opt_e) {
  goog.base(this, 'handleBlur', opt_e);

  if (opt_e && !this.getAutoComplete().isOpen() &&
      opt_e.target && opt_e.target.value && opt_e.target.value.length > 0) {
    // Call the callback - this will trigger a bad chip.
    this.onSelectCallback_(opt_e.target.value);
  }
};


/** @override */
panels.ChipHolderInputHandler.prototype.selectRow = function(row, opt_multi) {
  if (this.getActiveElement()) {
    this.setTokenText(row.toString(), opt_multi);
    this.onSelectCallback_(row.toString());
  }
  return false;
};

});  // goog.scope
