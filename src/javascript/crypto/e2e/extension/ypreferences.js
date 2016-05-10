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
 * @fileoverview Handles the user's preferences inside the extension.
 */

goog.provide('e2e.ext.yPreferences');

goog.require('e2e.ext.Preferences');
goog.require('e2e.ext.constants.StorageKey');



/**
 * Class to handle user's preferences.
 * @constructor
 * @param {!goog.storage.mechanism.Mechanism} storage mechanism for storing
 *     preferences data.
 * @extends {e2e.ext.Preferences}
 */
e2e.ext.yPreferences = function(storage) {
  goog.base(this, storage);
};
goog.inherits(e2e.ext.yPreferences, e2e.ext.Preferences);

goog.scope(function() {
var constants = e2e.ext.constants;


/**
 * Initializes the default preferences.
 * @override
 */
e2e.ext.yPreferences.prototype.initDefaults = function() {
  goog.base(this, 'initDefaults');

  if (null === this.getItem(
      constants.StorageKey.ENABLE_COMPOSE_GLASS)) {
    this.setComposeGlassEnabled(true);
  }
};


/**
 * Enables/disables the compose glass.
 * @param {boolean} enable True if the compose glass is to be enabled.
 * @suppress {accessControls}
 */
e2e.ext.yPreferences.prototype.setComposeGlassEnabled = function(enable) {
  this.storage_.set(
      constants.StorageKey.ENABLE_COMPOSE_GLASS, enable.toString());
};


/**
 * Indicates whether the compose glass is enabled.
 * @return {boolean} True if enabled.
 * @suppress {accessControls}
 */
e2e.ext.yPreferences.prototype.isComposeGlassEnabled = function() {
  return 'true' == this.storage_.get(
      constants.StorageKey.ENABLE_COMPOSE_GLASS);
};

});  // goog.scope
