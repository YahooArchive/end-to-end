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
 * @fileoverview Unit tests for the End-To-End keyserver client.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.keyserverV2.ClientTest');

goog.require('e2e.ext.keyserverV2.Client');
goog.require('e2e.ext.testingstubs');

goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.setTestOnly();

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall(document.title);
asyncTestCase.stepTimeout = 2000;

var client;
var mockControl = null;
var mockmatchers = goog.testing.mockmatchers;
var stubs = new goog.testing.PropertyReplacer();

function setUp() {
  e2e.ext.testingstubs.initStubs(stubs);

  stubs.setPath('chrome.runtime.getURL', function(path) {
    if (goog.string.endsWith(path, '.proto')) {
      return '../' + path;
    }
    var url = '/lib/protobuf.js/' + path;
    return url;
  });

  mockControl = new goog.testing.MockControl();
  client = new e2e.ext.keyserverV2.Client(24 * 3600 * 10E9, 2, 2);
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  client = undefined;
  window.dcodeIO = undefined;
  window.localStorage.clear();
}


function testInitialize() {
  asyncTestCase.waitForAsync('Waiting for protobuf initialize');
  client.initialize(function() {
    assertTrue(client.initialized_);
    assertEquals('function', typeof window.dcodeIO.Long);
    assertEquals('function', typeof window.dcodeIO.ByteBuffer);
    assertEquals('object', typeof window.dcodeIO.ProtoBuf);
    assertEquals('object', typeof client.builder);
    assertEquals('object', typeof client.proto);
    asyncTestCase.continueTesting();
  });
}
