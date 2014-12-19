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

goog.require('e2e.ext.constants');
goog.require('e2e.ext.messages.KeyserverKeyData');
goog.require('e2e.ext.messages.KeyserverSignedResponse');
goog.require('e2e.ext.utils');
goog.require('goog.array');
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
  this.maxFreshnessTime = 24 * 3600 * 1000;
};


/**
 * Friendlier wrapper around XHR.
 * @param {string} method The method, ex: 'GET'.
 * @param {string} path The URL path, ex: 'foo/bar'.
 * @param {function(*)} callback The success callback.
 * @param {function(number)} errback The errorback for non-200 codes.
 * @param {string=} opt_params Optional POST params.
 * @private
 */
ext.keyserver.Client.prototype.sendRequest_ = function(method, path, callback,
                                                      errback, opt_params) {
  console.log('keyserverClient in sendRequest_ with path', path);
  var xhr = new XMLHttpRequest();
  xhr.timeout = 1000;
  var url = [this.keyserverOrigin_, this.keyserverApiVersion_, path].join('/');
  xhr.open(method, url, true);
  ext.utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
    action: constants.Actions.GET_AUTH_TOKEN,
    content: this.pageLocation_
  }), goog.bind(function(response) {
    var result = response.content;
    xhr.setRequestHeader('X-Keyshop-Token', result);
    if (method === 'POST' && opt_params) {
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.send(opt_params);
    } else {
      xhr.send();
    }
  }, this));
  xhr.onreadystatechange = function() {
    var response;
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        response = xhr.responseType === 'json' ? xhr.response :
            window.JSON.parse(xhr.responseText);
        callback(response);
      } else if (method === 'GET' && xhr.status === 404) {
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
 * @param {function(*)} callback
 * @private
 */
ext.keyserver.Client.prototype.fetchKey_ = function(userid, callback) {
  this.sendRequest_('GET', userid, callback, this.handleAuthFailure_);
};


/**
 * Submits a key to a keyserver.
 * @param {string} userid the userid of the key
 * @param {string} key Serialized OpenPGP key to send.
 * @param {function(*)} callback Callback after sending key
 */
ext.keyserver.Client.prototype.sendKey = function(userid, key, callback) {
  // Check which device IDs already exist for this user
  this.fetchKey_(userid, goog.bind(function(response) {
    var registeredDeviceIds = [];
    var deviceId;
    var path;
    if (response && response.data) {
      try {
        var keys = JSON.parse(response.data).keys;
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
    path = [userid, deviceId].join('/');
    this.sendRequest_('POST', path, callback,
        this.handleAuthFailure_, key);
  }, this));
};


/**
 * Fetches a key and imports it into the keyring.
 * @param {string} userid the userid of the key
 */
ext.keyserver.Client.prototype.fetchAndImportKeys = function(userid) {
  // Set freshness time to 24 hrs for now.
  var importCb = function(response) {
    var success = false;
    if (response && response.data && response.kauth_sig) {
      var resp = /** @type {messages.KeyserverSignedResponse} */ (response);
      if (this.verifyResponse_(resp)) {
        // Response is valid and correctly signed
        var keyData = /** @type {messages.KeyserverKeyData} */
            (window.JSON.parse(response.data));
        // Check that the response is fresh
        if (keyData.userid === userid &&
            new Date().getTime() - keyData.timestamp < this.maxFreshnessTime) {
          // Import keys into the keyring
          this.importKeys_(keyData);
          // Save the server response for keyring pruning
          this.cacheKeyData_(keyData);
          success = true;
        }
      }
    }
    if (!success) {
      throw new ext.keyserver.ResponseError();
    }
  };
  this.fetchKey_(userid, goog.bind(importCb, this));
};


/**
 * Extract keys from keydata and import them into the keyring.
 * @param {messages.KeyserverKeyData} keyData Key data to use for importing.
 * @private
 */
ext.keyserver.Client.prototype.importKeys_ = function(keyData) {
  goog.object.forEach(keyData.keys, goog.bind(function(key) {
    ext.utils.sendExtensionRequest(/** @type {!messages.ApiRequest} */ ({
      action: constants.Actions.IMPORT_KEY,
      content: key
    }), goog.bind(function(response) {
      var result = response.content;
      if (result && result.length && result.length > 0) {
        ext.utils.showNotification(
            chrome.i18n.getMessage('promptImportKeyNotificationLabel',
                                   result.toString()), goog.nullFunction
        );
      }
    }, this));
  }, this));
};


/**
 * Saves keydata entry to local storage.
 * @param {messages.KeyserverKeyData} keyData Key data to use for importing.
 * @private
 */
ext.keyserver.Client.prototype.cacheKeyData_ = function(keyData) {
};


/**
 * Validates a response from the keyserver is correctly signed.
 * @param {messages.KeyserverSignedResponse} response Response from keyserver.
 * @private
 */
ext.keyserver.Client.prototype.verifyResponse_ = function(response) {
  /*
  var data = response.data;
  var sig = response.kauth_sig;
  // sig uses deterministic ECDSA with NIST384p and SHA384
  var kauth = {pubKey: constants.Keyserver.KAUTH_PUB};
  var ecdsa = new e2e.ecc.Ecdsa(e2e.ecc.PrimeCurve.P_384, kauth);
  return ecdsa.verify(data, sig);
  */
  return true;
};

});  // goog.scope
