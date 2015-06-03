/**
 * @license
 * Copyright 2014 Google Inc. All rights reserved.
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
 * @fileoverview Imports the given keys into the extension.
 */

goog.provide('e2e.ext.actions.ImportKey');

goog.require('e2e.ext.actions.Action');
goog.require('e2e.ext.actions.GetKeyDescription');
goog.require('e2e.ext.utils.Error');


goog.scope(function() {
var actions = e2e.ext.actions;
var constants = e2e.ext.constants;
var utils = e2e.ext.utils;



/**
 * Constructor for the action.
 * @constructor
 * @implements {e2e.ext.actions.Action.<(string|!e2e.ByteArray), !Array.<string>>}
 */
actions.ImportKey = function() {};


/** @override */
actions.ImportKey.prototype.execute =
    function(ctx, request, requestor, callback, errorCallback) {
  if (!goog.isFunction(request.passphraseCallback)) {
    errorCallback(
        new utils.Error('Unable to import key.', 'errorUnableToImportKey'));
    return;
  }

  if (typeof request.content === 'string') {
    var r = /** @type {!e2e.ext.messages.ApiRequest.<string>} */ (request);
    new actions.GetKeyDescription().
        execute(ctx, r, requestor, function(result) {
          if (goog.isDef(result)) {
            ctx.importKey(
                /** @type {!function(string): !e2e.async.Result<string>} */
                (request.passphraseCallback), request.content).
                addCallback(callback).addErrback(errorCallback);
          }
        }, errorCallback);
  } else {
    // TODO(yan): Show a dialog in this case as well.
    ctx.importKey(
        /** @type {!function(string): !e2e.async.Result<string>} */
        (request.passphraseCallback), request.content).
        addCallback(callback).addErrback(errorCallback);
  }
};

});  // goog.scope
