/**
 * @license
 * Copyright 2013 Google Inc. All rights reserved.
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
 * @fileoverview JavaScript implementation of DES as specified in FIPS 46–2 and
 * TripleDES EDE.
 * Overall structure inspired by the golang version by Chris Lennert.
 * @author adhintz@google.com (Drew Hintz)
 */

goog.provide('e2e.cipher.Des');
goog.provide('e2e.cipher.TripleDes');

goog.require('e2e');
goog.require('e2e.AlgorithmImpl');
goog.require('e2e.async.Result');
goog.require('e2e.cipher.Algorithm');
goog.require('e2e.cipher.SymmetricCipher');
goog.require('e2e.cipher.factory');
goog.require('goog.math.Long');



/**
 * Basic implementation of TripleDES (3DES EDE).
 * @param {e2e.cipher.Algorithm} algorithm The algorithm being
 *     implemented.
 * @param {e2e.cipher.key.Key=} opt_keyObj The key to use.
 * @implements {e2e.cipher.SymmetricCipher}
 * @extends {e2e.AlgorithmImpl}
 * @constructor
 */
e2e.cipher.TripleDes = function(algorithm, opt_keyObj) {
  /**
   * Three instances of DES, populated by setKey().
   * @type {Array.<e2e.cipher.Des>}
   * @private
   */
  this.des_ = [];
  this.keySize = 24;
  goog.base(this, algorithm, opt_keyObj);
};
goog.inherits(e2e.cipher.TripleDes, e2e.AlgorithmImpl);


/** @inheritDoc */
e2e.cipher.TripleDes.prototype.blockSize = 8; // 64 bits.


/** @inheritDoc */
e2e.cipher.TripleDes.prototype.setKey = function(keyObj) {
  goog.base(this, 'setKey', keyObj, keyObj.key.length);

  for (var i = 0; i < 3; i++) {
    this.des_[i] = new e2e.cipher.Des(
        e2e.cipher.Algorithm.TRIPLE_DES,  // Not actually used.
        {key: keyObj.key.slice(i * 8, i * 8 + 8)});
  }
};


/** @inheritDoc */
e2e.cipher.TripleDes.prototype.encrypt = function(data) {
  return this.des_[0].encrypt(data).addCallback(
      this.des_[1].decrypt, this.des_[1]).addCallback(
      this.des_[2].encrypt, this.des_[2]);
};


/** @inheritDoc */
e2e.cipher.TripleDes.prototype.decrypt = function(data) {
  return this.des_[2].decrypt(data).addCallback(
      this.des_[1].encrypt, this.des_[1]).addCallback(
      this.des_[0].decrypt, this.des_[0]);
};



/**
 * Basic implementation of DES.
 * @param {e2e.cipher.Algorithm} algorithm The algorithm being
 *     implemented.
 * @param {e2e.cipher.key.Key=} opt_keyObj The key to use.
 * @implements {e2e.cipher.SymmetricCipher}
 * @extends {e2e.AlgorithmImpl}
 * @constructor
 */
e2e.cipher.Des = function(algorithm, opt_keyObj) {
  /**
   * 16 subkeys, each 56 bits, but stored as 64-bit values.
   * @type {Array.<goog.math.Long>}
   * @private
   */
  this.subkeys_ = [];
  goog.base(this, algorithm, opt_keyObj);
};
goog.inherits(e2e.cipher.Des, e2e.AlgorithmImpl);


/** @inheritDoc */
e2e.cipher.Des.prototype.blockSize = 8; // 64 bits.


/** @inheritDoc */
e2e.cipher.Des.prototype.setKey = function(keyObj) {
  goog.base(this, 'setKey', keyObj, keyObj.key.length);
  this.keyExpansion_();
};


/**
 * Generates subkeys from this.key, stores in this.subkeys_.
 * @private
 */
e2e.cipher.Des.prototype.keyExpansion_ = function() {
  var permutedKey = this.permuteBlock_(this.key.key,
      e2e.cipher.Des.permutedChoice1);
  var leftKeys = this.keyRotate_(permutedKey.shiftRightUnsigned(28).toInt());
  var rightKeys = this.keyRotate_(permutedKey.toInt() & 0x0fffffff);
  for (var i = 0; i < 16; i++) {
    var blockInt = goog.math.Long.fromInt(leftKeys[i]).shiftLeft(28).or(
        goog.math.Long.fromInt(rightKeys[i]));
    var block = e2e.longToByteArray(blockInt);
    block.shift();  // remove first byte, so it's 56bits instead of 64bits
    this.subkeys_[i] = this.permuteBlock_(block,
        e2e.cipher.Des.permutedChoice2);
  }
};


/**
 * @param {number} key 32-bit value.
 * @return {!e2e.ByteArray} 16 keys, each 28 bits.
 * @private
 */
e2e.cipher.Des.prototype.keyRotate_ = function(key) {
  var keys = [];
  var previous = key;
  for (var i = 0; i < 16; i++) {
    previous = keys[i] = (
        ((previous << e2e.cipher.Des.leftShifts[i]) & 0x0fffffff) |
        ((previous << 4) >>> (32 - e2e.cipher.Des.leftShifts[i])));
  }
  return keys;
};


/**
 * @param {!e2e.ByteArray} key
 * @param {!e2e.ByteArray} permutedChoice
 * @return {!goog.math.Long}
 * @private
 */
e2e.cipher.Des.prototype.permuteBlock_ = function(key, permutedChoice) {
  var result = goog.math.Long.fromNumber(0);
  for (var i = 0; i < permutedChoice.length; i++) {
    var keyByte = key[((permutedChoice[i] - 1) >>> 3)];
    var bit = ((keyByte << ((permutedChoice[i] - 1) & 0x7)) & 0xff) >>> 7;
    var bitLong = goog.math.Long.fromNumber(bit);
    result = result.or(bitLong.shiftLeft(((permutedChoice.length - 1) - i)));
  }
  return result;
};


/** @inheritDoc */
e2e.cipher.Des.prototype.encrypt = function(data) {
  return this.crypt_(data, true);
};


/** @inheritDoc */
e2e.cipher.Des.prototype.decrypt = function(data) {
  return this.crypt_(data, false);
};


/**
 * Implements encryption and decryption.
 * @param {!e2e.ByteArray} data The data to encrypt.
 * @param {boolean} encrypt If true, does encryption, otherwise decrypttion.
 * @return {!e2e.async.Result} The result of encryption.
 * @private
 */
e2e.cipher.Des.prototype.crypt_ = function(data, encrypt) {
  var block = this.permuteBlock_(data,
      e2e.cipher.Des.initialPermutation);
  var left = block.getHighBits();
  var right = block.getLowBitsUnsigned();
  for (var i = 0; i < 16; i++) {
    var previousRight = right;
    if (encrypt) {
      right = left ^ this.feistel_(right, this.subkeys_[i]);
    } else {  // decrypt
      right = left ^ this.feistel_(right, this.subkeys_[15 - i]);
    }
    left = previousRight;
  }
  var combined = e2e.longToByteArray(
      goog.math.Long.fromBits(left, right));  // Left and right are swapped.
  var result = this.permuteBlock_(combined,
      e2e.cipher.Des.initialPermutationInverse);
  return e2e.async.Result.toResult(e2e.longToByteArray(result));
};


/**
 * @param {number} right 32-bit value to scramble.
 * @param {goog.math.Long} key 64-bit key to use.
 * @return {number} 32-bit value.
 * @private
 */
e2e.cipher.Des.prototype.feistel_ = function(right, key) {
  var rightExpanded = this.permuteBlock_(
      e2e.dwordArrayToByteArray([right]),
      e2e.cipher.Des.eBitSelection);
  var xorResult = key.xor(rightExpanded);
  var sBoxResult = 0;
  for (var i = 0; i < 8; i++) {
    var rowCol = (xorResult.shiftLeft(16 + (6 * i))
                  .shiftRightUnsigned(58).toInt()) & 0xff;
    var row = (rowCol & 0x1) | ((rowCol & 0x20) >>> 4);
    var col = ((rowCol << 3) & 0xff) >>> 4;
    sBoxResult |= (e2e.cipher.Des.sBoxes[i][row][col] <<
                   (4 * (7 - i))) & 0xffffffff;
  }
  return this.permuteBlock_(e2e.dwordArrayToByteArray([sBoxResult]),
      e2e.cipher.Des.permutationFunction).getLowBitsUnsigned();
};


/**
 * IP, initial permutation.
 * @type {!e2e.ByteArray}
 * @const
 */
e2e.cipher.Des.initialPermutation = [
  58, 50, 42, 34, 26, 18, 10, 2,
  60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6,
  64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1,
  59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5,
  63, 55, 47, 39, 31, 23, 15, 7
];


/**
 * IP**-1, final permutation.
 * @type {!e2e.ByteArray}
 * @const
 */
e2e.cipher.Des.initialPermutationInverse = [
  40, 8, 48, 16, 56, 24, 64, 32,
  39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30,
  37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28,
  35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26,
  33, 1, 41, 9, 49, 17, 57, 25
];


/**
 * E bit-selection table, expansion function.
 * @type {!e2e.ByteArray}
 * @const
 */
e2e.cipher.Des.eBitSelection = [
  32, 1, 2, 3, 4, 5,
  4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13,
  12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21,
  20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29,
  28, 29, 30, 31, 32, 1
];


/**
 * P, permutation function.
 * @type {!e2e.ByteArray}
 * @const
 */
e2e.cipher.Des.permutationFunction = [
  16, 7, 20, 21,
  29, 12, 28, 17,
  1, 15, 23, 26,
  5, 18, 31, 10,
  2, 8, 24, 14,
  32, 27, 3, 9,
  19, 13, 30, 6,
  22, 11, 4, 25
];


/**
 * Note that S-boxes in spec are 1-indexed.
 * @type {Array.<Array.<!e2e.ByteArray>>}
 * @const
 */
e2e.cipher.Des.sBoxes = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
  ]
];


/**
 * PC-1, Permuted choice 1.
 * @type {!e2e.ByteArray}
 * @const
 */
e2e.cipher.Des.permutedChoice1 = [
  57, 49, 41, 33, 25, 17, 9,
  1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27,
  19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15,
  7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29,
  21, 13, 5, 28, 20, 12, 4
];


/**
 * Note iterations in spec are 1-indexed.
 * @type {!e2e.ByteArray}
 * @const
 */
e2e.cipher.Des.leftShifts =
    [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];


/**
 * PC-2, Permuted choice 2.
 * @type {!e2e.ByteArray}
 * @const
 */
e2e.cipher.Des.permutedChoice2 = [
  14, 17, 11, 24, 1, 5,
  3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8,
  16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55,
  30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53,
  46, 42, 50, 36, 29, 32
];


e2e.cipher.factory.add(e2e.cipher.TripleDes,
    e2e.cipher.Algorithm.TRIPLE_DES);
