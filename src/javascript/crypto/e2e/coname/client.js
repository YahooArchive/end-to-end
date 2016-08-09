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
 * @fileoverview coname client.
 */

goog.provide('e2e.coname.Client');

goog.require('e2e');
goog.require('e2e.async.Result');
goog.require('e2e.coname');
goog.require('e2e.coname.ProtoBuf');
goog.require('e2e.coname.sha3');
goog.require('e2e.coname.verifyLookup');
goog.require('e2e.ext.config');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.Error');
goog.require('e2e.random');
goog.require('goog.array');
goog.require('goog.crypt.base64');
goog.require('goog.net.ErrorCode');
goog.require('goog.net.XhrIo');



/**
 * Constructor for the coname client.
 * @param {string=} opt_keyName The key name of the keyData Map
 * @constructor
 */
e2e.coname.Client = function(opt_keyName) {
  /**
   * The key name being referenced in the key data blob
   * @type {string}
   * @private
   */
  this.keyName_ = opt_keyName || 'pgp';

  /**
   * @type {Object<string, e2e.async.Result>}
   * @private
   */
  this.authResults_ = {};
};


/** @const {!string} */
e2e.coname.Client.PROTO_FILE_PATH = 'coname-client.proto.json';


/**
 * The lookup request timeout in ms
 * @const {!number}
 */
e2e.coname.Client.LOOKUP_REQUEST_TIMEOUT = 30000;


/**
 * The update request timeout in ms
 * @const {!number}
 */
e2e.coname.Client.UPDATE_REQUEST_TIMEOUT = 60000;


/**
 * The initialized protobuf object
 * @type {Object<string,*>}
 * @private
 */
e2e.coname.Client.protoBuf_;


/**
 * Initializes the external protobuf dependency.
 * @return {!e2e.async.Result.<undefined>} The deferred Coname protocol
 */
e2e.coname.Client.initialize = function() {

  if (goog.isDef(e2e.coname.Client.protoBuf_)) {
    return e2e.async.Result.toResult(undefined);
  }

  var result = new e2e.async.Result;

  new e2e.coname.ProtoBuf().initialize().addCallbacks(function(ProtoBuf) {

    ProtoBuf.loadJsonFile(
        chrome.runtime.getURL(e2e.coname.Client.PROTO_FILE_PATH),
        function(err, builder) {
          if (err) {
            result.errback(err);
            return;
          }
          e2e.coname.Client.protoBuf_ = builder.build('proto');
          result.callback(undefined);
        });
  }, result.errback, result);

  return result;
};


/**
 * Parse, decode, and transform a lookup response
 * @param {string} jsonString The lookup message to decode
 * @return {e2e.coname.ServerResponse} The lookup response
 * @private
 */
e2e.coname.Client.decodeLookupMessage_ = function(jsonString) {
  var proto = e2e.coname.Client.protoBuf_;
  var lookupProof = JSON.parse(jsonString);
  var b64decode = goog.crypt.base64.decodeStringToByteArray;
  var profile, entry, tree = lookupProof.tree_proof;

  // a lot of convertions before they can be verified
  // TODO: except the use of encodeAB(), may be better to move them to server
  lookupProof.index = b64decode(lookupProof.index);
  lookupProof.index_proof = b64decode(lookupProof.index_proof);

  tree.neighbors = tree.neighbors ?
      goog.array.map(tree.neighbors, function(n) {return b64decode(n)}) :
      [];
  if (tree.existing_index) {
    tree.existing_index = b64decode(tree.existing_index);
  }
  if (tree.existing_entry_hash) {
    tree.existing_entry_hash = b64decode(tree.existing_entry_hash);
  }

  goog.array.forEach(lookupProof.ratifications, function(r) {
    var id, encoding = b64decode(r.head), rHH;

    r.head = proto['TimestampedEpochHead'].decode(encoding);
    rHH = r.head.head;
    rHH.encoding = new Uint8Array(rHH.encodeAB());
    rHH.previous_summary_hash = new Uint8Array(
        rHH.previous_summary_hash.toBuffer());
    rHH.root_hash = new Uint8Array(rHH.root_hash.toBuffer());
    // drop nanos; seconds can be well represented by Number (max 2^53-1)
    rHH.issue_time = rHH.issue_time.seconds.toNumber();
    r.head.encoding = encoding;

    for (id in r.signatures) {
      r.signatures[id] = b64decode(r.signatures[id]);
    }
  });

  if (lookupProof.entry) {
    entry = b64decode(lookupProof.entry);
    lookupProof.entry = proto['Entry'].decode(entry);
    lookupProof.entry.profile_commitment = new Uint8Array(
        lookupProof.entry.profile_commitment.toBuffer());
    lookupProof.entry.encoding = entry;
  }

  if (lookupProof.profile) {
    profile = b64decode(lookupProof.profile);
    lookupProof.profile = proto['Profile'].decode(profile);
    lookupProof.profile.encoding = profile;
  }

  return /** @type {e2e.coname.ServerResponse} */ (lookupProof);
};


/**
 * Encode the update request message
 * @param {string} email The email address
 * @param {?e2e.ByteArray} key OpenPGP key to send
 * @param {e2e.coname.RealmConfig} realm The RealmConfig
 * @param {e2e.coname.ServerResponse} oldProof The lookup proof just obtained
 * @param {string} keyName The key name being referenced in the key data blob
 * @return {Object<string,*>} The update message
 * @private
 */
e2e.coname.Client.encodeUpdateRequest_ = function(
    email, key, realm, oldProof, keyName) {
  var proto = e2e.coname.Client.protoBuf_;
  var keys = {}, hProfile, profile, entry;

  // if a current profile exists
  if (oldProof.profile) {
    // clone the old key set
    keys = proto['Profile'].decode(oldProof.profile.encoding).keys;
    // update only the pgp key
    key === null ?
        keys.delete(keyName) :
        keys.set(keyName, goog.crypt.base64.encodeByteArray(key));
  } else if (key !== null) {
    keys[keyName] = new Uint8Array(key);
  }

  profile = proto['Profile'].encode({
    nonce: new Uint8Array(e2e.random.getRandomBytes(16)),
    keys: keys
  });

  hProfile = new Uint8Array(
      e2e.coname.sha3.shake256(64).update(
      new Uint8Array(profile.toBuffer())).digest());

  // if a current entry exists
  if (oldProof.entry) {
    entry = proto.Entry.decode(oldProof.entry.encoding); // clone
    entry.version = goog.isDefAndNotNull(entry.version) ?
        entry.version.add(1) : 1;
    entry.profile_commitment = hProfile;
  } else {
    entry = proto.Entry.encode({
      index: new Uint8Array(oldProof.index),
      version: 0, // version starts at 0 at registration
      // TODO: support other update_policy
      update_policy: {quorum: {}},
      profile_commitment: hProfile
    });
  }

  return {
    update: {
      new_entry: entry.toBase64(),
      signatures: {}
    },
    profile: profile.toBase64(),
    lookup_parameters: {
      user_id: email,
      quorum_requirement: realm.verification_policy.quorum
    }
    // email_proof to be completed by req_ based on type in realm.auth
  };

};


/**
 * Send a request over AJAX
 * @param {!e2e.coname.RealmConfig} realm The RealmConfig
 * @param {string} method The HTTP method to use, such as "GET", "POST", "PUT",
 *     "DELETE", etc. Ignored for non-HTTP(S) URLs
 * @param {string} relUrl The URL relative to realm.addr
 * @param {number} timeout The number of milliseconds a request can take before
 *     automatically being terminated. A value of 0 (which is the default)
 *     means there is no timeout.
 * @param {Object=} opt_data The data to be JSON stringified and sent as the
 *     HTTP request body
 * @return {e2e.async.Result.<string>} The raw response text iff the server
 *                                          responds 200 OK
 * @private
 */
e2e.coname.Client.prototype.req_ = function(
    realm, method, relUrl, timeout, opt_data) {
  var dataString;
  if (opt_data) {
    try {
      dataString = JSON.stringify(opt_data);
    } catch (e) {
      return e2e.async.Result.toError(e);
    }
  } else {
    opt_data = {};
  }

  if (relUrl === '/update' && !goog.isDef(opt_data.email_proof)) {
    switch (realm.auth.type) {
      case e2e.ext.config.CONAME.RealmAuthType.SAML:
        var tokenResult = goog.isDef(realm.auth.token) ?
            e2e.async.Result.toResult(realm.auth.token) :
            this.auth_(realm);

        return tokenResult.addCallback(function(token) {
          opt_data.email_proof = {saml_response: token};
          return this.req_(realm, method, relUrl, timeout, opt_data);
        }, this);
      case e2e.ext.config.CONAME.RealmAuthType.OPENID:
        var tokenResult = goog.isDef(realm.auth.token) ?
            e2e.async.Result.toResult(realm.auth.token) :
            this.auth_(realm);

        return tokenResult.addCallback(function(token) {
          opt_data.email_proof = {oidc_token: token};
          return this.req_(realm, method, relUrl, timeout, opt_data);
        }, this);
    }
  }

  var result = new e2e.async.Result;
  var url = realm.addr + relUrl + '?' + e2e.ext.utils.getUAString();
  goog.net.XhrIo.send(url, goog.bind(function(e) {
    var xhr = e.target, statusCode = xhr.getStatus();
    if (xhr.getLastErrorCode() === goog.net.ErrorCode.NO_ERROR) {
      result.callback(xhr.getResponseText());
    } else if (statusCode === 401) {
      // re-authenticate whenever 401 is encountered
      this.auth_(realm).
          addCallback(goog.bind(
              this.req_, this, realm, method, relUrl, timeout, opt_data)).
          addCallbacks(result.callback, result.errback, result).
          addErrback(function(err) {
            return new e2e.ext.utils.Error(err.message, 'conameAuthError');
          });
    } else {
      result.errback(new e2e.ext.utils.Error(
          'Error connecting to keyserver. ' + xhr.getLastError(),
          'conameConnectionError'));
    }
  }, this), method, dataString, {}, timeout);
  return result;
};


/**
 * Upon HTTP error 401, prompt the user for authentication to the keyserver.
 * Invokes the callback when the user has successfully authenticated.
 * @param {!e2e.coname.RealmConfig} realm The RealmConfig
 * @return {!e2e.async.Result<?Object<string, Array<string>>>|
 *     !e2e.async.Result<string>} The authentication token for SAML auth type,
 *     or otherwise the parsed form data, as specified in
 *     https://developer.chrome.com/extensions/webRequest#event-onBeforeRequest
 * @private
 */
e2e.coname.Client.prototype.auth_ = function(realm) {
  var authUrl = realm.addr + realm.auth.startRelUrl,
      destUrl = realm.addr + realm.auth.endRelUrl;

  // cache the returned authentication token
  switch (realm.auth.type) {
    case e2e.ext.config.CONAME.RealmAuthType.SAML:
      return this.createAuthWindow_(authUrl, destUrl).
          addCallback(function(req) {
            return (realm.auth.token =
                req.formData['SAMLResponse'][0].toString());
          });
    case e2e.ext.config.CONAME.RealmAuthType.OPENID:
      return this.createAuthWindow_(
          authUrl + '?domain=' + encodeURIComponent(realm.domain), destUrl).
          addCallback(function(req) {
            // anything after #id_token= will be used as the token
            return (realm.auth.token = req.url.split('#id_token=')[1]);
          });
  }
  throw Error('Unsupported authentication type');
};


/**
 * Upon HTTP error 401, prompt the user for authentication to the keyserver.
 * Invokes the callback when the user has successfully authenticated.
 * @param {!string} authUrl The URL for authentication.
 * @param {!string} destUrl The URL when the user is authenticated.
 * @return {!e2e.async.Result<{url: string,
 *     formData:?Object<string, Array<string>>}>} The url and parsed form data,
 *     as specified in https://developer.chrome.com/extensions/webRequest
 *     #event-onBeforeRequest
 * @private
 */
e2e.coname.Client.prototype.createAuthWindow_ = function(authUrl, destUrl) {
  var authResults = this.authResults_,
      authResult = authResults[authUrl] ||
          (authResults[authUrl] = new e2e.async.Result);

  // create a window to negotiate a new session or let user enters credentials
  chrome.windows.create({
    url: authUrl,
    width: 500,
    height: 640,
    type: 'popup'
  }, function(win) {
    var winId = win.id;

    // close the window, remove the listener, and callback with parsed reqBody
    var onDestination = function(details) {
      chrome.webRequest.onBeforeRequest.removeListener(onDestination);
      // close the window
      chrome.windows.remove(winId);

      details.error ?
          authResult.errback(new Error(details.error)) :
          authResult.callback({
            url: details.url,
            formData: details.requestBody &&
                details.requestBody.formData || null
          });

      delete authResults[authUrl];
      // cancel the request
      return {cancel: true};
    };

    chrome.webRequest.onBeforeRequest.addListener(
        onDestination,
        /** @type {!RequestFilter} */ ({urls: [destUrl], windowId: winId}),
        ['blocking', 'requestBody']);

  });

  return authResult;
};


/**
 * Lookup and validate public keys for an email address
 * @param {string} email The email address to look up a public key
 * @param {boolean=} opt_skipVerify whether skip the verify step
 * @return {!e2e.async.Result.<?e2e.coname.KeyData>} The result if there has a
 *    key associated with the email, and it is validated. The result is null
 *    when no realms. The key in KeyData is null if verified for having no key.
 */
e2e.coname.Client.prototype.lookup = function(email, opt_skipVerify) {
  // normalize the email address, and then get realm
  var realm = e2e.coname.getRealmByEmail((email = email.toLowerCase()));

  // no realm, no keys
  if (realm === null) {
    return e2e.async.Result.toResult(
        /** @type {?e2e.coname.KeyData} */ (null));
  }

  // TODO: make this possible for polling/retries
  return this.req_(/** @type {!e2e.coname.RealmConfig} */ (realm),
      'POST', '/lookup', e2e.coname.Client.LOOKUP_REQUEST_TIMEOUT, {
        user_id: email,
        quorum_requirement: realm.verification_policy.quorum
      }).
      addCallback(function(responseText) {
        var pf = e2e.coname.Client.decodeLookupMessage_(responseText),
            profile = pf['profile'],
            keyByteArray;

        !opt_skipVerify && e2e.coname.verifyLookup(
            /** @type {!e2e.coname.RealmConfig} */ (realm), email, pf);

        keyByteArray = profile && profile.keys &&
            profile.keys.has(this.keyName_) ?
                /** @type {e2e.ByteArray} */ (
                Array.prototype.slice.call(new Uint8Array(
                    profile.keys.get(this.keyName_).toBuffer()))) :
                null;

        return /** @type {!e2e.coname.KeyData} */ ({
          keyData: keyByteArray,
          proof: pf
        });
      }, this);
};


/**
 * Update or add public keys for an email address
 * @param {!string} email The email address
 * @param {?e2e.ByteArray} keyData The key blob to upload. Use null to remove
 *     the specific key field.
 * @return {!e2e.async.Result.<?e2e.coname.KeyData>} The result if there has a
 *    key associated with the email, and it is validated. The result is null
 *    when no realms. The key in KeyData is null if verified for having no key.
 */
e2e.coname.Client.prototype.update = function(email, keyData) {
  // normalize the email address, and then get realm
  var realm = e2e.coname.getRealmByEmail((email = email.toLowerCase()));
  var newProfileBase64;

  // no realm, no keys
  if (realm === null) {
    return e2e.async.Result.toResult(
        /** @type {?e2e.coname.KeyData} */ (null));
  }

  // TODO: save persistently the key in case update fails in the mid way
  return this.lookup(email, true).
      addCallback(function(lookupResult) {
        // lookupResult must not be null, as the case of which has handled

        var data = e2e.coname.Client.encodeUpdateRequest_(email, keyData,
            /** @type {!e2e.coname.RealmConfig} */ (realm),
            /** @type {{proof: !e2e.coname.ServerResponse}} */ (
                lookupResult).proof,
            this.keyName_);

        newProfileBase64 = data.profile;

        // set 1m timeout
        return this.req_(/** @type {!e2e.coname.RealmConfig} */ (realm),
            'POST', '/update', e2e.coname.Client.UPDATE_REQUEST_TIMEOUT, data);
      }, this).
      addCallback(function(responseText) {
        var pf = e2e.coname.Client.decodeLookupMessage_(responseText),
            profile = pf.profile,
            keyByteArray;

        if (newProfileBase64 !== profile.toBase64()) {
          throw new Error('server rejected the new profile/key');
        }
        if (!e2e.coname.verifyLookup(
            /** @type {!e2e.coname.RealmConfig} */ (realm), email, pf)) {
          // TODO: poll the server until the update can be verified
          throw new Error('the keys cannot be validated');
        }

        keyByteArray = profile && profile.keys &&
            profile.keys.has(this.keyName_) ?
                /** @type {e2e.ByteArray} */ (
                Array.prototype.slice.call(new Uint8Array(profile.keys.get(
                    this.keyName_).toBuffer()))) :
                null;

        return {keyData: keyByteArray, proof: pf};

      }, this);
};
