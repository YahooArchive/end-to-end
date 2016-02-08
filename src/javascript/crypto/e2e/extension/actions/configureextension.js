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
 * @fileoverview Configure Extension
 */

goog.provide('e2e.ext.actions.ConfigureExtension');

goog.require('e2e.ext.actions.Action');
goog.require('goog.array');
goog.require('goog.async.DeferredList');
goog.require('goog.string');

goog.scope(function() {
var actions = e2e.ext.actions;



/**
 * Constructor for the action.
 * @constructor
 * @implements {e2e.ext.actions.Action.<string, boolean>}
 */
actions.ConfigureExtension = function() {};


/** @inheritDoc */
actions.ConfigureExtension.prototype.execute =
    function(ctx, request, requestor, callback, errorCallback) {

  chrome.tabs.create({
    url: 'settings.html#' + encodeURIComponent(request.content),
    active: true
  }, goog.nullFunction);

  callback(true);

};

});  // goog.scope
