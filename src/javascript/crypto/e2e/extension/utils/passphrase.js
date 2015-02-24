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
 * @fileoverview Utils for working with word-based passphrases.
 */

goog.provide('e2e.ext.utils.passphrase');

goog.require('e2e.error.InvalidArgumentsError');
goog.require('e2e.ext.utils.wordlist');
goog.require('goog.string');


e2e.ext.utils.passphrase.MAX_INDEX = 65535; // 2^16 - 1

e2e.ext.utils.passphrase.KEYPAIR_COUNT = 1; // # of keypairs per ECC seed

/**
 * Converts a byte array to a phrase. Each word in the wordlist has ~2 bytes of
 * entropy so the length of the phrase is roughly half the bytearray length.
 * @param {!e2e.ByteArray} bytes The bytes to convert
 * @return {string}
 */
e2e.ext.utils.passphrase.bytesToPhrase = function(bytes) {
  var words = [];

  // Only handle even-length byte arrays for now
  if (bytes.length % 2 === 1) {
    throw new e2e.error.InvalidArgumentsError('Invalid bytes');
  }

  // Convert byte pair into a number between 0 and 256^2 to index into the
  // wordlist. Ex:  1, 2 -> 258
  goog.array.forEach(bytes, function(elem, index, arr) {
    var next = arr[index + 1];
    if (index % 2 === 0) {
      var wordIndex = elem * 256 + next;
      var word = e2e.ext.wordlist[wordIndex];
      if (!word) {
        // Should never happen
        throw new e2e.error.InvalidArgumentsError('Invalid bytes');
      } else {
        words.push(word);
      }
    }
  });

  return words.join(' ');
};


/**
 * Converts a phrase back to the original byte array.
 * @param {string} phrase
 * @return {!e2e.ByteArray}
 */
e2e.ext.utils.passphrase.phraseToBytes = function(phrase) {
  // The first byte is always the number of keypairs generated with the seed
  var bytes = [e2e.ext.utils.passphrase.KEYPAIR_COUNT];

  phrase = goog.string.normalizeSpaces(phrase.toLowerCase().trim());
  var words = phrase.split(' ');

  goog.array.forEach(words, function(word) {
    // Convert each word to a doublebyte using its index in the wordlist
    var index = goog.array.binarySearch(e2e.ext.wordlist, word);
    if (index < 0 || index > e2e.ext.utils.passphrase.MAX_INDEX) {
      throw new e2e.error.InvalidArgumentsError('Invalid phrase.');
    } else {
      // Convert each doublebyte into a byte
      bytes.push(window.Math.floor(index / 256));
      bytes.push(index % 256);
    }
  });

  return bytes;
};
