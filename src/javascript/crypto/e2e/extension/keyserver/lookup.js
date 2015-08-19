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
 * @fileoverview V2 keyserver lookups.
 */

goog.provide('e2e.ext.keyserverV2');
goog.provide('e2e.ext.keyserverV2.Client');

goog.require('e2e.ecc.Ed25519');
goog.require('e2e.ecc.PrimeCurve');
goog.require('goog.array');
goog.require('goog.crypt');
goog.require('goog.net.jsloader');
goog.require('goog.object');


goog.scope(function() {
var ext = e2e.ext;
var keyserver = e2e.ext.keyserverV2;


/**
 * @private {number}
 * @const
 */
keyserver.PAD_TO_ = 4 << 10;


/**
 * Maximum validity period for user profiles, in seconds.
 * @type {number}
 * @const
 */
keyserver.MAX_VALIDITY_PERIOD = 60 * 60 * 24 * 365;  // seconds


/**
 * Constructor for the lookup client.
 * @param {number} freshnessThreshold The client's allowed freshness threshold
 *     in nanoseconds.
 * @param {number} freshnessSignaturesRequired The number of signatures needed
 *     to satisfy the freshness requirement.
 * @param {number} consensusSignaturesRequired The number of signatures needed
 *     to satisfy the consensus requirement.
 * @constructor
 */
keyserver.Client = function(freshnessThreshold,
                            freshnessSignaturesRequired,
                            consensusSignaturesRequired) {
  /**
   * Freshness threshold in nanoseconds.
   * @private {number}
   */
  this.freshnessThreshold_ = freshnessThreshold;

  /**
   * @private {number}
   */
  this.freshnessSignaturesRequired_ = freshnessSignaturesRequired;

  /**
   * @private {number}
   */
  this.consensusSignaturesRequired_ = consensusSignaturesRequired;

  /**
   * @type {dcodeIO.ProtoBuf.Builder}
   */
  this.builder = null;

  /**
   * @type {?{LookupRequest: Function}}
   */
  this.proto = null;

  /**
   * @private {boolean}
   */
  this.initialized_ = false;
};


/**
 * Initializes the external protobuf dependency.
 * @param {function()} callback The function to call when protobuf is loaded.
 * @param {function()} errback The error callback.
 */
keyserver.Client.prototype.initialize = function(callback, errback) {
  var pbURL = chrome.runtime.getURL('ProtoBuf.js');
  var bbURL = chrome.runtime.getURL('ByteBufferAB.js');
  var longURL = chrome.runtime.getURL('Long.js');

  if (window.dcodeIO && window.dcodeIO.ByteBuffer && window.dcodeIO.ProtoBuf) {
    this.initialized_ = true;
    callback();
    return;
  }

  // XXX: jsloader has spurious timeout errors, so set it to 0 for no timeout.
  // Load Long.js for int64 support.
  goog.net.jsloader.load(longURL, {timeout: 0}).addCallback(function() {
    if (window.dcodeIO && window.dcodeIO.Long) {
      // Load the ByteBuffer dependency for ProtoBuf
      goog.net.jsloader.load(bbURL, {timeout: 0}).addCallback(function() {
        if (window.dcodeIO && window.dcodeIO.ByteBuffer) {
          // Load ProtoBuf
          goog.net.jsloader.load(pbURL, {timeout: 0}).addCallback(function() {
            if (window.dcodeIO && window.dcodeIO.ProtoBuf) {
              // Success
              this.initialized_ = true;
              this.loadBuilder_();
              callback();
            } else {
              return new Error('Missing protobuf!');
            }
          }, this).addErrback(errback, this);
        } else {
          return new Error('Missing bytebuffer!');
        }
      }, this).addErrback(errback, this);
    } else {
      return new Error('Missing long!');
    }
  }, this).addErrback(errback, this);
};


/**
 * Loads the proto builder.
 * @private
 */
keyserver.Client.prototype.loadBuilder_ = function() {
  var clientProtoURL = chrome.runtime.getURL('proto/client.proto');
  this.builder = window.dcodeIO.ProtoBuf.loadProtoFile(clientProtoURL);
  this.proto = this.builder.build('proto');
};


/**
 * Builds and encodes a lookup request.
 * @param {string} userid The email to look up.
 * @return {ArrayBuffer}
 */
keyserver.Client.prototype.encodeLookupRequest = function(userid) {
  var epoch = 0; // TODO: this.getEpoch()
  var request = /** @type {dcodeIO.ProtoBuf.Builder.Message} */ (
    new this.proto.LookupRequest({
    'epoch': epoch,
    'user_id': userid,
    'quorum_requirement': {
      'threshold': this.consensusSignaturesRequired_,
      'candidates': [1, 2, 3],
      'subexpressions': []
    }
  }));
  return request.toArrayBuffer();
};


/**
 * Decode and parse a lookup request.
 * @param {ArrayBuffer} request The request to decode.
 * @return {dcodeIO.ProtoBuf.Builder.Message}
 */
keyserver.Client.prototype.decodeLookupRequest = function(request) {
  return this.proto.LookupRequest.decode(request);
};


/**
 * Checks whether we are past the expiration time.
 * @param {number} expirationTime The time to check, in nanoseconds.
 * @return {boolean}
 * @private
 */
keyserver.Client.prototype.isExpired_ = function(expirationTime) {
  var now = (new Date().getTime()) * 10E6;  // Nanoseconds
  return (expirationTime < now);
};


/**
 * Verify a Ed25519 signature.
 * @param {!e2e.ByteArray} pubKey The public key.
 * @param {!e2e.ByteArray} msg The message.
 * @param {!e2e.ByteArray} sig The signature.
 * @return {boolean}
 * @private
 */
keyserver.Client.prototype.verifySignature_ = function(pubKey, msg, sig) {
  var protocol = new e2e.ecc.Ed25519(e2e.ecc.PrimeCurve.ED_25519,
                                     {pubKey: pubKey, privKey: []});
  return protocol.verify(msg, sig);
};


});  // goog.scope
