/**
 * @license
 * Copyright 2016 Yahoo Inc. All rights reserved.
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
 * @fileoverview Get all keys by emails in the extension.
 */

goog.provide('e2e.ext.actions.GetAllKeysByEmails');

goog.require('e2e.ext.actions.Action');
goog.require('goog.array');
goog.require('goog.async.DeferredList');
goog.require('goog.string');

goog.scope(function() {
var actions = e2e.ext.actions;



/**
 * Constructor for the action.
 * @constructor
 * @implements {e2e.ext.actions.Action.<string, !e2e.openpgp.KeyRingMap>}
 */
actions.GetAllKeysByEmails = function() {};


/** @inheritDoc */
actions.GetAllKeysByEmails.prototype.execute =
    function(ctx, request, requestor, callback, errorCallback) {

  var searchKey_ = goog.bind(request.content == 'private' ?
      ctx.searchPrivateKey :
      ctx.searchPublicKey, ctx);

  goog.async.DeferredList.gatherResults(
      goog.array.map(request.recipients || [], searchKey_)).
          addCallbacks(callback, errorCallback);
};

});  // goog.scope
