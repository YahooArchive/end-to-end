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
 * @fileoverview Decrypts the contents of and verifies the signers of
 * a PGP message.
 */

goog.provide('e2e.ext.actions.DecryptThenVerify');

goog.require('e2e');
goog.require('e2e.ext.actions.Action');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.utils.Error');
goog.require('goog.string');
goog.require('goog.structs.Map');

goog.scope(function() {
var actions = e2e.ext.actions;
var utils = e2e.ext.utils;



/**
 * Constructor for the action.
 * @constructor
 * @implements {e2e.ext.actions.Action.<string, e2e.openpgp.VerifiedDecrypt>}
 */
actions.DecryptThenVerify = function() {};


/**
 * To cache the verified results for the second call
 * @type {goog.structs.Map.<string, !goog.async.Deferred>}
 */
actions.DecryptThenVerify.VerifiedResults = new goog.structs.Map();


/** @inheritDoc */
actions.DecryptThenVerify.prototype.execute =
    function(ctx, request, requestor, callback, errorCallback) {
  if (!goog.isFunction(request.passphraseCallback)) {
    errorCallback(new utils.Error(
        'Unable to decrypt and verify the message.',
        'errorUnableToDecryptVerifyMessage'));
    return;
  }

  var verifyResultId,
      verifiedResult,
      deferVerification = false,
      verifiedResultMap = actions.DecryptThenVerify.VerifiedResults;

  if (request.action === e2e.ext.constants.Actions.VERIFY) {
    verifyResultId = request.content;
    // answer the second call for verification result
    if ((verifiedResult = verifiedResultMap.get(verifyResultId))) {
      verifiedResultMap.remove(verifyResultId);
      verifiedResult.addCallbacks(callback, errorCallback);
    } else {
      errorCallback(new utils.Error(
          'Unable to verify the message.', 'errorUnableToVerifyMessage'));
    }
    return;
  }

  // ensure that verifyResultId is unique
  do {
    verifyResultId = goog.string.getRandomString();
  } while (verifiedResultMap.containsKey(verifyResultId));

  // store the final result to a map
  verifiedResultMap.set(verifyResultId, ctx.decryptThenVerify(
      request.passphraseCallback, request.content, function(result) {
        // executed only if a message is encrypted and signed
        deferVerification = true;
        // indicate the presence of second call
        result.verifyResultId = verifyResultId;
        // return the content first
        e2e.byteArrayToStringAsync(
            result.decrypt.data, result.decrypt.options.charset).
            addCallback(function(text) {
              result.decrypt.text = text;
              callback(result);
            }, this);
      }).addCallbacks(function(result) {
        // remove the result from the map as no second call is needed.
        // e.g., a message is clearsigned
        // or discard the verification result if it's not needed
        if (!deferVerification ||
            request.action === e2e.ext.constants.Actions.DECRYPT) {
          verifiedResultMap.remove(verifyResultId);
          callback(result);
        }
        return result;
      }, errorCallback));

  // cleanup if caller doesn't bother to collect the verified result
  setTimeout(function() {
    if ((verifiedResult = verifiedResultMap.get(verifyResultId))) {
      verifiedResultMap.remove(verifyResultId);
    }
  }, 120000); //2min
};


});  // goog.scope
