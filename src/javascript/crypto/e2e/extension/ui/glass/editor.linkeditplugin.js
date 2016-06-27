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
 * @fileoverview Execute the link dialog command on selecting a link or
 * triggering a keyboard shortcut. The keyboard shortcut can as well create a
 * link with the selected range by executing the link command.
 */

goog.provide('e2e.ext.ui.editor.LinkEditPlugin');

goog.require('goog.dom');
goog.require('goog.editor.Command');
goog.require('goog.editor.Link');
goog.require('goog.editor.Plugin');



/**
 * Plugin to execute the link dialog command on selecting a link, and the link
 * command on triggering a keyboard shortcut.
 * @constructor
 * @extends {goog.editor.Plugin}
 * @final
 */
e2e.ext.ui.editor.LinkEditPlugin = function() {
  e2e.ext.ui.editor.LinkEditPlugin.base(this, 'constructor');
};
goog.inherits(e2e.ext.ui.editor.LinkEditPlugin, goog.editor.Plugin);


/** @override */
e2e.ext.ui.editor.LinkEditPlugin.prototype.getTrogClassId = function() {
  return 'LinkEditPlugin';
};


/**
 * @override
 */
e2e.ext.ui.editor.LinkEditPlugin.prototype.handleSelectionChange =
    function(opt_e) {
  return !!opt_e && !this.openLinkEditor_(opt_e.target);
};


/**
 * @override
 */
e2e.ext.ui.editor.LinkEditPlugin.prototype.handleKeyboardShortcut =
    function(e, key, isModifierPressed) {
  if (isModifierPressed && key == 'k' && !e.shiftKey) {
    var field = this.getFieldObject();
    this.openLinkEditor_(field.getRange().getContainer()) ||
        field.execCommand(goog.editor.Command.LINK);
    return true;
  }

  return false;
};


/**
 * Open Link Editor if the target or its ancestor is an anchor element
 * @param {?Node} node The target to find anchor element
 * @return {!boolean} True if found.
 * @private
 */
e2e.ext.ui.editor.LinkEditPlugin.prototype.openLinkEditor_ = function(node) {
  if (node) {
    node = goog.dom.getAncestor(node, function(elem) {
      return elem instanceof HTMLAnchorElement;
    }, true);

    if (node) {
      this.getFieldObject().execCommand(
          goog.editor.Command.MODAL_LINK_EDITOR,
          new goog.editor.Link(
              /** @type {HTMLAnchorElement} */ (node), false));
      return true;
    }
  }
  return false;
};
