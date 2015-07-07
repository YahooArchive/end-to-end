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
 * @fileoverview Unit tests for the UI prompt.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.PromptTest');

goog.require('e2e.async.Result');
goog.require('e2e.ext.Launcher');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.Prompt');
/** @suppress {extraRequire} intentionally importing all signer functions */
goog.require('e2e.signer.all');
goog.require('goog.Timer');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.require('goog.testing.mockmatchers.ArgumentMatcher');
goog.require('goog.testing.mockmatchers.SaveArgument');

goog.setTestOnly();

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall(document.title);
asyncTestCase.stepTimeout = 2000;

var constants = e2e.ext.constants;
var mockControl = null;
var prompt = null;
var stubs = new goog.testing.PropertyReplacer();


function setUp() {
  window.localStorage.clear();
  mockControl = new goog.testing.MockControl();
  e2e.ext.testingstubs.initStubs(stubs);

  stubs.replace(goog.Timer.prototype, 'start', goog.nullFunction);

  prompt = new e2e.ext.ui.Prompt();
  prompt.pgpLauncher_ = new e2e.ext.Launcher();
  prompt.pgpLauncher_.start();
  stubs.setPath('chrome.runtime.getBackgroundPage', function(callback) {
    callback({launcher: prompt.pgpLauncher_});
  });

  stubs.replace(e2e.ext.Launcher.prototype, 'hasPassphrase', function() {
    return true;
  });

}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  prompt.dispose();
  goog.dispose(prompt);
}

function testRendering() {
  stubs.replace(chrome.i18n, 'getMessage', function() {
    return 'PGP Encrypt/Sign';
  });

  prompt.decorate(document.documentElement);
  prompt.processSelectedContent_();
  var elem = document.body;
  assertTrue(elem.textContent.indexOf('PGP Encrypt/Sign') > -1);
}


function testMenuRendering() {
  prompt.decorate(document.documentElement);
  prompt.processSelectedContent_();
  var elem = document.body;

  assertContains('actionUserSpecified', elem.textContent);
}


function testDisposeOnClose() {
  prompt.close();
  assertTrue('Failed to dispose prompt', prompt.isDisposed());
}


function testGetTitle() {
  stubs.replace(chrome.i18n, 'getMessage', function(msgId) {
    return msgId;
  });
  assertEquals('actionUserSpecified',
      prompt.getTitle_(e2e.ext.constants.Actions.USER_SPECIFIED));
  assertEquals('actionUnlockKeyring',
      prompt.getTitle_(e2e.ext.constants.Actions.GET_PASSPHRASE));
}


function testDisplayFailure() {
  prompt.decorate(document.documentElement);
  var errorDiv = document.getElementById(constants.ElementId.ERROR_DIV);

  prompt.displayFailure_(new Error('test failure'));
  assertEquals('test failure', errorDiv.textContent);
}


function testSelectAction() {
  var processedContent = false;
  stubs.replace(
      e2e.ext.ui.Prompt.prototype,
      'processSelectedContent_',
      function(action) {
        assertEquals('Failed to select action', 'test_action', action);
        processedContent = true;
      });

  prompt.selectAction_({
    target: {
      getValue: function() { return 'test_action'}
    }
  });

  assertTrue('Failed to process content', processedContent);
}


function testIfNoPassphrase() {
  prompt.pgpLauncher_ = new e2e.ext.Launcher();
  stubs.replace(e2e.ext.Launcher.prototype, 'hasPassphrase', function() {
    return false;
  });

  prompt.decorate(document.documentElement);
  prompt.processSelectedContent_(
      e2e.ext.constants.Actions.CONFIGURE_EXTENSION);
  assertContains('actionEnterPassphrase', document.body.textContent);
}


function testSetKeyringPassphrase() {
  var passphrase = 'test';
  stubs.set(prompt.pgpLauncher_, 'start',
      mockControl.createFunctionMock('start'));
  prompt.pgpLauncher_.start(passphrase);

  mockControl.$replayAll();

  prompt.decorate(document.documentElement);
  prompt.processSelectedContent_(constants.Actions.GET_PASSPHRASE);

  assertFalse(goog.dom.classlist.contains(
      goog.dom.getElement(e2e.ext.constants.ElementId.BODY),
      e2e.ext.constants.CssClass.TRANSPARENT));

  var dialog = prompt.getChildAt(1);
  dialog.dialogCallback_(passphrase);

  mockControl.$verifyAll();
}


function testSetKeyringPassphraseError() {
  var passphrase = 'test';
  stubs.set(prompt.pgpLauncher_, 'start',
      mockControl.createFunctionMock('start'));
  prompt.pgpLauncher_.start(passphrase).$throws(new Error('irrlevant'));

  mockControl.$replayAll();

  prompt.decorate(document.documentElement);
  prompt.processSelectedContent_(constants.Actions.GET_PASSPHRASE);

  var dialog = prompt.getChildAt(1);
  dialog.dialogCallback_(passphrase);

  assertEquals(3, prompt.getChildCount());

  mockControl.$verifyAll();
}


function testClose() {
  var closedWindow = false;
  stubs.replace(window, 'close', function() {
    closedWindow = true;
  });

  prompt.decorate(document.body);
  prompt.close();

  assertTrue(prompt.isDisposed());
  assertTrue(closedWindow);

  goog.array.forEach(
      document.querySelectorAll('textarea,input'), function(elem) {
        assertEquals('', elem.value);
      });
}


function testConfigureExtension() {
  stubs.setPath('chrome.tabs.create', mockControl.createFunctionMock());
  chrome.tabs.create(
      new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
        assertEquals('settings.html', arg.url);
        assertFalse(arg.active);
        return true;
      }),
      goog.nullFunction);

  mockControl.$replayAll();
  prompt.decorate(document.documentElement);
  prompt.processSelectedContent_(constants.Actions.CONFIGURE_EXTENSION);

  mockControl.$verifyAll();
}


function testNoOp() {
  stubs.set(prompt, 'close', mockControl.createFunctionMock());
  prompt.close();

  mockControl.$replayAll();

  prompt.decorate(document.documentElement);
  prompt.processSelectedContent_(constants.Actions.NO_OP);

  mockControl.$verifyAll();
}
