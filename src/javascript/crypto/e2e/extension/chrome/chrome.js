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
 * @fileoverview Provides communication to the extension background script,
 * that is resilient to extension updates and reloads.
 */
goog.provide('e2e.ext.chrome');
goog.provide('e2e.ext.chrome.i18n');
goog.provide('e2e.ext.chrome.runtime');


/**
 * @type {{
 *   runtime: {
 *     connect: function((string|!Object)=, !Object=) : Port
 *   },
 *   i18n: {
 *     getMessage: function(string, (string|Array<string>)=) : !string
 *   }
 * }}
 * @private
 */
e2e.ext.chrome.CHROME_ = chrome;


/**
 * @param {!function(Port)} callback Callback to pass on the new port.
 */
e2e.ext.chrome.runtime.connect = function(callback) {
  var port = e2e.ext.chrome.CHROME_.runtime.connect();
  if (port) {
    callback(port);
  } else {
    var iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('blank.html');
    iframe.style.display = 'none';
    iframe.onload = function() {
      // replace the old chrome with the new one
      e2e.ext.chrome.CHROME_ = iframe.contentWindow.chrome;
      callback(e2e.ext.chrome.CHROME_.runtime.connect());
    };
    document.documentElement.appendChild(iframe);
  }
};


/**
 * @param {string} messageId
 * @param {(string|Array<string>)=} opt_args
 * @return {!string}
 */
e2e.ext.chrome.i18n.getMessage = function(messageId, opt_args) {
  return e2e.ext.chrome.CHROME_.i18n.getMessage(messageId, opt_args);
};
