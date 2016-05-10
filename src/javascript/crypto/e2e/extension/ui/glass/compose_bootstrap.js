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
 * @fileoverview Bootstraps the compose glass.
 */
goog.provide('e2e.ext.ui.glass.compose.bootstrap');

goog.require('e2e.ext.MessageApi');
goog.require('e2e.ext.ui.ComposeGlass');
goog.require('e2e.ext.utils.text');


/**
 * Specifies whether the glass has been bootstrapped.
 * @type {boolean}
 */
e2e.ext.ui.glass.compose.bootstrap = false;

if (!goog.isDef(window.glass)) {
  var api = new e2e.ext.MessageApi('ymail-composeglass');
  api.bootstrapClient(e2e.ext.utils.text.isYmailOrigin, function(origin) {
    if (origin instanceof Error) {
      console.error(origin);
    } else {
      window.glass = new e2e.ext.ui.ComposeGlass(
          /** @type {!string} */ (origin), api);
      window.glass.decorate(document.body);
      e2e.ext.ui.glass.compose.bootstrap = true;
    }
  });
}
