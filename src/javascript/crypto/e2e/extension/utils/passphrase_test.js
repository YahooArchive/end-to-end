/**
 * @license
 * Copyright 2014 Google Inc. All rights reserved.
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
 * @fileoverview Tests for the action utility methods.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.utils.passphraseTest');

goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.utils.passphrase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.setTestOnly();

var mockControl = null;
var stubs = new goog.testing.PropertyReplacer();
var utils = e2e.ext.utils;


function setUp() {
  mockControl = new goog.testing.MockControl();
  e2e.ext.testingstubs.initStubs(stubs);
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
}

function testBytesToPhrase() {
  var evenBytes =
      [0, 0, 17, 212, 12, 140, 90, 247, 46, 83, 254, 60, 54, 169, 255, 255];
  var phrase =
      'a bioengineering balloted gobbledegook creneled writhing depriving zyzzyva';
  assertEquals(phrase, utils.passphrase.bytesToPhrase(evenBytes));
  var oddBytes = [1, 2, 3];
  assertThrows('Odd byte array should throw exception',
               goog.partial(utils.passphrase.phraseToBytes, oddBytes));
}


function testPhraseToBytes() {
  var phrase =
      'a  bioengineering balloted gobbledegook creneled writhing depriving zyzzyVA 120 \n';
  var bytes =
      [120, 0, 0, 17, 212, 12, 140, 90, 247, 46, 83, 254, 60, 54, 169, 255, 255];
  assertArrayEquals(bytes, utils.passphrase.phraseToBytes(phrase));
  var invalidPhrase = 'word dfafklfje jkadfjkje irrelevant';
  assertThrows('Invalid phrase should throw exception', goog.partial(
               utils.passphrase.phraseToBytes, invalidPhrase));
}
