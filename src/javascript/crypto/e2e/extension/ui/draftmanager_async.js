// Copyright 2014 Google Inc. All rights reserved.
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
 * @fileoverview Manages saved drafts within the extension.
 */

goog.provide('e2e.ext.ui.draftmanagerAsync');

goog.require('e2e.ext.constants.StorageKey');

goog.scope(function() {
var constants = e2e.ext.constants;
var draftmanager = e2e.ext.ui.draftmanagerAsync;
var localStorage = chrome.storage.local;


/**
 * Persists a draft message.
 * @param {string} draft The draft to persist.
 * @param {string} origin The origin where the message was created.
 */
draftmanager.saveDraft = function(draft, origin) {
  draftmanager.getAllDrafts_(function(allDrafts) {
    allDrafts[origin] = draft;
    draftmanager.persistAllDrafts_(allDrafts);
  });
};


/**
 * Returns the last saved draft for a given origin.
 * @param {string} origin The origin for which the last draft is needed.
 * @param {function(string)} callback The function to call with the draft.
 */
draftmanager.getDraft = function(origin, callback) {
  draftmanager.getAllDrafts_(function(allDrafts) {
    var draft = allDrafts[origin] || '';
    callback(draft);
  });
};


/**
 * Returns true if a saved draft exists for a given origin.
 * @param {string} origin The origin for which the last draft is needed.
 * @param {function(boolean)} callback The function to call with the result.
 */
draftmanager.hasDraft = function(origin, callback) {
  draftmanager.getAllDrafts_(function(allDrafts) {
    callback(Boolean(allDrafts[origin]));
  });
};


/**
 * Removes the saved drafts for a given origin.
 * @param {string} origin The origin for which the drafts are to be removed.
 */
draftmanager.clearDraft = function(origin) {
  draftmanager.getAllDrafts_(function(allDrafts) {
    delete allDrafts[origin];
    draftmanager.persistAllDrafts_(allDrafts);
  });
};


/**
 * Retrieves all draft messages from local storage.
 * @param {function(*)} callback Callback to call with the returned drafts
 * @private
 */
draftmanager.getAllDrafts_ = function(callback) {
  var key = constants.StorageKey.LAST_SAVED_DRAFT;
  localStorage.get(key, function(item) {
    var drafts = /** @type {Object.<string, string>} */ (item[key] || {});
    callback(drafts);
  });
};


/**
 * Persists the provided drafts into local storage, overriding any previous
 * drafts.
 * @param {*} drafts The drafts to persist in local
 *     storage.
 * @private
 */
draftmanager.persistAllDrafts_ = function(drafts) {
  var newDrafts = {};
  newDrafts[constants.StorageKey.LAST_SAVED_DRAFT] = drafts;
  localStorage.set(newDrafts);
};

}); // goog.scope

