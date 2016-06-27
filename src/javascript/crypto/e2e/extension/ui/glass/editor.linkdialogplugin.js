// Copyright 2016 Yahoo! Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview execute the link dialog command on selecting a link, and the
 * link command on triggering a keyboard shortcut.
 */

goog.provide('e2e.ext.ui.editor.LinkDialogPlugin');

/** @suppress {extraRequire} to use text with chrome.i18n.getMessage */
goog.require('e2e.ext.ui.editor.messages');
goog.require('goog.dom');
goog.require('goog.editor.plugins.AbstractDialogPlugin');
goog.require('goog.editor.plugins.LinkDialogPlugin');
goog.require('goog.string');



/**
 * Plugin to execute the link dialog command on selecting a link, and the link
 * command on triggering a keyboard shortcut.
 * @constructor
 * @extends {goog.editor.plugins.LinkDialogPlugin}
 * @final
 */
e2e.ext.ui.editor.LinkDialogPlugin = function() {
  goog.base(this);

  this.stopReferrerLeaks();

  // the following are specific to yahoo mail use case
  this.listen(goog.editor.plugins.AbstractDialogPlugin.EventType.OPENED,
      /** @suppress {accessControls} */
      function() {
        // okButton won't be disabled. so, an empty URL can trigger removal.
        var okButton = this.getDialog().getOkButtonElement();
        okButton.disabled = false;
        Object.defineProperty(okButton, 'disabled', {writable: false});

        // add the URL placeholder
        goog.dom.getElement('linkdialog-onweb-tab-input').
            placeholder = 'https://www.yahoo.com/';
      }, false);
};
goog.inherits(
    e2e.ext.ui.editor.LinkDialogPlugin,
    goog.editor.plugins.LinkDialogPlugin);


/**
 * Override the original handleOk. Remove the link on empty linkUrl.
 * @protected
 * @override
 */
e2e.ext.ui.editor.LinkDialogPlugin.prototype.handleOk = function(e) {
  // remove the hyperlink if the linkUrl is empty or has only whitespace
  if (!goog.string.isEmptyOrWhitespace(e.linkUrl) && e.linkUrl !== 'http://') {
    return goog.base(this, 'handleOk', e);
  }

  this.getCurrentLink().removeLink();
  this.getFieldObject().dispatchChange();
  this.getEventHandler().removeAll();
};
