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
 * @fileoverview Editor plugin to purify DOM and HTML
 */

goog.provide('e2e.ext.ui.editor.Purifier');

goog.require('e2e.ext.utils.DomPurifier');
goog.require('goog.editor.Plugin');



/**
 * Functions to purify the DOM
 * @param {DOMParser=} opt_domParser A DOMParser instance
 * @constructor
 * @extends {goog.editor.Plugin}
 */
e2e.ext.ui.editor.Purifier = function(opt_domParser) {
  goog.base(this);

  this.domParser_ = opt_domParser || new DOMParser();
  this.domPurifier_ = new e2e.ext.utils.DomPurifier();
};
goog.inherits(e2e.ext.ui.editor.Purifier, goog.editor.Plugin);


/** @override */
e2e.ext.ui.editor.Purifier.prototype.getTrogClassId = function() {
  return 'Purifier';
};


/**
 * @override
 */
e2e.ext.ui.editor.Purifier.prototype.prepareContentsHtml = function(
    html) {
  var doc = this.domParser_.parseFromString(html, 'text/html');
  this.cleanContentsDom(/** @type {!Element} */ (doc.body));
  return doc.body.innerHTML;
};


/**
 * @override
 */
e2e.ext.ui.editor.Purifier.prototype.cleanContentsDom = function(
    fieldCopy) {
  return this.domPurifier_.cleanContentsDom(fieldCopy);
};
