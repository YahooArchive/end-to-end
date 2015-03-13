/**
 * @license
 * Copyright 2015 Yahoo Inc. All rights reserved.
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
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.Keyserver');
goog.require('e2e.ext.constants.StorageKey');
goog.require('e2e.ext.messages.KeyserverKeyInput');
goog.require('e2e.ext.messages.KeyserverKeyOutput');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.random');
goog.require('goog.array');
goog.require('goog.crypt');
goog.require('goog.crypt.base64');
goog.require('goog.debug.Error');
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
 * Error indicating authentication needed for a request.
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
 * @param {function(string)} callback The success
 *   callback.
 * @param {function()} errback The errorback for non-200 codes.
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
    var result = response.content || '';
    if (!result && constants.Keyserver.AUTH_ENABLED) {
      errback();
      return;
    }
    xhr.setRequestHeader('X-Keyshop-Token', result);
    xhr.setRequestHeader('Content-Type', 'text/plain');
    xhr.send(opt_params);
  }, this));

  xhr.onreadystatechange = function() {
    var response;
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        response = /** @type {string} */ (xhr.responseText);
        callback(response);
      } else {
        errback();
      }
    }
  };
};


/**
 * Friendlier wrapper around XHR GET.
 * @param {string} path The URL path, ex: 'foo/bar'.
 * @param {function(?messages.KeyserverKeyOutput)} callback
 *   The success callback.
 * @param {function(*)} errback The errorback for non-200 codes.
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
    var result = response.content || '';
    xhr.setRequestHeader('X-Keyshop-Token', result);
    xhr.send();
  }, this));
  xhr.onreadystatechange = goog.bind(function() {
    var response;
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        response = /** @type {messages.KeyserverKeyOutput} */ (
            this.verifyResponse_(xhr.responseText));
        callback(response);
      } else if (xhr.status === 404) {
        // We looked up keys for a user not supported by the keyserver.
        callback(null);
      } else {
        errback(JSON.stringify({path: path, status: xhr.status}));
      }
    }
  }, this);
};


/**
 * Fetches a key by userid from the keyserver.
 * @param {string} userid userid to look up. ex: yan@yahoo.com
 * @param {function(?messages.KeyserverKeyOutput)} callback
 * @param {function(*)} errback
 * @private
 */
ext.keyserver.Client.prototype.fetchKey_ = function(userid, callback, errback) {
  this.sendGetRequest_(userid, callback, errback);
};


/**
 * Submits a key to a keyserver and validates the response.
 * @param {string} userid the userid of the key
 * @param {!e2e.ByteArray} key OpenPGP key to send.
 * @param {function(string)} callback
 * @param {function(Error)} errback
 */
ext.keyserver.Client.prototype.sendKey = function(userid, key, callback,
                                                  errback) {
  if (!window.localStorage.getItem('deviceId')) {
    // If this is the first time sending a key, generate a unique deviceId.
    window.localStorage.setItem('deviceId',
        this.safeEncode_(e2e.random.getRandomBytes(15)));
  }
  var deviceId = window.localStorage.getItem('deviceId');

  var path = [userid, deviceId].join('/');
  this.sendPostRequest_(
      path,
      goog.bind(function(response) {
        var verified;
        try {
          verified = this.verifyResponse_(response);
        } catch (e) {
          errback(e);
          return;
        }
        if (verified) {
          console.log('verified your response');
          callback(response);
          this.cacheKeyData(response);
        } else {
          console.log('did not verify your response');
          errback(new ext.keyserver.ResponseError(chrome.i18n.getMessage(
              'keyserverResponseError')));
        }
      }, this),
      goog.partial(errback, new ext.keyserver.AuthError(
          chrome.i18n.getMessage('keyserverSendError'))),
      this.safeEncode_(key)
  );
};


/**
 * Fetches keys and imports them into the keyring.
 * @param {!Array.<string>} userids the userids to look up
 * @param {function(Object.<string, boolean>)} cb callback to call when
 *   all imports are finished or determined to be impossible
 * @param {function(*)=} opt_errback Optional error callback.
 */
ext.keyserver.Client.prototype.fetchAndImportKeys = function(userids, cb,
                                                             opt_errback) {
  // Keep track of which uids were successfully fetched and imported
  var importedUids = /** @type {Object.<string, boolean>} */ ({});
  var allDone = false;
  var errback = opt_errback || goog.nullFunction;

  // Called when the userid's keys have been fetched
  var importCb = function(userid, response) {
    if (response && response.t && response.userid === userid && response.keys) {
      response = /** @type {messages.KeyserverKeyOutput} */ (response);

      goog.object.forEach(response.keys, goog.bind(function(value, deviceid) {
        var keyData = /** @type {?messages.KeyserverKeyInput} */ (
            this.verifyResponse_(value));

        // TODO(dlg): re-enable freshness check once we have do mandatory
        // rotation
        // var now = window.Math.ceil((new Date().getTime()) / 1000);
        // TODO(dlg): better logging (integrate with event log)
        if (keyData && keyData.userid === userid &&
            keyData.deviceid === deviceid) {
          // Import keys into the keyring
          console.log('importing key', keyData);
          this.importKeys_(keyData, goog.bind(function(result) {
            importedUids[userid] = result;
            finished();
          }, this));

          // Save the server response for keyring pruning
          this.cacheKeyData(value);
        } else {
          // Response was incorrectly signed, mismatched or not fresh
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
    if (!allDone &&
        goog.object.getCount(importedUids) === userids.length) {
      cb(importedUids);
      allDone = true;
    }
  };

  goog.array.forEach(userids, goog.bind(function(userid) {
    this.fetchKey_(userid, goog.bind(importCb, this, userid), errback);
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
 * Does RFC4648 URL-safe base64 encoding.
 * @param {!e2e.ByteArray} bytes
 * @return {string}
 * @private
 */
ext.keyserver.Client.prototype.safeEncode_ = function(bytes) {
  return goog.crypt.base64.encodeByteArray(bytes, true).replace(/\./g, '=');
};


/**
 * Does RFC4648 URL-safe base64 decoding.
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
 * @param {string} response Response to cache.
 */
ext.keyserver.Client.prototype.cacheKeyData = function(response) {
  var responses = JSON.parse(window.localStorage.getItem(
      constants.StorageKey.KEYSERVER_SIGNED_RESPONSES) || '[]') || [];
  responses.push(response);
  window.localStorage.setItem(
      constants.StorageKey.KEYSERVER_SIGNED_RESPONSES,
      JSON.stringify(responses));
};


/**
 * Validates a response from the keyserver is correctly signed.
 * @param {string} response Response from keyserver.
 * @return {?(messages.KeyserverKeyInput|messages.KeyserverKeyOutput)}
 * @private
 */
ext.keyserver.Client.prototype.verifyResponse_ = function(response) {
  var ecdsa = new e2e.ecc.Ecdsa(
      e2e.ecc.PrimeCurve.P_256,
      {pubKey: e2e.ext.constants.Keyserver.KAUTH_PUB});
  var verified = ecdsa.verifyJws(response);
  return verified ?
      /** @type {?(messages.KeyserverKeyInput|messages.KeyserverKeyOutput)} */ (
          JSON.parse(goog.crypt.byteArrayToString(verified))) :
      null;
};


/**
 * Refreshes keys in the keyring from the keyserver. Does not delete old keys.
 * @param {function(Object.<string, boolean>)} cb callback to call when
 *   all imports are finished or determined to be impossible
 */
ext.keyserver.Client.prototype.refreshKeyring = function(cb) {
  // Refresh the keyring.
  ext.utils.sendExtensionRequest(/** @type {messages.ApiRequest} */ ({
    action: constants.Actions.LIST_ALL_UIDS,
    content: 'public'
  }), goog.bind(function(response) {
    response.content = response.content || [];

    // Convert UIDs to emails since the keyserver and ymail use emails
    var emails = ext.utils.text.getValidEmailAddressesFromArray(
        response.content, true);
    goog.array.removeDuplicates(emails);

    this.fetchAndImportKeys(emails, cb, function(status) {
      console.warn('Error refreshing keys', status);
    });
  }, this));
};

});  // goog.scope
