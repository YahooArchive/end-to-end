// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * @fileoverview Defines tests for the session manager.
 *
 * @author rcc@google.com (Ryan Chan)
 */

goog.require('e2e.otr.Session');
goog.require('e2e.otr.constants');
goog.require('e2e.otr.testing');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');

goog.setTestOnly();

var constants = e2e.otr.constants;
var tag = new Uint8Array([1, 2, 3, 4]);

function testConstructor() {
  var s = new e2e.otr.Session(null, tag);
  assertObjectEquals(constants.DEFAULT_POLICY, s.policy);
  assertEquals(constants.MSGSTATE.PLAINTEXT, s.msgState_);
  assertEquals(constants.AUTHSTATE.NONE, s.authState_);
  assertTypedArrayEquals(tag, s.instanceTag);
  assertTypedArrayEquals([0, 0, 0, 0], s.remoteInstanceTag);

  s = new e2e.otr.Session(null, tag, {testProperty: 123});
  assertEquals(123, s.policy.testProperty);

  assertThrows(function() {
    new e2e.otr.Session(null, new Uint8Array([0, 0, 0, 0]));
  });
}

function testUpdateAuthState() {
  var s = new e2e.otr.Session(null, tag);
  assertEquals(constants.AUTHSTATE.NONE, s.authState_);
  assertThrows(function() {
    s.setAuthState(constants.AUTHSTATE.AWAITING_SIG);
  });
  s.setAuthState(constants.AUTHSTATE.AWAITING_DHKEY);
  assertEquals(constants.AUTHSTATE.AWAITING_DHKEY, s.authState_);
}
