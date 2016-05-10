/**
 * @license
 * Copyright 2013 Google Inc. All rights reserved.
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
 * @fileoverview Defines the message formats used throughout the extension.
 */

goog.provide('e2e.ext.messages.ApiRequest');
goog.provide('e2e.ext.messages.ApiResponse');
goog.provide('e2e.ext.messages.BridgeMessageRequest');
goog.provide('e2e.ext.messages.BridgeMessageResponse');
goog.provide('e2e.ext.messages.GetSelectionRequest');
goog.provide('e2e.ext.messages.KeyserverKeyInput');
goog.provide('e2e.ext.messages.KeyserverKeyOutput');
goog.provide('e2e.ext.messages.e2ebindDraft');
goog.provide('e2e.ext.messages.e2ebindRequest');
goog.provide('e2e.ext.messages.e2ebindResponse');
goog.provide('e2e.ext.messages.proxyMessage');


goog.scope(function() {
var messages = e2e.ext.messages;


/**
 * The message type passed from a content script to the extension when a bridge
 * port is used. //@yahoo added ccRecipients
 * @typedef {{
 *   selection: string,
 *   recipients: Array.<string>,
 *   ccRecipients: Array.<string>,
 *   action: (e2e.ext.constants.Actions|undefined),
 *   request: boolean,
 *   origin: string,
 *   subject: (string|undefined),
 *   canInject: boolean,
 *   canSaveDraft: boolean
 * }}
 */
messages.BridgeMessageRequest;


/**
 * The message type passed from the extension to a content script when a bridge
 * port is used.
 * @typedef {{
 *   value: string,
 *   response: boolean,
 *   detach: boolean,
 *   origin: string,
 *   subject: (string|undefined),
 *   from: (string|undefined),
 *   send: boolean,
 *   recipients: !Array.<string>
 * }}
 */
messages.BridgeMessageResponse;


/**
 * The message type passed to the helper when a request for the current
 * selection is made.
 * @typedef {{
 *   editableElem: boolean,
 *   enableLookingGlass: boolean,
 *   hasDraft: boolean
 * }}
 */
messages.GetSelectionRequest;



/**
 * Defines a request message to the context API.
 * @interface
 * @template T
 */
messages.ApiRequest = function() {};


/** @type {T} */
messages.ApiRequest.prototype.content;


/** @type {!Array.<string>|undefined} */
messages.ApiRequest.prototype.recipients;


/** @type {!Array.<string>|undefined} */
messages.ApiRequest.prototype.encryptPassphrases;


/** @type {string|undefined} */
messages.ApiRequest.prototype.decryptPassphrase;


/** @type {!function(string): !e2e.async.Result<string>|undefined} */
messages.ApiRequest.prototype.passphraseCallback;


/** @type {string|undefined} */
messages.ApiRequest.prototype.currentUser;


/** @type {boolean|undefined} */
messages.ApiRequest.prototype.signMessage;


/** @type {e2e.ext.constants.Actions} */
messages.ApiRequest.prototype.action;


/**
 * Defines the response message from the context API.
 * @typedef {{
 *   content: (boolean|string|Object|undefined),
 *   completedAction: e2e.ext.constants.Actions,
 *   error: (string | undefined)
 * }}
 */
messages.ApiResponse;


/**
 * Defines the request message from the e2ebind API to a provider and from
 *   provider to e2ebind API.
 * @typedef {{
 *   api: string,
 *   source: string,
 *   action: string,
 *   args: (Object|undefined),
 *   hash: string
 * }}
 */
messages.e2ebindRequest;


/**
 * Defines the response message from the e2ebind API to a provider and from
 *   provider to e2ebind API.
 * @typedef {{
 *   api: string,
 *   source: string,
 *   success: boolean,
 *   action: string,
 *   hash: string,
 *   result: Object,
 *   error: ?Object
 * }}
 */
messages.e2ebindResponse;


/**
 * Defines e2ebind draft format that the provider receives.
 * @typedef {{
 *   body: string,
 *   to: !Array.<string>,
 *   cc: Array.<string>,
 *   bcc: Array.<string>,
 *   subject: (string|undefined),
 *   from: (string|undefined),
 *   contacts: Array.<{email:string,firstname:string}>,
 *   insideConv: boolean
 * }}
 */
messages.e2ebindDraft;


/**
 * Defines general message format between extension content scripts.
 * @typedef {{
 *   proxy: (boolean|undefined),
 *   action: e2e.ext.constants.Actions,
 *   content: (Object|string|undefined)
 * }}
 */
messages.proxyMessage;


/**
 * Defines the format for timestamped key data returned by the keyserver.
 * @typedef {{
 *   userid: string,
 *   keys: Object.<string, string>,
 *   t: number
 * }}
 */
messages.KeyserverKeyOutput;


/**
 * Format for key data that is serialized and then signed by the key authority.
 * @typedef {{
 *   t: number,
 *   deviceid: string,
 *   userid: string,
 *   key: string
 * }}
 */
messages.KeyserverKeyInput;

});  // goog.scope
