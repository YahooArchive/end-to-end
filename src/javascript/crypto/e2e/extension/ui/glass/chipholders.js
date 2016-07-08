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
 * @fileoverview Multiple chipholders to handle recipients in to and cc fields.
 */

goog.provide('e2e.ext.ui.ChipHolders');

/** @suppress {extraRequire} intentional import */
goog.require('e2e.ext.YmailType'); //@yahoo
goog.require('e2e.ext.ui.panels.Chip');
goog.require('e2e.ext.ui.panels.ChipHolder');
goog.require('e2e.ext.ui.panels.ChipHolderInputHandler'); //@yahoo
goog.require('e2e.ext.utils.text');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.html.SafeUrl'); //@yahoo
goog.require('goog.ui.Component');
goog.require('goog.ui.ac.AutoComplete'); //@yahoo
goog.require('goog.ui.ac.Renderer'); //@yahoo
goog.require('soy');


goog.scope(function() {
var ext = e2e.ext;
var ui = ext.ui;
var utils = ext.utils;
var panels = ui.panels;
var constants = ext.constants;



/**
 * Constructor for the multiple chip holders
 * @param {!Array.<ext.YmailType.EmailUser>} toRecipients
 * @param {!Array.<ext.YmailType.EmailUser>} ccRecipients
 * @param {!function(string, number, function(string, !Array<string>))}
 *     requestMatchingRows Callback for the requestMatchingRows() API to
 *     fulfill recipient autocompletion.
 * @param {!function(string):!goog.async.Deferred.<!boolean>} hasKeysCallback
 *     Callback for checking if the given uid has a key.
 *     //@yahoo no full list of bad uids are available, check online
 * @param {Function} renderEncryptionPassphraseDialog Callback for rendering
 *     an encryption passphrase dialog. //@yahoo accept null to disable.
 * @extends {goog.ui.Component}
 * @constructor
 */
ui.ChipHolders = function(
    toRecipients, ccRecipients,
    requestMatchingRows, hasKeysCallback, renderEncryptionPassphraseDialog) {
  goog.base(this);

  this.toRecipients_ = toRecipients;
  this.ccRecipients_ = ccRecipients;

  this.requestMatchingRows_ = requestMatchingRows;
  this.hasKeysCallback_ = hasKeysCallback;
  this.renderEncryptionPassphraseDialog_ = renderEncryptionPassphraseDialog;

  this.holderElem_ = goog.dom.getElement(constants.ElementId.CHIP_HOLDER);
  this.ccHolderElem_ = goog.dom.getElement(constants.ElementId.CC_CHIP_HOLDER);
  this.holderDisplayLabel_ = goog.dom.getElementByClass(
      constants.CssClass.TOGGLE_CC_LABEL, this.holderElem_.parentElement);
  this.ccHolderDisplayLabel_ = goog.dom.getElementByClass(
      constants.CssClass.TOGGLE_CC_LABEL, this.ccHolderElem_.parentElement);
};
goog.inherits(ui.ChipHolders, goog.ui.Component);


/** @override */
ui.ChipHolders.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);

  this.chipHolder_ = new panels.ChipHolder(
      panels.ChipHolder.FIELD.TO,
      goog.array.map(this.toRecipients_, utils.text.userObjectToUid),
      goog.bind(this.getAutoComplete_, this),
      // @yahoo enhanced ChipHolder with dynamic validation
      this.hasKeysCallback_,
      this.renderEncryptionPassphraseDialog_);

  // @yahoo added cc recipients
  this.ccChipHolder_ = new panels.ChipHolder(
      panels.ChipHolder.FIELD.CC,
      goog.array.map(this.ccRecipients_, utils.text.userObjectToUid),
      goog.bind(this.getAutoComplete_, this),
      // @yahoo enhanced ChipHolder with dynamic validation
      this.hasKeysCallback_,
      null);

  this.addChild(this.chipHolder_, false);
  this.addChild(this.ccChipHolder_, false);

  this.chipHolder_.decorate(this.holderElem_);
  this.ccChipHolder_.decorate(this.ccHolderElem_);

  this.createAutoComplete_();

  // hide the cc field if no cc recipients are given
  this.setCCShown_(this.ccChipHolder_.hasChildren(), false);
};


/** @override */
ui.ChipHolders.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // install the handlers for show and hide cc links
  this.getHandler().
      listen(this.holderDisplayLabel_, goog.events.EventType.CLICK,
          goog.bind(this.setCCShown_, this, true, true)).
      listen(this.ccHolderDisplayLabel_, goog.events.EventType.CLICK,
          goog.bind(this.setCCShown_, this, false, false)).
      // display hide CC link depending on existence of cc recipients
      listen(this.ccChipHolder_, goog.events.EventType.CHANGE,
          goog.bind(this.showHideCC_, this));
};


/**
 * Toggles the display of the CC field
 * @param {!boolean} isShown True to display the element in its default style,
 *     false to disable rendering the element.
 * @param {!boolean} isFocusedOnCC Whether to focus on the CC field on shown.
 * @private
 */
ui.ChipHolders.prototype.setCCShown_ = function(isShown, isFocusedOnCC) {
  goog.style.setElementShown(this.ccHolderElem_.parentElement, isShown);
  goog.style.setElementShown(this.holderDisplayLabel_, !isShown);

  if (isShown) {
    isFocusedOnCC && this.ccChipHolder_.focus();
    this.showHideCC_();
  }
};


/**
 * Toggles the display of the Hide CC link
 * @private
 */
ui.ChipHolders.prototype.showHideCC_ = function() {
  goog.style.setElementShown(
      this.ccHolderDisplayLabel_, !this.ccChipHolder_.hasChildren());
};



/**
 * Returns whether there are any recipients
 * @override
 */
ui.ChipHolders.prototype.hasChildren = function() {
  return this.chipHolder_.hasChildren() || this.ccChipHolder_.hasChildren();
};


/**
 * Adds a new chip to the chip holder using the selection in the input field.
 * Aborts if ChipHolder is locked.
 * @param {!string} passphrase The passphrase.
 * @return {!panels.Chip|undefined} The chip being added
 */
ui.ChipHolders.prototype.addPassphraseChip = function(passphrase) {
  return this.chipHolder_.addChip(new panels.Chip(passphrase, true));
};


/**
 * Returns a list with the selected UIDs.
 * @param {boolean=} opt_ignoreInput Whether to ignore the incomplete input
 * @return {!Array.<string>} A list with the selected UIDs.
 */
ui.ChipHolders.prototype.getAllUids = function(opt_ignoreInput) {
  return [].concat(
      this.chipHolder_.getSelectedUids(opt_ignoreInput),
      this.ccChipHolder_.getSelectedUids(opt_ignoreInput));
};


/**
 * Returns a list with the selected UIDs.
 * @param {!panels.ChipHolder.FIELD} field The chipholder concerned
 * @param {boolean=} opt_ignoreInput Whether to ignore the incomplete input
 * @return {!Array.<string>} A list with the selected UIDs.
 */
ui.ChipHolders.prototype.getUids = function(field, opt_ignoreInput) {
  return (field === panels.ChipHolder.FIELD.CC ?
      this.ccChipHolder_ :
      this.chipHolder_).getSelectedUids(opt_ignoreInput);
};


/**
 * Returns a list with the user-provided passphrases (for symmetric encryption).
 * @return {!Array.<string>} A list with the provided passphrases.
 */
ui.ChipHolders.prototype.getProvidedPassphrases = function() {
  return this.chipHolder_.getProvidedPassphrases();
};


/**
 * Locks all ChipHolders, disallowing modifications to chips.
 */
ui.ChipHolders.prototype.lock = function() {
  this.chipHolder_.lock();
  this.ccChipHolder_.lock();
};


/**
 * Changes focus to the to input field.
 */
ui.ChipHolders.prototype.focus = function() {
  this.chipHolder_.focus();
};


/**
 * Factory function for building an autocomplete widget for the Chips.
 * @return {!goog.ui.ac.AutoComplete} A new autocomplete object.
 * @private
 */
ui.ChipHolders.prototype.createAutoComplete_ = function() {
  // must be called after chipHolder_ and ccChipHolder_ are rendered
  var chipHolder = this.chipHolder_,
      ccChipHolder = this.ccChipHolder_,
      chipHolderElem = chipHolder.getElement(),
      ccChipHolderElem = ccChipHolder.getElement();

  // @yahoo used autosuggest api instead of a static allUids
  var renderer = new goog.ui.ac.Renderer(undefined, {
    renderRow: function(row, token, elem) {
      var text = e2e.ext.utils.text.userObjectToUid(row.data);
      var imageUrl = goog.html.SafeUrl.sanitize(row.data.imageUrl);
      // imageUrl is encodeURI()-ed, and it's thus safe to put inside url("")
      elem.style.backgroundImage = 'url("' + row.data.imageUrl + '")';
      goog.dom.setTextContent(elem, text);
    }
  });
  renderer.setAnchorElement(chipHolderElem);
  renderer.setAnchorElement(ccChipHolderElem);

  var inputHandler = new ui.panels.ChipHolderInputHandler(function(value) {
    var target = this.getAutoComplete().getTarget();
    return (target.classList.contains('to') ? chipHolder : ccChipHolder).
        handleNewChipValue(value);
  }, goog.bind(this.hasChildren, this));

  var autoComplete = new goog.ui.ac.AutoComplete({
    requestMatchingRows: this.requestMatchingRows_
  }, renderer, inputHandler);
  // autoComplete.setTriggerSuggestionsOnUpdate(true);
  autoComplete.listen(goog.ui.ac.AutoComplete.EventType.UPDATE, function(evt) {
    this.dismiss();
    this.getSelectionHandler().update(true);
  });
  inputHandler.attachAutoComplete(autoComplete);
  inputHandler.attachInputs(
      chipHolderElem.querySelector('input'),
      ccChipHolderElem.querySelector('input'));
  return (this.autoComplete_ = autoComplete);
};


/**
 * Retrieve the autocomplete widget for the Chips.
 * @return {!goog.ui.ac.AutoComplete} The autocomplete object.
 * @private
 */
ui.ChipHolders.prototype.getAutoComplete_ = function() {
  return this.autoComplete_;
};

});  // goog.scope
