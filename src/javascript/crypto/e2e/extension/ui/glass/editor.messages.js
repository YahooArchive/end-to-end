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
 * @fileoverview Replace messages common to Editor UI components with
 * chrome.i18n.getMessage()
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.editor.messages');

/** @suppress {extraRequire} */
goog.require('goog.ui.editor.messages');


/** @desc Link button / bubble caption. */
goog.ui.editor.messages.MSG_LINK_CAPTION = '';


/** @desc Title for the dialog that edits a link. */
goog.ui.editor.messages.MSG_EDIT_LINK = chrome.i18n.
    getMessage('editorEditLink');


/** @desc Prompt the user for the text of the link they've written. */
goog.ui.editor.messages.MSG_TEXT_TO_DISPLAY = chrome.i18n.
    getMessage('editorTextToDisplay');


/** @desc Prompt the user for the URL of the link they've created. */
goog.ui.editor.messages.MSG_LINK_TO = chrome.i18n.getMessage('editorLinkTo');


/**
 * @desc Text for a button that allows the user to test the link that
 *     they created.
 */
goog.ui.editor.messages.MSG_TEST_THIS_LINK = chrome.i18n.
    getMessage('editorTestThisLink');
