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
 * @fileoverview This almost implmented the interface as defined in
 *     {@link e2e.openpgp.providers.PublicKeyProvider}, but is slightly
 *     modified to (e.g., return transferablekeys instead) to fit the needs of
 *     yContextImpl.
 */

goog.provide('e2e.coname.CachedKeyProvider');

goog.require('e2e.coname');
goog.require('e2e.coname.Client');
goog.require('e2e.coname.KeyProvider');
goog.require('goog.array');
goog.require('goog.async.Deferred');
goog.require('goog.structs.Map');



/**
 * Constructor for the coname cached key provider.
 * @param {number=} opt_timeToLive The time in ms when cache will be expired.
 *     The default is 3 minutes
 * @extends {e2e.coname.KeyProvider}
 * @constructor
 */
e2e.coname.CachedKeyProvider = function(opt_timeToLive) {
  goog.base(this);

  /**
   * @type {!number}
   * @private
   */
  this.timeToLive_ = goog.isNumber(opt_timeToLive) ? opt_timeToLive : 180000;

  /**
   * Map email to keys
   * @type {goog.structs.Map.<string,
   *   !goog.async.Deferred.<!Array.<!e2e.openpgp.block.TransferableKey>>>}
   * @private
   */
  this.emailKeysMap_ = new goog.structs.Map();

  /**
   * Map keyId to the deferred email
   * @type {goog.structs.Map.<e2e.openpgp.KeyId,
   *   !goog.async.Deferred.<!Array.<!e2e.openpgp.block.TransferableKey>>>}
   * @private
   */
  this.keyIdKeysMap_ = new goog.structs.Map();
};
goog.inherits(e2e.coname.CachedKeyProvider, e2e.coname.KeyProvider);


/**
 * @param {!e2e.openpgp.KeyId} keyId
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} keys The public keys
 * @param {number=} opt_timeToLive The time in ms when the cache will expire.
 * @private
 */
e2e.coname.CachedKeyProvider.prototype.cacheKeyIdToKeys_ = function(
    keyId, keys, opt_timeToLive) {
  var cache = this.keyIdKeysMap_, result = cache.get(keyId);
  if (!result) {
    cache.set(keyId, goog.async.Deferred.succeed(keys));
  } else if (!result.hasFired()) {
    result.callback(keys);
  }

  setTimeout(goog.bind(cache.remove, cache, keyId),
      goog.isNumber(opt_timeToLive) ? opt_timeToLive : this.timeToLive_);
};


/**
 * Iterate every keypacket in keys, and callback with keyId and key
 * @param {!Array.<!e2e.openpgp.block.TransferableKey>} keys
 * @param {!function(!e2e.openpgp.KeyId,
 *     !Array.<!e2e.openpgp.block.TransferableKey>)} callback
 * @private
 */
e2e.coname.CachedKeyProvider.prototype.iterateKeyId_ = function(
    keys, callback) {
  goog.array.forEach(keys, function(key) {
    var keyPackets = key.subKeys ?
        key.subKeys.concat(key.keyPacket) :
        [key.keyPacket];
    goog.array.forEach(keyPackets, function(kp) {
      callback(kp.keyId, [key]);
    });
  });
};


/**
 * Clone the deferred result
 * @param {!goog.async.Deferred} result
 * @return {!goog.async.Deferred}
 * @private
 */
e2e.coname.CachedKeyProvider.prototype.cloneResult_ = function(result) {
  var newResult = new goog.async.Deferred;
  result.addCallbacks(newResult.callback, newResult.errback, newResult);
  return newResult;
};


/** @override */
e2e.coname.CachedKeyProvider.prototype.importKeys = function(keys, opt_uid) {
  return goog.base(this, 'importKeys', keys, opt_uid).
      addCallback(function() {
        // TODO: better to remove only those affected
        this.emailKeysMap_.clear();
        this.keyIdKeysMap_.clear();
      });
};


/** @override */
e2e.coname.CachedKeyProvider.prototype.getTrustedPublicKeysByEmail = function(
    email) {
  // normalize the email, and check if it's coname-supported
  var email_ = e2e.coname.getSupportedEmailByUid(email);
  // okay to bypass cache, as there're no network calls anyway
  if (email_ === null) {
    return goog.async.Deferred.succeed([]);
  }
  email = /** @type {!string} */ (email_);

  // return the cachedResult, if any
  var cache = this.emailKeysMap_, cachedResult = cache.get(email);
  if (cachedResult) {
    return this.cloneResult_(cachedResult);
  }

  // otherwise, do the actual lookup, and cache the keys and email mapping
  var result = goog.base(this, 'getTrustedPublicKeysByEmail', email).
      addCallbacks(function(keys) {
        // expire the cache after this.timeToLive_
        setTimeout(goog.bind(cache.remove, cache, email), this.timeToLive_);
        // build and answer the mapping of keyId to keys
        this.iterateKeyId_(keys, goog.bind(this.cacheKeyIdToKeys_, this));
      }, function(err) {
        // do not cache error results
        cache.remove(email);
      }, this);

  // subsequent lookup will depend on this cachedResult
  cache.set(email, result);

  return this.cloneResult_(result);
};


/**
 * Returns public keys that have a key packet with a given OpenPGP key ID.
 * Used for signature verification purposes only.
 * TODO: CONAME needs support to lookup using keyid
 *
 * @see https://tools.ietf.org/html/rfc4880#section-5.1
 * @param {!e2e.openpgp.KeyId} keyId The key ID.
 * @return {!goog.async.Deferred.<!Array.<!e2e.openpgp.block.TransferableKey>>}
 *     The resulting trusted keys that are once looked up using
 *     {#getTrustedPublicKeysByEmail}.
 * @override
 */
e2e.coname.CachedKeyProvider.prototype.getVerificationKeysByKeyId = function(
    keyId) {
  // return the cachedResult, if any
  var cachedResult = this.keyIdKeysMap_.get(keyId);
  if (cachedResult) {
    return this.cloneResult_(cachedResult);
  }

  // otherwise, wait, as getTrustedPublicKeysByEmail might answer shortly
  var result = new goog.async.Deferred;
  this.keyIdKeysMap_.set(keyId, result);

  // in case no answer after lookup request timeout
  // emulate a response of having no keys to trigger callbacks
  setTimeout(goog.bind(function() {
    if (!result.hasFired()) {
      this.cacheKeyIdToKeys_(keyId, [], 0); // 0ms means not to cache
    }
  }, this), e2e.coname.Client.LOOKUP_REQUEST_TIMEOUT);

  return this.cloneResult_(result);
};
