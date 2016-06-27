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
 * @fileoverview Factory functions for creating an editing toolbar.
 */
goog.provide('e2e.ext.ui.editor.Toolbars');

goog.require('e2e.ext.constants.CssClass');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.editor.Command');
goog.require('goog.ui.ColorPalette');
goog.require('goog.ui.Component');
goog.require('goog.ui.Menu');
goog.require('goog.ui.MenuHeader');
goog.require('goog.ui.editor.DefaultToolbar');
goog.require('goog.ui.editor.ToolbarController');
goog.require('goog.ui.editor.ToolbarFactory');
goog.require('goog.userAgent');



/**
 * @param {!goog.editor.Field} field The editor field
 * @param {!Element} elem Toolbar parent element.
 * @param {boolean=} opt_isRightToLeft Whether the editor chrome is
 *     right-to-left; defaults to the directionality of the toolbar parent
 *     element.
 * @constructor
 */
e2e.ext.ui.editor.Toolbars = function(field, elem, opt_isRightToLeft) {
  this.field_ = field;
  this.elem_ = elem;
  this.opt_isRightToLeft_ = opt_isRightToLeft;

  this.domHelper_ = goog.dom.getDomHelper(elem);
  this.controllers_ = [];

  this.createFontButtons_();
  this.createDecorationButtons_();
  this.createColorButtons_();
  this.createLinkButton_();
  this.createListButtons_();
  this.createInOutDentButtons_();
  this.createJustifyButtons_();
};


/**
 * The default font families
 * @type {!Array<{caption:string, value:string}>}
 */
e2e.ext.ui.editor.Toolbars.FONTS = [
  {
    caption: 'Modern',
    value: 'HelveticaNeue,Helvetica Neue,Helvetica,' +
        'Arial,Lucida Grande,sans-serif'
  },
  {caption: 'Modern wide', value: 'verdana,helvetica,sans-serif'},
  {caption: 'Classic', value: 'times new roman,new york,times, serif'},
  {caption: 'Classic wide', value: 'bookman old style,new york,times,serif'},
  {
    caption: 'Courier New',
    value: 'Courier New,courier,monaco,monospace,sans-serif'
  },
  {caption: 'Garamond', value: 'garamond,new york,times,serif'},
  {caption: 'Lucida Console', value: 'lucida console,sans-serif'}
];


/**
 * The default font sizes
 * @type {!Array<{caption:string, value:number}>}
 */
e2e.ext.ui.editor.Toolbars.FONT_SIZES = [
  {caption: 'Tiny', value: 1},
  {caption: 'Small', value: 2},
  {caption: 'Medium', value: 3},
  {caption: 'Large', value: 5},
  {caption: 'X-Large', value: 6},
  {caption: 'Huge', value: 7}
];


/**
 * The default colors
 * @type {!Array<string>}
 */
e2e.ext.ui.editor.Toolbars.COLORS = [
  '#000000', '#808080', '#ffffff',
  '#9d1811', '#cd232c', '#d36a53',
  '#a46016', '#dd902f', '#e4ac64',
  '#ac9e19', '#fdef2b', '#fdf869',
  '#5b8828', '#8fca40', '#add773',
  '#4c76a2', '#70aced', '#7dbef1',
  '#440062', '#652191', '#845aa7',
  '#9c005c', '#cb008e', '#d264aa'
];


/**
 * Creates font family and size buttons
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createFontButtons_ = function() {
  var defaultFonts = e2e.ext.ui.editor.Toolbars.FONTS,
      defaultSizes = e2e.ext.ui.editor.Toolbars.FONT_SIZES;

  // override the default fonts and sizes
  /** @suppress {accessControls} */
  goog.ui.editor.DefaultToolbar.FONTS_ = defaultFonts;
  /** @suppress {accessControls} */
  goog.ui.editor.DefaultToolbar.FONT_SIZES_ = defaultSizes;


  var domHelper = this.domHelper_,
      subMenu1 = domHelper.createDom(goog.dom.TagName.DIV),
      subMenu2 = domHelper.createDom(goog.dom.TagName.DIV),
      menuHolder = domHelper.createDom(goog.dom.TagName.DIV,
          {className: 'goog-multi-menus font-menus'}, subMenu1, subMenu2);

  this.fontFaceButton = goog.ui.editor.DefaultToolbar.
      makeBuiltInToolbarButton(goog.editor.Command.FONT_FACE, domHelper);
  this.fontFaceButton.setDefaultCaption(defaultFonts[0].caption);

  this.fontSizeButton = goog.ui.editor.DefaultToolbar.
      makeBuiltInToolbarButton(goog.editor.Command.FONT_SIZE, domHelper);
  this.fontSizeButton.setDefaultCaption(defaultSizes[1].caption);

  this.createCombinedButtons_(this.fontFaceButton, this.fontSizeButton,
      subMenu1, subMenu2, menuHolder);
};


/**
 * Creates bold and italic buttons
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createDecorationButtons_ = function() {
  this.createToolbar_([
    goog.ui.editor.DefaultToolbar.
        makeBuiltInToolbarButton(goog.editor.Command.BOLD, this.domHelper_),
    goog.ui.editor.DefaultToolbar.
        makeBuiltInToolbarButton(goog.editor.Command.ITALIC, this.domHelper_)
  ]);
};


/**
 * Creates fore and background color buttons
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createColorButtons_ = function() {
  var domHelper = this.domHelper_,
      subMenu1 = domHelper.createDom(goog.dom.TagName.DIV),
      subMenu2 = domHelper.createDom(goog.dom.TagName.DIV),
      menuHolder = domHelper.createDom(goog.dom.TagName.DIV,
          {className: 'goog-multi-menus color-menus'}, subMenu1, subMenu2);

  var foreColorMenu = new goog.ui.Menu();
  foreColorMenu.addChild(new goog.ui.MenuHeader(
      chrome.i18n.getMessage('editorColorText')), true);

  var foreColorPalette = new goog.ui.ColorPalette(
      e2e.ext.ui.editor.Toolbars.COLORS);
  foreColorPalette.setSize(3);
  foreColorMenu.addChild(foreColorPalette, true);

  var foreColorButton = this.createColorButton_(
      goog.editor.Command.FONT_COLOR,
      goog.ui.editor.DefaultToolbar.MSG_FONT_COLOR_TITLE,
      foreColorMenu,
      goog.getCssName('tr-icon') + ' ' + goog.getCssName('tr-foreColor'));
  // Initialize default foreground color.
  foreColorButton.setSelectedColor('#000000');


  var bgColorMenu = new goog.ui.Menu();
  bgColorMenu.addChild(new goog.ui.MenuHeader(
      chrome.i18n.getMessage('editorColorHighlight')), true);

  // var bgDefaultColors = e2e.ext.ui.editor.Toolbars.DEFAULT_COLORS;
  // bgDefaultColors[2] = goog.ui.ColorMenuButton.NO_COLOR;
  var bgColorPalette = new goog.ui.ColorPalette(
      e2e.ext.ui.editor.Toolbars.COLORS);
  bgColorPalette.setSize(3);
  bgColorMenu.addChild(bgColorPalette, true);

  var bgColorButton = this.createColorButton_(
      goog.editor.Command.BACKGROUND_COLOR,
      goog.ui.editor.DefaultToolbar.MSG_BACKGROUND_COLOR_TITLE,
      bgColorMenu,
      goog.getCssName('tr-icon') + ' ' + goog.getCssName('tr-backColor'));
  // Initialize default background color.
  bgColorButton.setSelectedColor('#ffffff');


  this.createCombinedButtons_(
      foreColorButton, bgColorButton, subMenu1, subMenu2, menuHolder);
};


/**
 * Creates a color menu button with the given ID, tooltip, and color palette
 * menu.
 * @param {string} id Button ID; must equal a {@link goog.editor.Command} for
 *     built-in toolbar buttons, but can be anything else for custom buttons.
 * @param {string} tooltip Tooltip to be shown on hover.
 * @param {goog.ui.Menu} menu Button menu.
 * @param {string=} opt_classNames CSS class name(s) to apply to the caption
 *     element.
 * @return {!goog.ui.ColorMenuButton} A color menu button.
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createColorButton_ = function(
    id, tooltip, menu, opt_classNames) {
  var button = goog.ui.editor.ToolbarFactory.makeColorMenuButton(
      id, tooltip, '', opt_classNames, undefined, this.domHelper_);
  button.setMenu(menu);

  button.updateFromValue = function(color) {
    var value = color;
    /** @preserveTry */
    try {
      if (goog.userAgent.IE) {
        // IE returns a number that, converted to hex, is a BGR color.
        // Convert from decimal to BGR to RGB.
        var hex = '000000' + value.toString(16);
        var bgr = hex.substr(hex.length - 6, 6);
        value = '#' + bgr.substring(4, 6) +
                bgr.substring(2, 4) + bgr.substring(0, 2);
      }
      if (value != button.getValue()) {
        button.setValue(/** @type {string} */ (value));
      }
    } catch (ex) {
      // TODO(attila): Find out when/why this happens.
    }
  };

  button.queryable = true;
  return button;
};


/**
 * Creates link button
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createLinkButton_ = function() {
  this.createToolbar_([
    goog.ui.editor.DefaultToolbar.
        makeBuiltInToolbarButton(goog.editor.Command.LINK, this.domHelper_)
  ]);
};


/**
 * Creates bullet and numbered list buttons
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createListButtons_ = function() {
  this.createToolbar_([
    goog.ui.editor.DefaultToolbar.makeBuiltInToolbarButton(
        goog.editor.Command.UNORDERED_LIST, this.domHelper_),
    goog.ui.editor.DefaultToolbar.makeBuiltInToolbarButton(
        goog.editor.Command.ORDERED_LIST, this.domHelper_)
  ], e2e.ext.constants.CssClass.TOOLBAR_SEPARATOR);
};


/**
 * Creates indent and outdent buttons
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createInOutDentButtons_ = function() {
  this.createToolbar_([
    goog.ui.editor.DefaultToolbar.
        makeBuiltInToolbarButton(goog.editor.Command.INDENT, this.domHelper_),
    goog.ui.editor.DefaultToolbar.
        makeBuiltInToolbarButton(goog.editor.Command.OUTDENT, this.domHelper_)
  ], e2e.ext.constants.CssClass.TOOLBAR_SEPARATOR);
};


/**
 * Creates justify buttons
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createJustifyButtons_ = function() {
  this.createToolbar_([
    goog.ui.editor.DefaultToolbar.makeBuiltInToolbarButton(
        goog.editor.Command.JUSTIFY_LEFT, this.domHelper_),
    goog.ui.editor.DefaultToolbar.makeBuiltInToolbarButton(
        goog.editor.Command.JUSTIFY_CENTER, this.domHelper_),
    goog.ui.editor.DefaultToolbar.makeBuiltInToolbarButton(
        goog.editor.Command.JUSTIFY_RIGHT, this.domHelper_)
  ], e2e.ext.constants.CssClass.TOOLBAR_SEPARATOR);
};


/**
 * Creates a {@link goog.ui.Toolbar} and its controller. Hook it to the editor.
 * @param {!Array<goog.ui.Control>} controls
 * @param {string=} opt_cssClass CSS class name for the toolbar
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createToolbar_ = function(
    controls, opt_cssClass) {
  var toolbar = goog.ui.editor.ToolbarFactory.makeToolbar(
      controls, this.elem_, this.opt_isRightToLeft_);
  // add the css class name
  opt_cssClass && toolbar.getElement().classList.add(opt_cssClass);
  this.controllers_.push(
      new goog.ui.editor.ToolbarController(this.field_, toolbar));
};


/**
 * @param {goog.ui.Button} button1
 * @param {goog.ui.Button} button2
 * @param {Element} subMenu1
 * @param {Element} subMenu2
 * @param {Element} menuHolder
 * @private
 */
e2e.ext.ui.editor.Toolbars.prototype.createCombinedButtons_ = function(
    button1, button2, subMenu1, subMenu2, menuHolder) {
  // Open and collapse the font size menu simultaneously
  button1.listen(goog.ui.Component.EventType.OPEN, function() {
    var m1 = button1.getMenu(), m2 = button2.getMenu();
    if (!m1.isInDocument() || !m2.isInDocument()) {
      this.domHelper_.appendChild(this.elem_, menuHolder);
      m1.render(subMenu1);
      m2.render(subMenu2);
    }
    button2.setActive(true);
    button2.showMenu();
    menuHolder.classList.remove(e2e.ext.constants.CssClass.HIDDEN);
  }, false, this);

  // hide the menu holder when submenu close
  button1.listen(goog.ui.Component.EventType.CLOSE, function() {
    !button2.isOpen() &&
        menuHolder.classList.add(e2e.ext.constants.CssClass.HIDDEN);
  }, false);
  button2.listen(goog.ui.Component.EventType.CLOSE, function() {
    !button1.isOpen() &&
        menuHolder.classList.add(e2e.ext.constants.CssClass.HIDDEN);
  }, false);

  this.createToolbar_([button1]);
  this.createToolbar_([button2], e2e.ext.constants.CssClass.HIDDEN);
};
