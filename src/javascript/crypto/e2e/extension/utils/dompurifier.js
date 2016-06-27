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
 * @fileoverview Purify DOM and HTML
 */

goog.provide('e2e.ext.utils.DomPurifier');

goog.require('goog.dom');



/**
 * Functions to purify the DOM
 * @param {DOMParser=} opt_domParser A DOMParser instance
 * @constructor
 */
e2e.ext.utils.DomPurifier = function(opt_domParser) {
  this.domParser_ = opt_domParser;
};


/**
 * a list of attributes to be removed from any tags
 * @type {!Array<!string>}
 * @const
 */
e2e.ext.utils.DomPurifier.BLACKLIST_ATTRIBUTES = [
  'accept',
  'accesskey',
  'autofocus',
  'autoplay',
  'autosave',
  'capture',
  'contenteditable',
  'contextmenu',
  'download',
  'draggable',
  'dropzone',
  'formtarget',
  'datasrc',
  'datafld'
];


/**
 * a list of tags to be removed
 * @type {!Array<!string>}
 * @const
 */
e2e.ext.utils.DomPurifier.BLACKLIST_TAGS = [
  'head', // dangerous
  'meta', // dangerous
  'link', // dangerous
  'object', // dangerous
  'embed', // dangerous
  'iframe', // dangerous
  'script', // dangerous
  'noscript', // dangerous
  'dialog', // may cover other elements
  'svg', // borderline
  'title', // borderline
  'canvas', // borderline
  'menu', // borderline
  'menuitem', // borderline
  'slot', // no custom HTML
  'element', // no custom HTML
  'shadow', // no custom HTML
  'template', // no custom HTML
  'content', // no custom HTML
  'keygen', // avoided for ambiguity
  // https://html.spec.whatwg.org/multipage/obsolete.html
  // #non-conforming-features
  'applet',
  'acronym',
  'bgsound',
  'dir',
  'frame',
  'frameset',
  'noframes',
  'hgroup',
  'isindex',
  'listing',
  'nextid',
  'noembed',
  'plaintext',
  'rb',
  'rtc',
  'strike',
  'xmp',
  'basefont',
  'big',
  'blink',
  // 'center',
  // 'font',
  'marquee',
  'multicol',
  'nobr',
  'spacer',
  'tt',
];


/**
 * Cleans the contents of the node passed to it. The node contents are modified
 * directly, and the modifications will subsequently be used, for operations
 * such as saving the innerHTML of the editor etc. Since the plugins act on
 * the DOM directly, this method can be very expensive.
 *
 * @param {!Element} elem The element which needs to be cleaned up.
 */
e2e.ext.utils.DomPurifier.prototype.cleanContentsDom = function(elem) {
  var i, value, tag, newNode, style, tags, attrs;

  // remove disallowed tags
  tags = e2e.ext.utils.DomPurifier.BLACKLIST_TAGS;
  for (i = 0; value = tags[i]; i++) {
    this.removeTags_(elem, value);
  }

  // remove disallowed attributes
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
  attrs = e2e.ext.utils.DomPurifier.BLACKLIST_ATTRIBUTES;
  for (i = 0; value = attrs[i]; i++) {
    this.removeAttrs_(elem, value);
  }

  // allow only whitelisted className (signature and yahoo_quoted)
  this.removeAttrs_(elem, 'class',
      ':not(.signature):not(.yahoo_quoted):not(.y_msg_container)[class]');

  // remove name attrs except submittable, output, and param elements
  this.removeAttrs_(elem, 'name',
      // object and keygen are submittable, but already dropped
      ':not(input):not(textarea):not(button):not(select)' +
      ':not(output):not(param)[name]');

  // remove id attrs except submittable elements
  this.removeAttrs_(elem, 'id',
      // object and keygen are submittable, but already dropped
      ':not(input):not(textarea):not(button):not(select)[id]');

  // flatten <html> and <body>
  tags = elem.getElementsByTagName('html');
  for (i = 0; tag = tags[i]; i++) {
    goog.dom.flattenElement(tag);
  }
  tags = elem.getElementsByTagName('body');
  for (i = 0; tag = tags[i]; i++) {
    goog.dom.flattenElement(tag);
  }

  // TODO: handle <base>?

  // add nofollow and _blank target to hyperlinks and form
  tags = elem.querySelectorAll('a,area,form');
  for (i = 0; tag = tags[i]; i++) {
    tag.rel = 'nofollow';
    tag.target = '_blank';
  }

  // remove dangerous styling
  tags = elem.querySelectorAll('[style]');
  for (i = 0; tag = tags[i]; i++) {
    style = tag.style;

    value = style.position;
    if (value && value !== 'relative') {
      style.position = '';
    }

    value = style.cursor;
    if (value) {
      style.cursor = 'auto';
    }
  }
};


/**
 * Remove tags from the given elem
 * @param {!Element} elem The copy of the editable field.
 * @param {!string} tagName The tag name to remove.
 * @private
 */
e2e.ext.utils.DomPurifier.prototype.removeTags_ = function(
    elem, tagName) {
  var i = 0, tag, tags = elem.getElementsByTagName(tagName);
  for (; tag = tags[i]; i++) {
    tag.parentElement.removeChild(tag);
  }
};


/**
 * Remove attributes from the given elem
 * @param {!Element} elem The copy of the editable field.
 * @param {!string} attrName The attribute name to remove.
 * @param {string=} opt_selector The CSS selector to match with tags.
 * @private
 */
e2e.ext.utils.DomPurifier.prototype.removeAttrs_ = function(
    elem, attrName, opt_selector) {
  var i = 0, tag,
      tags = elem.querySelectorAll(opt_selector || '[' + attrName + ']');
  for (; tag = tags[i]; i++) {
    tag.removeAttribute(attrName);
  }
};


/**
 * Cleans the HTML passed to it. This method is equally or more expensive than
 * cleanContentsDom
 * @param {!string} html The HTML which needs to be cleaned up.
 * @return {string}
 */
e2e.ext.utils.DomPurifier.prototype.cleanContentsHtml = function(html) {
  !this.domParser_ && (this.domParser_ = new DOMParser());
  var doc = this.domParser_.parseFromString(html, 'text/html');
  this.cleanContentsDom(/** @type {!Element} */ (doc.body));
  return doc.body.innerHTML;
};
