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
 * @fileoverview Sync keys for private key holder
 */

goog.provide('e2e.ext.actions.SyncKeys');

goog.require('e2e.async.Result');
goog.require('e2e.ext.actions.Action');
goog.require('e2e.ext.utils');

goog.scope(function() {
var actions = e2e.ext.actions;



/**
 * Constructor for the action.
 * @constructor
 * @implements {e2e.ext.actions.Action.<string, boolean>}
 */
actions.SyncKeys = function() {};


/** @inheritDoc */
actions.SyncKeys.prototype.execute =
    function(ctx, request, requestor, callback, errorCallback) {

  var uid = request.content;
  ctx.searchPrivateKey(uid).addCallbacks(function(privKeys) {
    // if the user has no private keys, no further sync check is needed
    if (!privKeys || privKeys.length === 0) {
      callback(false);
      return;
    }

    var noFurtherAction = e2e.async.Result.toResult('');
    ctx.syncWithRemote(uid,
        function(uid, commonKeys, keyserverManaged) {
          callback(!keyserverManaged || commonKeys.length !== 0);
          return noFurtherAction;
        },
        function() {
          callback(false);
          return noFurtherAction;
        }).
        addErrback(errorCallback);

  }, errorCallback);

};

});  // goog.scope
