/**
 * @license
 * Copyright 2012 Google Inc. All rights reserved.
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
 * @fileoverview Crypto related helper functions.
 * @author evn@google.com (Eduardo Vela)
 */


goog.provide('e2e');
goog.provide('e2e.ByteArray');
goog.provide('e2e.DwordArray');

goog.require('e2e.async.Result');
goog.require('e2e.error.InvalidArgumentsError');
goog.require('goog.array');
goog.require('goog.crypt');


/**
 * DwordArray is an array of 32 bits long big endian numbers.
 * @typedef {!Array.<number>}
 */
e2e.DwordArray;


/**
 * ByteArray is an array of 8 bits long numbers.
 * @typedef {!Array.<number>}
 */
e2e.ByteArray;


/**
 * Turns a 64-bit value into a ByteArray.
 * @param {!goog.math.Long} value 64-bit value. long is a reserved word.
 * @return {!e2e.ByteArray} ByteArray of 4 bytes.
 */
e2e.longToByteArray = function(value) {
  return e2e.dwordArrayToByteArray([
    value.getHighBits(), value.getLowBitsUnsigned()]);
};


/**
 * Converts a non-negative number into a big-endian ByteArray.
 * @param {!number} value The number to convert.
 * @return {!e2e.ByteArray} The number as a big-endian ByteArray.
 */
e2e.numberToByteArray = function(value) {
  if (value < 0) {
    throw new e2e.error.InvalidArgumentsError(
        'Cannot convert negative number to a byte array.');
  }

  var byteArray = [];
  do {
    byteArray.unshift(value & 0xff);
    value >>>= 8;
  } while (value > 0);
  return byteArray;
};


/**
 * Turns an array of big endian 32 bits numbers into a byte array.
 * @see #byteArrayToDwordArray
 * @param {!e2e.DwordArray} dwords DwordArray to transform to ByteArray.
 * @return {!e2e.ByteArray} ByteArray with a length divisible by 4.
 */
e2e.dwordArrayToByteArray = function(dwords) {
  var byteArray = [];
  goog.array.forEach(dwords, function(dword) {
    byteArray.push((dword >>> 24) & 0xff);
    byteArray.push((dword >>> 16) & 0xff);
    byteArray.push((dword >>> 8) & 0xff);
    byteArray.push((dword) & 0xff);
  });
  return byteArray;
};


/**
 * Turns an array of numbers into a big endian 32 bit numbers array.
 * @see #dwordArrayToByteArray
 * @param {!e2e.ByteArray} bytes ByteArray with a length divisible by 4.
 * @return {!e2e.DwordArray} The resulting dword array.
 */
e2e.byteArrayToDwordArray = function(bytes) {
  var dwordArray = [];
  for (var i = 0; i < bytes.length; i += 4) {
    dwordArray.push((bytes[i + 3] |
                     (bytes[i + 2] << 8) |
                     (bytes[i + 1] << 16) |
                     (bytes[i] << 24)) >>> 0);
  }
  return dwordArray;
};


/**
 * Turns an two-octet array into a big endian 16 bit number.
 * @param {!e2e.ByteArray} bytes ByteArray with a length of 2.
 * @return {number} The resulting word.
 */
e2e.byteArrayToWord = function(bytes) {
  return (bytes[0] << 8 | bytes[1]);
};


/**
 * Converts a big-endian byte array into a number. Due to memory limits of the
 * bitwise operators and number type, the byte array should be at most 4 bytes.
 * @param {!e2e.ByteArray} bytes A big-endian byte array.
 * @return {number} The resulting number.
 */
e2e.byteArrayToNumber = function(bytes) {
  if (bytes.length > 4) {
    throw new e2e.error.InvalidArgumentsError(
        'Cannot convert byte array exceeding 4 bytes to a number.');
  }

  var result = 0;
  for (var i = 0; i < bytes.length; i++) {
    result <<= 8;
    result |= bytes[i];
  }
  return result;
};


/**
 * Turns a 16-bit value into a byte array.
 * @param {number} word The 16-bit number.
 * @return {!e2e.ByteArray} The resulting byte array.
 */
e2e.wordToByteArray = function(word) {
  var byteArray = [];
  byteArray.push((word >>> 8) & 0xff);
  byteArray.push(word & 0xff);
  return byteArray;
};


/**
 * Whether to use Text decoder to decode byte arrays (check crbug.com/243354).
 * @const {boolean}
 */
e2e.USE_TEXT_DECODER = 'TextDecoder' in goog.global;


/**
 * Converts a byte array into a JS string.
 * @param {!e2e.ByteArray|!Uint8Array} bytes The bytes to convert.
 * @param {string=} opt_charset The charset to try (defaults to UTF-8).
 * @return {string} The string representation of bytes.
 */
e2e.byteArrayToString = function(bytes, opt_charset) {
  if (e2e.USE_TEXT_DECODER) {
    var td = /** @type {{decode: function(Uint8Array):string}} */ (
        new goog.global['TextDecoder'](opt_charset || 'utf-8'));
    return td.decode(new Uint8Array(bytes));
  } else {
    return goog.crypt.utf8ByteArrayToString(bytes);
  }
};


/**
 * Converts a byte array into a JS string asynchronously.
 * @param {!e2e.ByteArray} bytes The bytes to convert.
 * @param {string=} opt_charset The charset to try (defaults to UTF-8).
 * @return {!e2e.async.Result.<string>} The string representation of bytes.
 */
e2e.byteArrayToStringAsync = function(bytes, opt_charset) {
  if (e2e.USE_TEXT_DECODER) {
    return e2e.async.Result.toResult(
        e2e.byteArrayToString(bytes, opt_charset));
  } else {
    var res = new e2e.async.Result;
    var fr = new FileReader;
    fr.onload = function() {
      res.callback(fr.result);
    };
    fr.onerror = function(e) {
      res.errback(new Error(String(e)));
    };
    fr.readAsText(
        new Blob([new Uint8Array(bytes)]), opt_charset || 'utf-8');
    return res;
  }
};


/**
 * Converts a string into a UTF-8 encoded byte array.
 * Throws {@code e2e.error.InvalidArgumentsError} if the string
 * contains unencodable codepoints (eg: surrogate characters.)
 * @param {string} stringInput The string to convert.
 * @return {!e2e.ByteArray} The UTF-8 byte representation of the string.
 */
e2e.stringToByteArray = function(stringInput) {
  // We don't use the Closure implementation as it normalizes line ends to \n.
  var out = [], p = 0;
  for (var i = 0; i < stringInput.length; i++) {
    var c = stringInput.charCodeAt(i);
    // If present, convert surrogate pairs to Unicode code points
    // From Section 3.7 of the Unicode Standard:
    // If <H,L> is a surrogate pair,
    // N = (H - 0xD800)*0x400 + (L - 0xDC00) + 0x10000
    // See:
    // http://unicode.org/versions/Unicode3.0.0/ch03.pdf
    // and the String.charCodeAt() documentation
    // http://goo.gl/d4oFPv
    if (e2e.isHighSurrogate_(c)) {
      i++;
      // charCodeAt() returns NaN if i >= stringInput.length
      var low = stringInput.charCodeAt(i);
      if (isNaN(low) || !e2e.isLowSurrogate_(low)) {
        throw new e2e.error.InvalidArgumentsError(
            'Cannot encode string to utf-8.');
      }
      c = ((c - 0xd800) * 0x400) + (low - 0xdc00) + 0x10000;
    }
    else if (e2e.isLowSurrogate_(c)) {
      throw new e2e.error.InvalidArgumentsError(
          'Cannot encode string to utf-8.');
    }

    // Convert a code point into utf-8
    // See:
    // http://tools.ietf.org/html/rfc3629#section-3
    // for the encoding procedure.
    if (c <= 0x7f) {
      // one byte encoding
      // 0xxxxxxx
      out[p++] = c;
    } else if (c <= 0x7ff) {
      // two byte encoding
      // 110xxxxx 10xxxxxx
      out[p++] = (c >> 6) | 0xc0;
      out[p++] = (c & 0x3f) | 0x80;
    } else if (c <= 0xffff) {
      // three byte encoding
      // 1110xxxx 10xxxxxx 10xxxxxx
      out[p++] = (c >> 12) | 0xe0;
      out[p++] = ((c >> 6) & 0x3f) | 0x80;
      out[p++] = (c & 0x3f) | 0x80;
    } else if (c <= 0x10ffff) {
      // four byte encoding
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      out[p++] = ((c >> 18) & 0x7) | 0xf0;
      out[p++] = ((c >> 12) & 0x3f) | 0x80;
      out[p++] = ((c >> 6) & 0x3f) | 0x80;
      out[p++] = (c & 0x3f) | 0x80;
    } else {
      throw new e2e.error.InvalidArgumentsError(
          'Cannot encode character codes > 0x10ffff');
    }
  }
  return out;
};


/**
 * @param {!number} code The character code
 * @return {!boolean} true if it is a high surrogate
 * @private
 */
e2e.isHighSurrogate_ = function(code) {
  return 0xd800 <= code && code <= 0xdbff;
};


/**
 * @param {!number} code The character code
 * @return {!boolean} true if it is a low surrogate
 * @private
 */
e2e.isLowSurrogate_ = function(code) {
  return 0xdc00 <= code && code <= 0xdfff;
};


/**
 * Returns whether the number is a valid 'byte' (0-255 no decimals).
 * @param {number} b The number to test.
 * @return {boolean} If the send number is a byte.
 */
e2e.isByte = function(b) {
  return (typeof b == 'number' &&
      b >= 0 &&
      b <= 255 &&
      b - Math.floor(b) == 0);
};


/**
 * Verifies a given ByteArray is indeed made of bytes.
 * @param {!e2e.ByteArray} bytes The bytearray to test.
 * @return {boolean} If the array if a byteArray.
 */
e2e.isByteArray = function(bytes) {
  var yes = 1;
  for (var i = 0; i < bytes.length; i++) {
    yes &= e2e.isByte(bytes[i]) | 0;
  }
  return yes == 1;
};


/**
 * Does near constant time ByteArray comparison.
 * @param {!e2e.ByteArray} ba1 The first bytearray to check.
 * @param {!e2e.ByteArray} ba2 The second bytearray to check.
 * @return {boolean} If the array are equal.
 */
e2e.compareByteArray = function(ba1, ba2) {
  if (ba1.length !== ba2.length) {
    return false;
  }
  if (!e2e.isByteArray(ba1) || !e2e.isByteArray(ba2)) {
    return false;
  }
  var yes = 1;
  for (var i = 0; i < ba1.length; i++) {
    yes &= !(ba1[i] ^ ba2[i]) | 0;
  }
  return yes == 1;
};


/**
 * Asserts that a given expression evaluates to true.
 * Does *not* get removed during compilation.
 * @template T
 * @param {?T} cond The expression to check.
 * @param {string=} opt_msg The message to throw.
 * @param {!function(new:Error,string)=} opt_error The error type to throw.
 * @return {!T} The result of the conditional expression.
 */
e2e.assert = function(cond, opt_msg, opt_error) {
  if (!cond) {
    throw new (opt_error || Error)(opt_msg || 'Assertion failed.');
  }
  return cond;
};


/**
 * Increments (++ByteArray) an unsigned big endian in a ByteArray.
 * @template T
 * @param {T} n The number to increment.
 * @return {T} The incremented array.
 */
e2e.incrementByteArray = function(n) {
  /**
   * Inner function to allow static type checking.
   * @param {(!e2e.ByteArray|!Uint8Array)} n The number to increment.
   * @return {(!e2e.ByteArray|!Uint8Array)} The incremented array.
   */
  var fn = function(n) {
    var carry = 1;  // initial increment
    for (var i = n.length - 1; i >= 0; --i) {
      n[i] += carry;
      carry = (n[i] & 0x100) >>> 8;
      n[i] &= 0xff;
    }
    return n;
  };
  return fn(n);
};
