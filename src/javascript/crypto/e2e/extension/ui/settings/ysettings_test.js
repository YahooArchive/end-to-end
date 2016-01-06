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
 * @fileoverview Tests for the settings page.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.ySettingsTest');

goog.require('e2e.async.Result');
goog.require('e2e.ext.ExtensionLauncher');
goog.require('e2e.ext.actions.GetKeyDescription');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.ySettings');
goog.require('e2e.ext.ui.dialogs.Generic');
goog.require('e2e.ext.ui.panels.KeyringMgmtFull');
goog.require('e2e.ext.utils');
goog.require('e2e.openpgp.ContextImpl');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.require('goog.testing.mockmatchers.ArgumentMatcher');
goog.require('goog.testing.mockmatchers.SaveArgument');
goog.require('goog.testing.storage.FakeMechanism');
goog.setTestOnly();

var constants = e2e.ext.constants;
var launcher = null;
var mockControl = null;
var page = null;
var stubs = new goog.testing.PropertyReplacer();
var testCase = goog.testing.AsyncTestCase.createAndInstall(document.title);


function setUp() {
  mockControl = new goog.testing.MockControl();
  e2e.ext.testingstubs.initStubs(stubs);
  launcher = new e2e.ext.ExtensionLauncher(
      new e2e.openpgp.ContextImpl(new goog.testing.storage.FakeMechanism()),
      new goog.testing.storage.FakeMechanism());
  launcher.start();

  stubs.setPath('chrome.runtime.getBackgroundPage', function(callback) {
    callback({launcher: launcher});
  });

  stubs.replace(e2e.ext.keyserver.Client.prototype, 'sendKey',
                function(userid, key, cb, eb) {
                  this.cacheKeyData('foo');
                  cb({userid: userid, key: key});
                });
  stubs.replace(window, 'alert', goog.nullFunction);

  page = new e2e.ext.ui.ySettings();

  stubs.replace(page.actionExecutor_, 'execute',
      function(ignore, ignore2, callback) {
        callback({
          'Test1 <test1@yahoo-inc.com>': 'privKey1',
          'Test2 <test2@yahoo-inc.com>': 'privKey2'});
  });
}


function tearDown() {
  goog.dispose(page);
  goog.dispose(launcher);

  stubs.reset();
  mockControl.$tearDown();
}


function testGenerateKeyInvalidEmail() {
  page.decorate(document.documentElement);
  testCase.waitForAsync('waiting for key to be generated and uploaded to keyserver');
  fakeGenerateKey().addErrback(function() {
    assertNotEquals(-1, document.body.textContent.indexOf(
        'invalidEmailWarning'));
    testCase.continueTesting();
  });
}


function testGenerateKeyDuplicated() {
  page.decorate(document.documentElement);
  testCase.waitForAsync('waiting for key to be generated and uploaded to keyserver');
  fakeGenerateKey('Test1', 'Test1@yahoo-inc.com').addErrback(function() {
    assertNotEquals(-1, document.body.textContent.indexOf(
        'duplicateKeyWarning'));
    testCase.continueTesting();
  });
}


function testGenerateKeySucessful() {
  page.decorate(document.documentElement);
  testCase.waitForAsync('waiting for key to be generated and uploaded to keyserver');

  var email = 'Test3@yahoo-inc.com';

  fakeGenerateKey('Test3', email).addCallback(function() {
    assertNotEquals(-1, document.body.textContent.indexOf(
        '<' + email.toLowerCase() + '>'));
    testCase.continueTesting();
  });
}

function fakeGenerateKey(opt_fullname, opt_email) {
  return page.generateKey_({reset: function() {}}, opt_fullname || 'test user',
      opt_email || 'test@example.com', 'comment');
}
