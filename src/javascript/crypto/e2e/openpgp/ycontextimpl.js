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
 * @fileoverview Internal implementation of Yahoo-specific Context.
 */

goog.provide('e2e.openpgp.yContextImpl');

goog.require('e2e.async.Result');
goog.require('e2e.openpgp.Context');
goog.require('e2e.openpgp.ContextImpl');
goog.require('e2e.openpgp.KeyRing');
goog.require('e2e.openpgp.asciiArmor');
goog.require('e2e.openpgp.block.EncryptedMessage');
goog.require('e2e.openpgp.block.factory');
goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.async.DeferredList');
goog.require('goog.object');
goog.require('goog.structs.Map');



/**
 * Extends ContextImpl to cover Yahoo use cases.
 * @param {goog.storage.mechanism.Mechanism=} opt_keyRingStorageMechanism
 *     mechanism for storing keyring data. Defaults to HTML5 local storage.
 * @constructor
 * @implements {e2e.openpgp.Context}
 * @extends {e2e.openpgp.ContextImpl}
 */
e2e.openpgp.yContextImpl = function(opt_keyRingStorageMechanism) {
  goog.base(this, opt_keyRingStorageMechanism);
};
goog.inherits(e2e.openpgp.yContextImpl, e2e.openpgp.ContextImpl);


/**
 * //@yahoo
 * Verifies and decrypts signatures. It will also verify a cleartext message.
 * Callbacks are invoked once the decryption and verification is completed.
 * @param {function(string):!e2e.async.Result<string>} passphraseCallback This
 *     callback is used for requesting an action-specific passphrase from the
 *     user.
 * @param {string} encryptedMessage The encrypted data.
 * @param {!function(!e2e.openpgp.VerifiedDecrypt)} contentCallback
 * @return {!e2e.openpgp.VerifyDecryptResult}
 */
e2e.openpgp.yContextImpl.prototype.decryptThenVerify = function(
    passphraseCallback, encryptedMessage, contentCallback) {
  try {
    if (e2e.openpgp.asciiArmor.isClearSign(encryptedMessage)) {
      var clearSignedBlock = e2e.openpgp.asciiArmor.parseClearSign(
          encryptedMessage).toLiteralMessage();

      return this.yProcessLiteralMessage_(
          clearSignedBlock, false, contentCallback);
    }

    var armoredMessage = e2e.openpgp.asciiArmor.parse(encryptedMessage);

    var block = e2e.openpgp.block.factory.parseByteArrayMessage(
        armoredMessage.data, armoredMessage.charset);
    if (block instanceof e2e.openpgp.block.EncryptedMessage) {
      var keyCipherCallback = goog.bind(function(keyId, algorithm) {
        return e2e.async.Result.toResult(null).addCallback(function() {
          var secretKeyPacket = this.keyRing_.getSecretKey(keyId);
          if (!secretKeyPacket) {
            return null;
          }
          var cipher = goog.asserts.assertObject(
              secretKeyPacket.cipher.getWrappedCipher());
          goog.asserts.assert(algorithm == cipher.algorithm);
          // Cipher might also be a signer here. Check if cipher can decrypt
          // (at runtime, as we cant check for e2e.cipher.Cipher implementation
          // statically).
          return goog.isFunction(cipher.decrypt) ? cipher : null;
        }, this);
      }, this);
      return block.decrypt(keyCipherCallback, passphraseCallback).
          addCallback(goog.bind(function(block) {
            return this.yProcessLiteralMessage_(block, true, contentCallback);
          }, this));
    } else {
      return this.yProcessLiteralMessage_(block);
    }
  } catch (e) {
    return e2e.async.Result.toError(e);
  }
};


/**
 * //@yahoo
 * Processes a literal message and returns the result of verification.
 * @param {e2e.openpgp.block.Message} block
 * @param {boolean=} opt_encrypted Whether the message was encrypted. //@yahoo
 * @param {function(!e2e.openpgp.VerifiedDecrypt)=} opt_contentCallback The
 *     callback to first return decrypted text for messages that are both
 *     encrypted and signed. //@yahoo
 * @return {!e2e.openpgp.VerifyDecryptResult}
 * @private
 * @suppress {accessControls} for verifyMessage_
 */
e2e.openpgp.yContextImpl.prototype.yProcessLiteralMessage_ = function(
    block, opt_encrypted, opt_contentCallback) {
  var literalBlock = block.getLiteralMessage();
  var result = /** @type {!e2e.openpgp.VerifiedDecrypt} */ ({
    'decrypt': {
      'data': literalBlock.getData(),
      'options': {
        'charset': literalBlock.getCharset(),
        'creationTime': literalBlock.getTimestamp(),
        'filename': literalBlock.getFilename()
      },
      'wasEncrypted': opt_encrypted || false
    },
    'verify': null
  });

  if (literalBlock.signatures) {
    // @yahoo invoke the contentCallback first
    if (opt_contentCallback) {
      opt_contentCallback(/** @type {!e2e.openpgp.VerifiedDecrypt} */ (
          goog.object.clone(result)));
    }

    return this.verifyMessage_(literalBlock).
        addCallback(function(verifyResult) {
          result.verify = verifyResult;
          return result;
        });
  }

  return e2e.async.Result.toResult(result);
};


/**
 * //@yahoo
 * Deletes a private or public key that has a given key fingerprint from chosen
 * keyring. Use e2e.openpgp.KeyRing.Type.ALL to delete the whole keypair.
 * @param  {!e2e.openpgp.KeyFingerprint} fingerprint The fingerprint.
 * @param  {!e2e.openpgp.KeyRing.Type} keyRingType The keyring to delete the key
 *     from.
 * @return {!e2e.async.Result.<undefined>}
 */
e2e.openpgp.yContextImpl.prototype.deleteKeyByFingerprint = function(
    fingerprint, keyRingType) {
  this.keyRing_.deleteKeyByFingerprint(fingerprint, keyRingType);
  return e2e.async.Result.toResult(undefined);
};


/**
 * //@yahoo
 * Exports the keyring for a particular uid.
 * @param {string} uid The Uid to export
 * @param {boolean=} opt_armored Whether to export in the radix64 armor format.
 * @param {boolean=} opt_includeSecretKeys Whether to include any secret keys.
 * @return {!e2e.async.Result.<!e2e.ByteArray|string>}
 * @suppress {accessControls} for armorHeaders_
 */
e2e.openpgp.yContextImpl.prototype.exportUidKeyring = function(
    uid, opt_armored, opt_includeSecretKeys) {
  //@yahoo ASCII armor header depends on whether a private key exists
  var secretKey = e2e.openpgp.block.TransferableSecretKey, armorHeader;
  var keyType = opt_includeSecretKeys ?
      e2e.openpgp.KeyRing.Type.ALL :
      e2e.openpgp.KeyRing.Type.PUBLIC;
  //@yahoo major diff from exportKeyring is the use of searchLocalKey call
  return this.searchLocalKey(uid, keyType).
      addCallback(function(keys) {
        keys = new goog.structs.Map(keys);
        return goog.async.DeferredList.gatherResults(goog.array.map(
            goog.array.flatten(keys.getValues()), function(keyInfo) {
              return this.keyRing_.getKeyBlock(keyInfo).
                  addCallback(function(block) {
                    if (!armorHeader || block instanceof secretKey) {
                      armorHeader = block.header;
                    }
                    return block.serialize();
                  });
            }, this));
      }, this).
      addCallback(function(serialized) {
        serialized = goog.array.flatten(serialized);
        if (opt_armored) {
          return e2e.openpgp.asciiArmor.encode(
              armorHeader, serialized, this.armorHeaders_);
        }
        return serialized;
      }, this);
};


/**
 * //@yahoo
 * Searches a key (either public, private, or both) in the local keyring.
 * @param {string} uid The user id.
 * @param {e2e.openpgp.KeyRing.Type=} opt_type Key type to search for.
 * @return {!e2e.openpgp.KeyResult} The result of the search.
 */
e2e.openpgp.yContextImpl.prototype.searchLocalKey = function(uid, opt_type) {
  return e2e.async.Result.toResult(
      this.keyRing_.searchKey(uid, opt_type) || []).
      addCallback(function(keyBlocks) {
        return /** @type {!e2e.openpgp.Keys} */ (goog.array.map(keyBlocks,
            function(keyBlock) {
              return keyBlock.toKeyObject();
            }));
      });
};


/**
 * //@yahoo this key sync feature is unique to yahoo
 * Obtains conflict resolution decisions from the user when local keyring is
 * found out of sync with the remote keyserver.
 * @param {string} uid The user id.
 * @param {function(string, !e2e.openpgp.Keys, boolean):
 *     !e2e.async.Result<string>} consistentCallback The Callback to call when
 *     keys are in sync with the remote, or that uid is non-keyserver-managed.
 * @param {function(string, !e2e.openpgp.Keys, !e2e.openpgp.Keys,
 *     !e2e.openpgp.Keys): !e2e.async.Result<string>} inconsistentCallback
 *     The Callback to call when there is an inconsistency found.
 * @return {!e2e.async.Result} The result returned by the action requested
 */
e2e.openpgp.yContextImpl.prototype.syncWithRemote = function(uid,
    consistentCallback, inconsistentCallback) {

  // TODO: now keyserver being online is a must for yahoo users
  return this.keyRing_.compareWithRemote(uid).
      addCallback(function(diff) {
        var local = diff.localOnly,
            common = diff.common,
            remote = diff.remoteOnly;
        var callback = (!diff.syncManaged ||
            local.length === 0 && remote.length === 0) ?
                consistentCallback(uid, common, diff.syncManaged) :
                inconsistentCallback(uid, local, common, remote);

        return callback.addCallback(function(action) {
          switch (action) {
            case 'delete':
              return this.deleteKey(uid);
            case 'overwriteRemote':
              return this.keyRing_.uploadKeys(uid);
            case 'noop':
              return true;
          }
          return null;
        }, this);

      }, this);
};
