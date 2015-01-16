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
 * @fileoverview Tests for the generate key panel.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.panels.GenerateKeyTest');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.panels.GenerateKey');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.setTestOnly();

var constants = e2e.ext.constants;
var mockControl = null;
var panel = null;
var stubs = new goog.testing.PropertyReplacer();


function setUp() {
  document.body.textContent = '';

  mockControl = new goog.testing.MockControl();
  e2e.ext.testingstubs.initStubs(stubs);
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  goog.dispose(panel);
}


function testReset() {
  panel = new e2e.ext.ui.panels.GenerateKey(function() {}, false);

  panel.render(document.body);
  populateForm();
  panel.reset();

  var inputs = document.querySelectorAll('input');
  goog.array.forEach(inputs, function(input) {
    assertFalse('Failed to clear all input values', !!input.value);
  });
}


function testSendKeys() {
  panel = new e2e.ext.ui.panels.GenerateKey(function() {}, false);
  stubs.replace(panel.keyserverClient_, 'sendKey',
                function(userid, key, cb) {
                  cb({userid: userid, key: key});
                });
  stubs.replace(panel.keyserverClient_, 'cacheKeyData',
                mockControl.createFunctionMock('cache'));
  panel.keyserverClient_.cacheKeyData(
      new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
        assertObjectEquals({userid: 'test@example.com',
            key: 'irrelevant'}, arg);
        return true;
      })
  );
  stubs.replace(window, 'alert', function(message) {
    window.console.log(message);
  });
  mockControl.$replayAll();

  var keys = [{key: {secret: false},
      serialized: 'irrelevant',
      uids: ['testing <test@example.com>']
    }, {key: {secret: true},
      serialized: 'foobar',
      uids: ['foo@bar.com']
    }];

  panel.sendKeys(keys);
  mockControl.$verifyAll();
}


function testSendKeysFailure() {
  panel = new e2e.ext.ui.panels.GenerateKey(function() {}, false);
  panel.render(document.body);
  stubs.replace(panel.keyserverClient_, 'sendKey', function() {
    panel.keyserverClient_.handleAuthFailure_(302);
  });
  var keys = [{key: {secret: false},
      serialized: 'irrelevant',
      uids: ['testing <test@example.com>']
    }, {key: {secret: true},
      serialized: 'foobar',
      uids: ['foo@bar.com']
    }];

  panel.sendKeys(keys);
  var errorDiv = panel.getElement().getElementsByClassName(
      constants.CssClass.ERROR)[0];
  assertContains('login', errorDiv.textContent);
}


function testGenerate() {
  panel = new e2e.ext.ui.panels.GenerateKey(
      mockControl.createFunctionMock('callback'));
  panel.callback_(
      panel, '', 't@example.com', '', goog.testing.mockmatchers.ignoreArgument);

  mockControl.$replayAll();
  panel.render(document.body);

  populateForm();
  panel.generate_();
  mockControl.$verifyAll();
}


function populateForm() {
  goog.dom.getElementByClass(constants.CssClass.EMAIL).value = 't@example.com';
}
