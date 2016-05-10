/**
 * @fileoverview Lists the supported input types for UI dialogs.
 */

goog.provide('e2e.ext.ui.dialogs.InputType');


/**
 * The type of input the dialog should handle.
 * @enum {string}
 */
e2e.ext.ui.dialogs.InputType = {
  NONE: '',
  CHECKBOX: 'checkbox', //@yahoo
  TEXT: 'text',
  SECURE_TEXT: 'password'
};
