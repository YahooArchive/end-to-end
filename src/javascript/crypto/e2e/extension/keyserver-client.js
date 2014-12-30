/**
 * @license
 * Copyright 2014 Yahoo Inc. All rights reserved.
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
 * @fileoverview The Yahoo E2E keyserver client component.
 */

goog.provide('e2e.ext.keyserver');
goog.provide('e2e.ext.keyserver.AuthError');
goog.provide('e2e.ext.keyserver.Client');
goog.provide('e2e.ext.keyserver.RequestError');
goog.provide('e2e.ext.keyserver.ResponseError');

goog.require('e2e.ecc.Ecdsa');
goog.require('e2e.ecc.PrimeCurve');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.messages.KeyserverKeyInput');
goog.require('e2e.ext.messages.KeyserverKeyOutput');
goog.require('e2e.ext.messages.KeyserverSignedResponse');
goog.require('e2e.ext.utils');
goog.require('goog.array');
goog.require('goog.crypt.base64');
goog.require('goog.debug.Error');
goog.require('goog.math');
goog.require('goog.object');


goog.scope(function() {
var ext = e2e.ext;
var messages = e2e.ext.messages;
var constants = e2e.ext.constants;



/**
 * Error indicating an invalid response from the keyserver.
 * @param {*=} opt_msg The custom error message.
 * @constructor
 * @extends {goog.debug.Error}
 */
ext.keyserver.ResponseError = function(opt_msg) {
  goog.base(this, opt_msg);
};
goog.inherits(ext.keyserver.ResponseError, goog.debug.Error);



/**
 * Error indicating an invalid request to the keyserver.
 * @param {*=} opt_msg The custom error message.
 * @constructor
 * @extends {goog.debug.Error}
 */
ext.keyserver.RequestError = function(opt_msg) {
  goog.base(this, opt_msg);
};
goog.inherits(ext.keyserver.RequestError, goog.debug.Error);



/**
 * Error indicating invalid authorization for a request.
 * @param {*=} opt_msg The custom error message.
 * @constructor
 * @extends {goog.debug.Error}
 */
ext.keyserver.AuthError = function(opt_msg) {
  goog.base(this, opt_msg);
};
goog.inherits(ext.keyserver.AuthError, goog.debug.Error);



/**
 * Constructor for the keyclient.
 * @param {string} location The location of the mail provider page.
 * @param {string=} opt_origin The origin of the keyserver
 * @param {string=} opt_api API string of the keyserver
 * @constructor
 */
ext.keyserver.Client = function(location, opt_origin, opt_api) {
  this.pageLocation_ = location;
  this.keyserverOrigin_ = opt_origin || constants.Keyserver.TESTSERVER_ORIGIN;
  this.keyserverApiVersion_ = opt_api || constants.Keyserver.API_V1;
  this.maxFreshnessTime = 24 * 3600;
};


/**
 * Friendlier wrapper around XHR POST.
 * @param {string} path The URL path, ex: 'foo/bar'.
 * @param {function(messages.KeyserverSignedResponse)} callback The success
 *   callback.
 * @param {function(number)} errback The errorback for non-200 codes.
 * @param {string=} opt_params Optional POST params.
 * @private
 */
ext.keyserver.Client.prototype.sendPostRequest_ =
    function(path, callback, errback, opt_params) {
  var xhr = new XMLHttpRequest();
  xhr.timeout = 1000;
  var url = [this.keyserverOrigin_, this.keyserverApiVersion_, path].join('/');
  xhr.open('POST', url, true);

  ext.utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.GET_AUTH_TOKEN,
    content: this.pageLocation_
  }), goog.bind(function(response) {
    var result = response.content;
    xhr.setRequestHeader('X-Keyshop-Token', result);
    xhr.setRequestHeader('Content-Type', 'text/plain');
    xhr.send(opt_params);
  }, this));

  xhr.onreadystatechange = function() {
    var response;
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        response = /** @type {messages.KeyserverSignedResponse} */
            (xhr.responseType === 'json' ? xhr.response :
             window.JSON.parse(xhr.responseText));
        console.log('got XHR response', response);
        callback(response);
      } else {
        errback(xhr.status);
      }
    }
  };
};


/**
 * Friendlier wrapper around XHR GET.
 * @param {string} path The URL path, ex: 'foo/bar'.
 * @param {function(?messages.KeyserverKeyOutput)} callback
 *   The success callback.
 * @param {function(number)} errback The errorback for non-200 codes.
 * @private
 */
ext.keyserver.Client.prototype.sendGetRequest_ = function(path, callback,
                                                          errback) {
  var xhr = new XMLHttpRequest();
  xhr.timeout = 1000;
  var url = [this.keyserverOrigin_, this.keyserverApiVersion_, path].join('/');
  xhr.open('GET', url, true);

  ext.utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.GET_AUTH_TOKEN,
    content: this.pageLocation_
  }), goog.bind(function(response) {
    var result = response.content;
    xhr.setRequestHeader('X-Keyshop-Token', result);
      xhr.send();
  }, this));

  xhr.onreadystatechange = function() {
    var response;
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        response = /** @type {?messages.KeyserverKeyOutput} */
            (xhr.responseType === 'json' ? xhr.response :
             window.JSON.parse(xhr.responseText));
        console.log('got XHR response', response);
        callback(response);
      } else if (xhr.status === 404) {
        // We looked up keys for a user who has none.
        callback(null);
      } else {
        errback(xhr.status);
      }
    }
  };
};


/**
 * Executed when a keyserver request returns non-200/404 status.
 * @param {number} status The return code
 * @private
 */
ext.keyserver.Client.prototype.handleAuthFailure_ = function(status) {
  // redirect == YBY cookie not fresh, 401 == wrong YBY userid. treat them
  // the same for now.
  throw new ext.keyserver.AuthError('PLease login again');
};


/**
 * Fetches a key by userid from the keyserver.
 * @param {string} userid userid to look up. ex: yan@yahoo.com
 * @param {function(?messages.KeyserverKeyOutput)} callback
 * @private
 */
ext.keyserver.Client.prototype.fetchKey_ = function(userid, callback) {
  this.sendGetRequest_(userid, callback, this.handleAuthFailure_);
};


/**
 * Submits a key to a keyserver.
 * @param {string} userid the userid of the key
 * @param {!e2e.ByteArray} key OpenPGP key to send.
 * @param {function(messages.KeyserverSignedResponse)} callback Callback after
 *   sending key
 */
ext.keyserver.Client.prototype.sendKey = function(userid, key, callback) {
  // Check which device IDs already exist for this user
  this.fetchKey_(userid, goog.bind(function(response) {
    var registeredDeviceIds = [];
    var deviceId;
    var path;
    if (response && response.keys) {
      response = /** @type {messages.KeyserverKeyOutput} */ (response);
      try {
        var keys = response.keys;
        // No point in validating the response, since attacker can at most
        // prevent user from registering certain device IDs.
        registeredDeviceIds = goog.object.getKeys(keys);
      } catch (e) {}
    }
    if (registeredDeviceIds.length > 1000) {
      // Too many registered device IDs. Abort.
      throw new ext.keyserver.RequestError('Too many registered keys.');
    }
    do {
      deviceId = goog.math.randomInt(100000);
    } while (goog.array.contains(registeredDeviceIds, deviceId));
    path = [userid, deviceId.toString()].join('/');
    this.sendPostRequest_(path, callback,
        this.handleAuthFailure_, this.safeEncode_(key));
  }, this));
};


/**
 * Fetches keys and imports them into the keyring.
 * @param {!Array.<string>} userids the userids to look up
 * @param {function(Object.<string, boolean>)=} opt_cb callback to call when
 *   all imports are finished or determined to be impossible
 */
ext.keyserver.Client.prototype.fetchAndImportKeys = function(userids, opt_cb) {
  // Keep track of which uids were successfully fetched and imported
  var importedUids = /** @type {Object.<string, boolean>} */ ({});
  var allDone = false;

  var importCb = function(userid, response) {
    if (response && response.t && response.userid === userid) {
      response = /** @type {messages.KeyserverKeyOutput} */ (response);

      goog.object.forEach(response.keys, goog.bind(function(value, deviceid) {
        var resp = /** @type {messages.KeyserverSignedResponse} */ (value);

        if (this.verifyResponse_(resp)) {
          // Response is valid and correctly signed
          var keyData = /** @type {messages.KeyserverKeyInput} */
              (window.JSON.parse(resp.data));
          // Check that the response is fresh
          var now = window.Math.ceil((new Date().getTime())/1000);

          if (keyData.userid === userid &&
              now - keyData.t < this.maxFreshnessTime &&
              keyData.deviceid === deviceid) {
            // Import keys into the keyring
            console.log('importing key', keyData);
            this.importKeys_(keyData, goog.bind(function(result){
              importedUids[userid] = result;
              finished();
            }, this));

            // Save the server response for keyring pruning
            this.cacheKeyData_(resp);
          } else {
            // Response was mismatched or not fresh
            importedUids[userid] = false;
            finished();
          }
        } else {
          // Response was not signed correctly
          importedUids[userid] = false;
          finished();
        }
      }, this));
    } else {
      // Response was a 404 or malformed
      importedUids[userid] = false;
      finished();
    }
  };

  var finished = function() {
    // If all uids have processed, call the callback
    if (opt_cb && !allDone &&
        goog.object.getCount(importedUids) === userids.length) {
      opt_cb(importedUids);
      allDone = true;
    }
  };

  goog.array.forEach(userids, goog.bind(function(userid) {
    this.fetchKey_(userid, goog.bind(importCb, this, userid));
  }, this));
};


/**
 * Extract keys from keydata and import them into the keyring.
 * @param {messages.KeyserverKeyInput} keyData Key data to use for importing.
 * @param {!function(boolean)} cb Callback with the result of the import
 * @private
 */
ext.keyserver.Client.prototype.importKeys_ = function(keyData, cb) {
  var key = this.safeDecode_(keyData.key);
  ext.utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.IMPORT_KEY,
    content: key
  }), goog.bind(function(response) {
    var result = response.content;
    if (result && result.length && result.length > 0) {
      cb(true);
    } else {
      cb(false);
    }
  }, this));
};



/**
 * Does RFC4648 URL safe base64 encoding.
 * @param {!e2e.ByteArray} bytes
 * @return {string}
 * @private
 */
ext.keyserver.Client.prototype.safeEncode_ = function(bytes) {
  return goog.crypt.base64.encodeByteArray(bytes, true).replace(/\./g, '=');
};


/**
 * Does RFC4648 URL safe base64 decoding.
 * @param {string} str
 * @return {!e2e.ByteArray}
 * @private
 */
ext.keyserver.Client.prototype.safeDecode_ = function(str) {
  return goog.crypt.base64.decodeStringToByteArray(str.replace(/=/g, '.'),
                                                   true);
};


/**
 * Saves keydata entry to local storage.
 * @param {messages.KeyserverSignedResponse} response Response to cache.
 * @private
 */
ext.keyserver.Client.prototype.cacheKeyData_ = function(response) {
};


/**
 * Validates a response from the keyserver is correctly signed.
 * @param {messages.KeyserverSignedResponse} response Response from keyserver.
 * @private
 */
ext.keyserver.Client.prototype.verifyResponse_ = function(response) {
  var data = response.data;
  var sig = this.safeDecode_(response.kauth_sig);
  if (sig.length != 96) {
    return false;
  }
  // sig uses ECDSA with NIST384p and SHA384
  var ecdsa = new e2e.ecc.Ecdsa(
      e2e.ecc.PrimeCurve.P_384,
      {pubKey: e2e.ext.constants.Keyserver.KAUTH_PUB});

  return ecdsa.verify(data, {r: sig.slice(0, 48), s: sig.slice(48, 96)});
};


});  // goog.scope
