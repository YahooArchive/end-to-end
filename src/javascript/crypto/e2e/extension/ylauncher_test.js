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
 * @fileoverview Unit tests for the End-To-End launcher.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.yExtensionLauncherTest');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.yExtensionLauncher');
goog.require('e2e.openpgp.ContextImpl');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.require('goog.testing.mockmatchers.ArgumentMatcher');
goog.require('goog.testing.storage.FakeMechanism');

goog.setTestOnly();

var constants = e2e.ext.constants;
var launcher = null;
var mockControl = null;
var mockmatchers = goog.testing.mockmatchers;
var stubs = new goog.testing.PropertyReplacer();


function setUp() {
  fakeStorage = new goog.testing.storage.FakeMechanism();
  mockControl = new goog.testing.MockControl();
  context = new e2e.openpgp.ContextImpl(fakeStorage);

  e2e.ext.testingstubs.initStubs(stubs);
  stubs.setPath('chrome.browserAction.setIcon', goog.nullFunction);
  stubs.setPath('chrome.tabs.reload', goog.nullFunction);
  stubs.setPath('chrome.runtime.onMessage.addListener', goog.nullFunction);

  launcher = new e2e.ext.yExtensionLauncher(context, fakeStorage);
  launcher.getPreferences().setWelcomePageEnabled(false);
  launcher.start();
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  launcher = null;
}


function testGetSelectedContent() {
  var injectedScript = false;
  stubs.replace(chrome.tabs, 'executeScript', function(a, b, callback) {
    injectedScript = true;
    callback();
  });

  var sentMessage = false;
  stubs.replace(chrome.tabs, 'sendMessage', function(tabId) {
    assertNotUndefined(tabId);
    sentMessage = true;
  });

  launcher.getSelectedContent(function() {});
  assertTrue('Failed to inject content script', injectedScript);
  assertTrue(
      'Failed to query content script for selected content', sentMessage);

}


function testUpdateSelectedContent() {
  var content = 'some text';
  var origin = 'http://www.example.com';
  var executeScriptArg = new mockmatchers.SaveArgument(goog.isFunction);
  stubs.setPath('chrome.tabs.executeScript',
      mockControl.createFunctionMock('executeScript'));
  chrome.tabs.executeScript(mockmatchers.ignoreArgument,
      mockmatchers.ignoreArgument, executeScriptArg);

  var messageArg = new mockmatchers.SaveArgument();
  var tabIdArg = new mockmatchers.ArgumentMatcher(goog.isNumber);
  stubs.setPath('chrome.tabs.sendMessage',
      mockControl.createFunctionMock('sendMessage'));
  chrome.tabs.sendMessage(tabIdArg, messageArg);

  var callbackMock = mockControl.createFunctionMock('callbackMock');
  callbackMock();

  mockControl.$replayAll();

  launcher.updateSelectedContent(content, [], origin, false, callbackMock);
  executeScriptArg.arg();
  assertEquals('Sending incorrect content', content, messageArg.arg.value);
  mockControl.$verifyAll();
}


function testGetLastTab() {
  var tabId = 123;
  var tabs = [{id: tabId}];

  stubs.replace(chrome.tabs, 'query', function(req, callback) {
    callback(tabs);
  });

  stubs.replace(chrome.tabs, 'executeScript', function(a, b, callback) {
    callback();
  });

  var returnedIds = 0;
  launcher.getActiveTab_(function(returnedId) {
    assertEquals(tabId, returnedId);
    returnedIds++;
    tabs.splice(0, tabs.length);
  });

  launcher.getActiveTab_(function(returnedId) {
    assertEquals(tabId, returnedId);
    returnedIds++;
  });

  assertEquals(2, returnedIds);
}

function testShowWelcomeScreenEnabled() {
  var openedWindow = false;
  stubs.replace(launcher, 'createWindow', function() {
    openedWindow = true;
  });

  launcher.getPreferences().setWelcomePageEnabled(true);
  launcher.start();
  assertTrue('Failed to open the welcome screen', openedWindow);
}


function testShowWelcomeScreenDisabled() {
  var openedWindow = false;
  stubs.replace(launcher, 'createWindow', function() {
    openedWindow = true;
  });

  launcher.getPreferences().setWelcomePageEnabled(false);
  launcher.start();
  assertFalse('Incorrectly opening the welcome screen', openedWindow);
}


// @yahoo
function testStop() {
  stubs.set(launcher.ctxApi_, 'removeApi',
      mockControl.createFunctionMock('removeApi'));
  launcher.ctxApi_.removeApi();
  mockControl.$replayAll();

  launcher.start('test');
  launcher.stop();
  assertFalse(launcher.started_);
  assertNull(launcher.pgpContext_.keyring_);
  mockControl.$verifyAll();
}


// @yahoo
function testProxyMessage() {
  var message = {
    action: constants.Actions.GLASS_CLOSED,
    content: 'irrelevant',
    proxy: true};

  stubs.set(chrome.tabs, 'sendMessage',
            mockControl.createFunctionMock('sendMessage'));
  chrome.tabs.sendMessage(new goog.testing.mockmatchers.ArgumentMatcher(
      function(arg) {
        return goog.isNumber(arg);
      }
                          ),
                          new goog.testing.mockmatchers.ArgumentMatcher(
                              function(arg) {
                                assertObjectEquals({
                                  action: constants.Actions.GLASS_CLOSED,
                                  content: 'irrelevant'
                                }, arg);
                                return true;
                              }
                          ));
  mockControl.$replayAll();
  launcher.start('test');
  launcher.proxyMessage(message);
  mockControl.$verifyAll();
}
