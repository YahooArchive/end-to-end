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
 * @fileoverview Tests for the setup page.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.SetupTest');

goog.require('e2e.ext.Launcher');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.Setup');
goog.require('e2e.ext.ui.panels.GenerateKey');
goog.require('e2e.ext.ui.panels.KeyringMgmtMini');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.setTestOnly();

var constants = e2e.ext.constants;
var panels = e2e.ext.ui.panels;
var launcher = null;
var mockControl = null;
var page = null;
var stubs = new goog.testing.PropertyReplacer();
var testCase = goog.testing.AsyncTestCase.createAndInstall();

var PUBLIC_KEY_ASCII = ['-----BEGIN PGP PUBLIC KEY BLOCK-----',
'Charset: UTF-8',
'',
'xv8AAABSBAAAAAATCCqGSM49AwEHAgMES1pZWXzDJ6KuifGWGevDXVkOBa3EKEWp',
'g3YJd19BLLqE1MWIxTDf1WTDWk3wUB12EhFd8+JJlWSWjjIs7Wswuc3/AAAAEDx0',
'ZXN0QHlhaG9vLmNvbT7C/wAAAI0EEBMIAD//AAAABYJU1Akm/wAAAAKLCf8AAAAJ',
'kP2DcLsRCyVE/wAAAAWVCAkKC/8AAAADlgEC/wAAAAKbA/8AAAACngEAAPsQAQDN',
'P13mfGKy4VeAn1XBPCXsb6a3on8to79weltl74iXiwD/e6dVB19ZnoevA8/hFMQD',
'2tzCsQoej/DCtVdnsZgK5HbO/wAAAFYEAAAAABIIKoZIzj0DAQcCAwQXmzc0537b',
'BA6NL5Ceqgh7QmCnKCVZV0IvvK3zzddpWnTOJhs4etrlDrXzbvTCDIz6oqEGvgDO',
'Rgy21aXu/GZ/AwEIB8L/AAAAbQQYEwgAH/8AAAAFglTUCSb/AAAACZD9g3C7EQsl',
'RP8AAAACmwwAABtgAP0WuM3nw/U/mzS6ccSr29J8d3C8W1HjUrmtSInG9kAY8QD/',
'XDI3oj1PnelBgEM0OpgkQExVHPNBgC0wQhN1q7jIM8Q=',
'=DnTP',
'-----END PGP PUBLIC KEY BLOCK-----'].join('\n');

function setUp() {
  mockControl = new goog.testing.MockControl();

  // Hack to make test not crash chrome. No idea why this works.
  window.chrome = {};

  e2e.ext.testingstubs.initStubs(stubs);
  localStorage.clear();

  launcher = new e2e.ext.Launcher();
  stubs.setPath('chrome.runtime.getBackgroundPage', function(callback) {
    callback({launcher: launcher});
  });
  launcher.start();
  page = new e2e.ext.ui.Setup();
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  goog.dispose(page);
}


function testRender() {
  page.decorate(document.documentElement);
  goog.array.forEach(
    ['SETUP_TUTORIAL', 'SETUP_TUTORIAL_BUTTON', 'SETUP_PASSPHRASE_TUTORIAL',
     'SETUP_GENERATE_KEY', 'SETUP_RESTORE_KEY', 'SETUP_INTRO',
     'SETUP_BACKUP_KEY', 'SETUP_PASSPHRASE', 'WELCOME_CONTENT_INTRO',
     'WELCOME_CONTENT_BACKUP', 'WELCOME_CONTENT_NOVICE',
     'WELCOME_CONTENT_ADVANCED', 'WELCOME_CONTENT_PASSPHRASE', 'SETUP_BUTTON',
     'CALLBACK_DIALOG'], function(elem) {
      assertNotNull(goog.dom.getElement(constants.ElementId[elem]));
     });
}

function testIntroDefault() {
  stubs.replace(page, 'showPage_', mockControl.createFunctionMock('showPage'));
  page.showPage_(new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
    assertEquals('setup-generate-key', arg);
    return true;
  }));
  mockControl.$replayAll();

  page.decorate(document.documentElement);
  goog.dom.getElement(constants.ElementId.WELCOME_CONTENT_INTRO).querySelector(
    'button.action').click();
  mockControl.$verifyAll();
}

function testIntroRestore() {
  stubs.replace(page, 'showPage_', mockControl.createFunctionMock('showPage'));
  page.showPage_(new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
    assertEquals('setup-restore-key', arg);
    return true;
  }));
  mockControl.$replayAll();

  page.decorate(document.documentElement);
  goog.dom.getElement(constants.ElementId.WELCOME_CONTENT_INTRO).querySelector(
    'button.cancel').click();
  mockControl.$verifyAll();
}

function testRestoreKey() {
  stubs.replace(panels.KeyringMgmtMini.prototype, 'showRestoreWindow_',
                function() {
    page.keyringMgmt_.restoreKeyringCallback_('yan@mit.edu');
  });

  stubs.replace(page, 'afterRestoreKeyring_',
                mockControl.createFunctionMock('afterRestoreKeyring'));
  page.afterRestoreKeyring_(new goog.testing.mockmatchers.ArgumentMatcher(
      function(arg) {
        assertEquals('yan@mit.edu', arg);
        return true;
  }));

  mockControl.$replayAll();

  page.decorate(document.documentElement);
  page.keyringMgmt_.getElement().
      querySelector('button.keyring-restore').click();
  mockControl.$verifyAll();
}

function testCancelRestore() {
  stubs.replace(e2e.ext.ui.Setup.prototype,
                'showPage_', mockControl.createFunctionMock('showPage'));
  page.showPage_(new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
    assertEquals('setup-intro', arg);
    return true;
  }));
  mockControl.$replayAll();

  page.decorate(document.documentElement);
  page.keyringMgmt_.getElement().
      querySelector('.keyring-cancel').click();
  mockControl.$verifyAll();
}

function testGenerateKey() {
  stubs.replace(window, 'alert', goog.nullFunction);
  stubs.replace(panels.GenerateKey.prototype, 'sendKeys', function(keys, cb) {
    assertEquals('<test@yahoo.com>', keys[0].uids[0]);
    cb();
  });
  stubs.replace(page, 'showPage_', mockControl.createFunctionMock('showPage'));
  page.showPage_(new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
    assertEquals('setup-backup-key', arg);
    return true;
  }));
  mockControl.$replayAll();

  page.decorate(document.documentElement);
  goog.dom.getElement('welcome-content-novice').querySelector('input').value =
      'test@yahoo.com';
  goog.dom.getElement('welcome-content-novice').querySelector('button').click();

  testCase.waitForAsync('waiting for key to be generated');

  window.setTimeout(function() {
    mockControl.$verifyAll();
    testCase.continueTesting();
  }, 500);
}

function testGenerateBadKey() {
  stubs.replace(window, 'alert', mockControl.createFunctionMock('alert'));
  window.alert(new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
    assertContains('invalid', arg);
    return true;
  }));
  mockControl.$replayAll();

  page.decorate(document.documentElement);
  goog.dom.getElement('welcome-content-novice').querySelector('input').value =
      'test@foo.com';
  goog.dom.getElement('welcome-content-novice').querySelector('button').click();

  testCase.waitForAsync('waiting for key to be generated');

  window.setTimeout(function() {
    mockControl.$verifyAll();
    testCase.continueTesting();
  }, 500);
}

function testShowBackup() {
  stubs.replace(page, 'showPage_', mockControl.createFunctionMock('showPage'));
  page.showPage_(new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
    assertEquals('setup-passphrase', arg);
    return true;
  }));
  mockControl.$replayAll();

  page.decorate(document.documentElement);
  goog.dom.getElement('setup-backup-key').querySelector('button').click();
  mockControl.$verifyAll();
}

function testShowPassphraseTutorial() {
  stubs.replace(page, 'showPage_', mockControl.createFunctionMock('showPage'));
  page.showPage_(new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
    assertEquals('setup-tutorial', arg);
    return true;
  }));
  mockControl.$replayAll();

  page.decorate(document.documentElement);

  goog.dom.getElement('setup-passphrase').querySelector(
    'button.keyring-cancel').click();
  mockControl.$verifyAll();
}

function testImportKeyring() {
  stubs.replace(e2e.ext.utils, 'readFile',
      mockControl.createFunctionMock('readFile'));
  stubs.replace(chrome.i18n, 'getMessage', function(a, b) {
    return a + (b ? b : '');
  });
  var readCallbackArg =
      new goog.testing.mockmatchers.SaveArgument(goog.isFunction);
  e2e.ext.utils.readFile(
      goog.testing.mockmatchers.ignoreArgument, readCallbackArg);

  stubs.setPath('e2e.ext.actions.GetKeyDescription.prototype.execute',
      mockControl.createFunctionMock());
  var keyDescriptionArg =
      new goog.testing.mockmatchers.SaveArgument(goog.isFunction);
  e2e.ext.actions.GetKeyDescription.prototype.execute(
      goog.testing.mockmatchers.ignoreArgument,
      goog.testing.mockmatchers.ignoreArgument,
      page,
      keyDescriptionArg,
      goog.testing.mockmatchers.ignoreArgument);

  mockControl.$replayAll();

  page.decorate(document.documentElement);
  page.importKeyring_('irrelevant');
  readCallbackArg.arg(PUBLIC_KEY_ASCII);
  keyDescriptionArg.arg('');

  testCase.waitForAsync('waiting for keyring to be imported');
  window.setTimeout(function() {
    assertContains('welcomeKeyImport', document.body.textContent);
    for (var childIdx = 0; childIdx < page.getChildCount(); childIdx++) {
      var child = page.getChildAt(childIdx);
      if (child instanceof e2e.ext.ui.dialogs.Generic) {
        child.dialogCallback_();
      }
    }
    mockControl.$verifyAll();
    testCase.continueTesting();
  }, 500);
}


function testUpdateKeyringPassphrase() {
  stubs.set(launcher.pgpContext_, 'changeKeyRingPassphrase',
      mockControl.createFunctionMock('changeKeyRingPassphrase'));
  launcher.pgpContext_.changeKeyRingPassphrase('testPass');

  stubs.set(
      launcher.pgpContext_, 'isKeyRingEncrypted', function() {return true;});

  mockControl.$replayAll();
  page.decorate(document.documentElement);
  page.updateKeyringPassphrase_('testPass');

  for (var childIdx = 0; childIdx < page.getChildCount(); childIdx++) {
    var child = page.getChildAt(childIdx);
    if (child instanceof e2e.ext.ui.dialogs.Generic) {
      child.dialogCallback_();
    }
  }

  mockControl.$verifyAll();
}


function testRenderPassphraseCallback() {
  var passphrase = 'test';

  stubs.replace(chrome.i18n, 'getMessage', function(a, b) {
    return b;
  });

  var callback = mockControl.createFunctionMock('callback');
  callback(passphrase);

  mockControl.$replayAll();
  page.decorate(document.documentElement);

  page.renderPassphraseCallback_('test_uid', callback);

  assertContains('test_uid', document.body.textContent);
  for (var childIdx = 0; childIdx < page.getChildCount(); childIdx++) {
    var child = page.getChildAt(childIdx);
    if (child instanceof e2e.ext.ui.dialogs.Generic) {
      child.dialogCallback_(passphrase);
    }
  }
  assertNotContains('test_uid', document.body.textContent);

  mockControl.$verifyAll();
}
