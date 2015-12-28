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
 * @fileoverview Tests for the minimized keyring management UI.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.panels.KeyringMgmtMiniTest');

goog.require('e2e.async.Result');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.panels.KeyringMgmtMini');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events.EventType');
goog.require('goog.string');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.setTestOnly();

var constants = e2e.ext.constants;
var panel = null;
var stubs = new goog.testing.PropertyReplacer();
var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall(document.title);
var keys = {};


function setUp() {
  mockControl = new goog.testing.MockControl();
  e2e.ext.testingstubs.initStubs(stubs);

  stubs.setPath('chrome.runtime.getBackgroundPage', function(callback) {
    callback({
      launcher: {
        getContext: function() {
          return {
            getAllKeys: function() {
              return e2e.async.Result.toResult(keys);
            },
            getKeyringBackupData: function() {
              return e2e.async.Result.toResult({
                seed: [1, 2, 3, 4, 5],
                count: 0,
                timestamp: new Date(0)
              });
            }
          };
        }
      }
    });
  });
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();

  goog.dispose(panel);
  panel = null;
}


function testRender() {
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, goog.abstractMethod, goog.abstractMethod);
  panel.render(document.body);

  assertNotNull(document.querySelector('input[type="file"]'));
}


function testRenderWithoutExport() {
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.nullFunction, goog.abstractMethod, goog.abstractMethod);
  panel.render(document.body);

  assertTrue(goog.dom.classlist.contains(
      panel.getElementByClass(constants.CssClass.KEYRING_EXPORT),
      constants.CssClass.HIDDEN));
}


function testEmptyExport() {
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, goog.abstractMethod, goog.abstractMethod,
      goog.abstractMethod);
  panel.render(document.body);

  asyncTestCase.waitForAsync('Waiting for button to be disabled');
  asyncTestCase.timeout(function() {
    assertTrue('Export button should be hidden when there are no keys',
        goog.dom.classlist.contains(
        panel.getElementByClass(constants.CssClass.KEYRING_EXPORT),
        constants.CssClass.HIDDEN));
    assertTrue('Backup button should be hidden when there are no keys',
        goog.dom.classlist.contains(
        panel.getElementByClass(constants.CssClass.KEYRING_BACKUP),
        constants.CssClass.HIDDEN));
    assertTrue('FB Import button should be hidden when there are no keys',
        goog.dom.classlist.contains(
        panel.getElementByClass(constants.CssClass.FB_IMPORT),
        constants.CssClass.HIDDEN));

    asyncTestCase.continueTesting();
  }, 500);
}


function testNonEmptyExport() {
  keys = {'test@example.com': []};
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, goog.abstractMethod, goog.abstractMethod,
      goog.abstractMethod);
  panel.render(document.body);

  asyncTestCase.waitForAsync('Waiting for button to stay enabled');
  asyncTestCase.timeout(function() {
    assertFalse('Export button should not be hidden when there are keys',
        goog.dom.classlist.contains(
        panel.getElementByClass(constants.CssClass.KEYRING_EXPORT),
        constants.CssClass.HIDDEN));
    assertFalse('Backup button should not be hidden when there are keys',
        goog.dom.classlist.contains(
        panel.getElementByClass(constants.CssClass.KEYRING_BACKUP),
        constants.CssClass.HIDDEN));
    assertFalse('FB Import button should not be hidden when there are keys',
        goog.dom.classlist.contains(
        panel.getElementByClass(constants.CssClass.FB_IMPORT),
        constants.CssClass.HIDDEN));

    asyncTestCase.continueTesting();
  }, 500);
}


function testImportKeyring() {
  var filecontent = 'blah';
  var importedFile = false;

  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, function(file) {
        assertEquals(file, filecontent);
        importedFile = true;
      }, goog.abstractMethod, goog.abstractMethod, goog.abstractMethod);
  panel.render(document.body);

  stubs.replace(HTMLDivElement.prototype, 'querySelector', function(selector) {
    return (selector === 'input') ? {files: [filecontent]} :
        goog.dom.createElement('div');
  });

  panel.importKeyring_();
  assertTrue(importedFile);
}


function testImportFbKey() {
  var username = 'alex.stamos';
  var importedFile = false;
  var userKey = 'blah';

  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, function(text) {
        assertEquals(userKey, text);
        importedFile = true;
      }, goog.abstractMethod, goog.abstractMethod, goog.abstractMethod);

  stubs.replace(panel, 'sendFbRequest_', function(user, cb, eb) {
    if (user === username) {
      cb(userKey);
    }
  });

  var errorDiv = goog.dom.createElement('div');
  errorDiv.id = constants.ElementId.ERROR_DIV;
  document.body.appendChild(errorDiv);
  panel.render(document.body);
  var div = document.getElementById(constants.ElementId.FB_IMPORT_DIV);
  div.querySelector('input').value = username;
  div.querySelector('button.action').click();
  assertTrue(importedFile);
}


function testUpdateKeyringPassphrase() {
  var newPass = 'passphrase';
  var updatePassCallback = mockControl.createFunctionMock('updatePass');
  updatePassCallback(newPass);

  mockControl.$replayAll();

  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, goog.abstractMethod, updatePassCallback);
  panel.render(document.body);

  goog.dom.getElementByClass(
      constants.CssClass.PASSPHRASE,
      goog.dom.getElement(
          constants.ElementId.KEYRING_PASSPHRASE_CHANGE_DIV)).value = newPass;
  goog.dom.getElementByClass(
      constants.CssClass.PASSPHRASE,
      goog.dom.getElement(
          constants.ElementId.KEYRING_PASSPHRASE_CONFIRM_DIV)).value = newPass;
  panel.updateKeyringPassphrase_();

  mockControl.$verifyAll();
}


function testUpdateKeyringPassphraseMismatch() {
  stubs.replace(window, 'alert', mockControl.createFunctionMock('alert'));
  window.alert('keyMgmtPassphraseMismatchLabel');

  var updatePassCallback = mockControl.createFunctionMock('updatePass');

  mockControl.$replayAll();

  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, goog.abstractMethod, updatePassCallback);
  panel.render(document.body);

  goog.dom.getElementByClass(
      constants.CssClass.PASSPHRASE,
      goog.dom.getElement(
          constants.ElementId.KEYRING_PASSPHRASE_CHANGE_DIV)).value = 'value1';
  goog.dom.getElementByClass(
      constants.CssClass.PASSPHRASE,
      goog.dom.getElement(
          constants.ElementId.KEYRING_PASSPHRASE_CONFIRM_DIV)).value = 'value2';
  panel.updateKeyringPassphrase_();

  mockControl.$verifyAll();
}



function testSetKeyringEncrypted() {
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, goog.abstractMethod, goog.abstractMethod);
  panel.render(document.body);

  panel.setKeyringEncrypted(true);
  assertContains('keyMgmtChangePassphraseLabel', document.body.textContent);
  assertNotContains('keyMgmtAddPassphraseLabel', document.body.textContent);

  panel.setKeyringEncrypted(false);
  assertContains('keyMgmtAddPassphraseLabel', document.body.textContent);
  assertNotContains('keyMgmtChangePassphraseLabel', document.body.textContent);
}


function testShowKeyringMgmtForm() {
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(
      goog.abstractMethod, goog.abstractMethod, goog.abstractMethod);
  panel.render(document.body);

  var importDiv = goog.dom.getElement(constants.ElementId.KEYRING_IMPORT_DIV);
  var optionsDiv = goog.dom.getElement(constants.ElementId.KEYRING_OPTIONS_DIV);
  assertTrue(goog.dom.classlist.contains(importDiv, constants.CssClass.HIDDEN));

  panel.showKeyringMgmtForm_(constants.ElementId.KEYRING_IMPORT_DIV);
  assertTrue(
      goog.dom.classlist.contains(optionsDiv, constants.CssClass.HIDDEN));
  panel.showKeyringMgmtForm_(constants.ElementId.KEYRING_OPTIONS_DIV);
  assertTrue(goog.dom.classlist.contains(importDiv, constants.CssClass.HIDDEN));
  panel.showKeyringMgmtForm_(constants.ElementId.KEYRING_PASSPHRASE_CHANGE_DIV);
}


function testKeyringAutoImport() {
  var run = false;

  panel = new e2e.ext.ui.panels.KeyringMgmtMini(goog.abstractMethod,
      goog.abstractMethod, goog.abstractMethod);
  stubs.setPath('panel.__proto__.importKeyring_', function() { run = true; });
  panel.render(document.body);

  var importDiv = goog.dom.getElement(constants.ElementId.KEYRING_IMPORT_DIV);
  var input = goog.dom.getElementByClass(constants.CssClass.ACTION, importDiv);
  input.dispatchEvent(new Event(goog.events.EventType.CHANGE));

  assertTrue(run);
}


function testBackupWindow() {
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(goog.abstractMethod,
      goog.abstractMethod, goog.abstractMethod);
  panel.render(document.body);

  var backupButton = goog.dom.getElementByClass(
      constants.CssClass.KEYRING_BACKUP);
  var called = false;

  stubs.setPath('goog.ui.Dialog.prototype.setVisible', function() {
    called = true;
  });

  assertFalse(called);
  backupButton.dispatchEvent(new Event(goog.events.EventType.CLICK));
  assertTrue(called);
}


function testContent() {
  panel = new e2e.ext.ui.panels.KeyringMgmtMini(goog.nullFunction,
      goog.nullFunction, goog.nullFunction, goog.nullFunction,
      goog.abstractMethod, 'foo', 'blah');
  panel.render(document.body);

  assertEquals(1, document.body.textContent.indexOf('foo'));
  assertTrue(goog.string.endsWith(document.body.textContent, 'blah'));
}
