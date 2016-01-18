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

goog.provide('e2e.coname.ProtoBuf');

goog.require('e2e.async.Result');
goog.require('goog.net.jsloader');



/**
 * Constructor for the coname client.
 * @constructor
 */
e2e.coname.ProtoBuf = function() {
  /**
   * @private {boolean}
   */
  this.initialized_ = false;
};


/** @const */
e2e.coname.ProtoBuf.SOURCE_FILE_PATH = 'protobuf-light.alldeps.js';


/**
 * Initializes the external protobuf dependency.
 * @return {!e2e.async.Result.<?Object<string,*>>} The deferred ProtoBuf object
 */
e2e.coname.ProtoBuf.prototype.initialize = function() {
  var d = window.dcodeIO;
  if (d && d.ByteBuffer && d.Long && d.ProtoBuf) {
    return e2e.async.Result.toResult(/** @type {?Object<string,*>} */
        (d.ProtoBuf));
  }

  var result = new e2e.async.Result;
  // XXX: jsloader has spurious timeout errors, so set it to 0 for no timeout.
  goog.net.jsloader.load(
      chrome.runtime.getURL(e2e.coname.ProtoBuf.SOURCE_FILE_PATH),
      {timeout: 0}).addCallbacks(function() {
    var d = window.dcodeIO;
    if (d && d.Long && d.ByteBuffer && d.ProtoBuf) {
      this.initialized_ = true;
      result.callback(d.ProtoBuf);
    } else {
      result.errback(new Error('Missing protobuf!'));
    }
  }, result.errback, this);

  return result;
};
