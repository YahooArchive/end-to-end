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
 * @fileoverview Unit tests for the Compose Glass.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.ComposeGlassTest');

goog.require('e2e.async.Result');
goog.require('e2e.ext.ExtensionLauncher');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.ComposeGlass');
goog.require('e2e.ext.utils');
goog.require('e2e.ext.utils.text');
goog.require('e2e.openpgp.ContextImpl');
goog.require('e2e.openpgp.asciiArmor');
goog.require('e2e.openpgp.block.factory');
/** @suppress {extraRequire} intentionally importing all signer functions */
goog.require('e2e.signer.all');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.require('goog.testing.mockmatchers.ArgumentMatcher');
goog.require('goog.testing.storage.FakeMechanism');

goog.setTestOnly();

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall(document.title);
asyncTestCase.stepTimeout = 2000;

var constants = e2e.ext.constants;
var mockControl = null;
var composeglass = null;
var launcher = null;

var stubs = new goog.testing.PropertyReplacer();

var ORIGIN = 'https://us-mg5.mail.yahoo.com';
var USER_ID_2 = 'Drew Hintz <adhintz@google.com>';
var USER_ID = 'test 4';

// The draft sent by the provider. Note that it uses email addresses, not uids.
var draft = {body: 'plaintext message',
  to: ['test 4', 'adhintz@google.com'], from: USER_ID};

var PRIVATE_KEY_ASCII = // userid of test 4
    '-----BEGIN PGP PRIVATE KEY BLOCK-----\n' +
    'Version: GnuPG v1.4.11 (GNU/Linux)\n' +
    '\n' +
    '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\n' +
    '1KwNtVw=\n' +
    '=wHzz\n' +
    '-----END PGP PRIVATE KEY BLOCK-----';


var PUBLIC_KEY_ASCII = // userid of test 4
    '-----BEGIN PGP PUBLIC KEY BLOCK-----\n' +
    'Version: GnuPG v1.4.11 (GNU/Linux)\n' +
    '\n' +
    'mI0EUcy6DgEEAJb0T7gQlfKQWmR0dLUrueRMVy8UemcmxsdIH30/HqJvqO6xU0lK\n' +
    'NaFtaVxBdenAMpEooi1EcTi/bOKfz36FY/FARTiXv1LXuLzFJdPyjTYjh7tw+uOP\n' +
    'UlLJCTZikgrnM07txTUiVVEetOa+unyKn17EX0PlSpAbGZedyO0nGwXzABEBAAG0\n' +
    'BnRlc3QgNIi4BBMBAgAiBQJRzLoOAhsDBgsJCAcDAgYVCAIJCgsEFgIDAQIeAQIX\n' +
    'gAAKCRAG/5ysCS2oCL2SA/9EV9j3T/TM3VRD0NvNySHodcxCP1BF0zm/M84I/WHQ\n' +
    'sGKmHStfCqqEGruB8E6NHQMJwNp1TzcswuxE0wiTJiXKe3w3+GZhPHdW5zcgiMKK\n' +
    'YLn80Tk6fUMx1zVZtXlSBYCN5Op/axjQRyb+fGnXOhmboqQodYaWS7qhJWQJilH6\n' +
    'iriNBFHMug4BBADDTMshHtyYhLmWC7793FlOFl5tkcEfdFKJRm30k/9yky4cuz//\n' +
    'Xe4uXM72SaTI1Dfi6UIz5ZuFTxw3bnAXav+SV4Q4dZo0hb4jU8YaQfDL4TsRp7uO\n' +
    '6iqxd8nlsh9JnBKE6Fk/CW5FoMZZ3/yEm3pq924Uv2AZlO6dafgXecyqNQARAQAB\n' +
    'iJ8EGAECAAkFAlHMug4CGwwACgkQBv+crAktqAhENwQAkMY/nds36KgzwfMPpxtB\n' +
    'aq8GbrUqY1r8lBl6a/bi8qeOuEgQmIxM2OpVPtL04c1c1hLflPCi1SQUlCIh3DkE\n' +
    'GQIcy0/wxUZdCvZK0mF5nZSq6tez3CwqbeOA4nBOLwbxho50VqxBpR4qypYrB2ip\n' +
    'ykxlwiqudEe0sE2b1KwNtVw=\n' +
    '=nHBL\n' +
    '-----END PGP PUBLIC KEY BLOCK-----';


var PUBLIC_KEY_ASCII_2 =  // user ID of 'Drew Hintz <adhintz@google.com>'
    '-----BEGIN PGP PUBLIC KEY BLOCK-----\n' +
    'Charset: UTF-8\n' +
    '\n' +
    'xv8AAABSBFP3bHYTCCqGSM49AwEHAgMECt6MVqa43Ab248CosK/cy664pkL/9XvC\n' +
    '0O2K0O1Jh2qau7ll3Q9vssdObSwX0EaiMm4Dvegxr1z+SblWSFV4x83/AAAAH0Ry\n' +
    'ZXcgSGludHogPGFkaGludHpAZ29vZ2xlLmNvbT7C/wAAAGYEEBMIABj/AAAABYJT\n' +
    '92x2/wAAAAmQ8eznwfj7hkMAADA9AQCWE4jmpmA5XRN1tZduuz8QwtxGZOFurpAK\n' +
    '6RCzKDqS8wEAx9eBxXLhKB4xm9xwPdh0+W6rbsvf58FzKjlxrkUfuxTO/wAAAFYE\n' +
    'U/dsdhIIKoZIzj0DAQcCAwQ0M6kFa7VaVmt2PRdOUdZWrHp6CZZglTVQi1eyiXB/\n' +
    'nnUUbH+qrreWTD7W9RxRtr0IqAYssLG5ZoWsXa5jQC3DAwEIB8L/AAAAZgQYEwgA\n' +
    'GP8AAAAFglP3bHf/AAAACZDx7OfB+PuGQwAAkO4BALMuXsta+bCOvzSn7InOs7wA\n' +
    '+OmDN5cv1cR/SsN5+FkLAQCmmBa/Fe76gmDd0RjvpQW7pWK2zXj3il6HYQ2NsWlI\n' +
    'bQ==\n' +
    '=LlKd\n' +
    '-----END PGP PUBLIC KEY BLOCK-----';


function setUp() {
  fakeStorage = new goog.testing.storage.FakeMechanism();
  mockControl = new goog.testing.MockControl();

  context = new e2e.openpgp.ContextImpl(fakeStorage);
  // No passphrase.
  e2e.async.Result.getValue(context.initializeKeyRing(''));

  e2e.ext.testingstubs.initStubs(stubs);
  // @yahoo, the following are required by yExtensionLauncher
  stubs.setPath('chrome.browserAction.setIcon', goog.nullFunction);
  stubs.setPath('chrome.tabs.reload', goog.nullFunction);
  stubs.setPath('chrome.runtime.onMessage.addListener', goog.nullFunction);

  var oldExtractValidEmail = e2e.ext.utils.text.extractValidEmail;
  var oldExtractValidYahooEmail = e2e.ext.utils.text.extractValidYahooEmail;
  stubs.replace(e2e.ext.utils.text, 'extractValidEmail', function(recipient) {
    if (recipient == USER_ID) {
      return recipient;
    } else {
      return oldExtractValidEmail(recipient);
    }
  });
  stubs.replace(e2e.ext.utils.text, 'extractValidYahooEmail',
                function(recipient) {
        if (recipient == USER_ID) {
          return null;
        } else {
          return oldExtractValidYahooEmail(recipient);
        }
      });


  composeglass = new e2e.ext.ui.ComposeGlass(draft, 'resize', ORIGIN, 'foo');
  launcher = new e2e.ext.ExtensionLauncher(context, fakeStorage);
  launcher.start();

  stubs.replace(e2e.ext.utils, 'sendProxyRequest', goog.nullFunction);

  stubs.setPath('chrome.runtime.getBackgroundPage', function(callback) {
    callback({launcher: launcher});
  });

  stubs.replace(e2e.ext.utils, 'sendExtensionRequest', function(args, cb) {
    cb = cb || goog.nullFunction;
    launcher.ctxApi_.executeAction_(cb, args);
  });

  stubs.replace(e2e.ext.ExtensionLauncher.prototype, 'hasPassphrase',
      function() {
        return true;
      });
}


function tearDown() {
  stubs.reset();
  launcher = null;
  mockControl.$tearDown();
  composeglass.dispose();
  goog.dispose(composeglass);
}


function testRender() {
  populatePgpKeys(PUBLIC_KEY_ASCII_2);
  composeglass.decorate(document.documentElement);
  asyncTestCase.waitForAsync('Waiting for keys to be imported');
  var textarea = document.querySelector('textarea');
  window.setTimeout(function() {
    textarea.focus();
    assertArrayEquals(['test 4', 'adhintz@google.com'],
                      composeglass.allAvailableRecipients_);
    assertEquals(USER_ID,
                 goog.dom.getElement(constants.ElementId.SIGNER_SELECT).value);
    asyncTestCase.continueTesting();
  }, 200);
}


function testRenderWithMissingRecipient() {
  populatePgpKeys();
  stubs.replace(composeglass, 'fetchKeys_',
                mockControl.createFunctionMock('insertMessageIntoPage_'));
  composeglass.fetchKeys_(new goog.testing.mockmatchers.ArgumentMatcher(
      function(arg) {
        arg([], ['adhintz@google.com']);
        return true;
      }));
  mockControl.$replayAll();

  composeglass.decorate(document.documentElement);
  asyncTestCase.waitForAsync('Waiting for keys to be imported');
  var textarea = document.querySelector('textarea');
  window.setTimeout(function() {
    textarea.focus();

    document.querySelector('button.insert').click();

    assertArrayEquals(['test 4'],
                      composeglass.allAvailableRecipients_);
    var dialog = goog.dom.getElement('callbackDialog');
    assertContains('adhintz@google.com', dialog.textContent);
    mockControl.$verifyAll();
    asyncTestCase.continueTesting();
  }, 200);
}


function testRenderAndImportKey() {
  populatePgpKeys();
  stubs.replace(composeglass, 'fetchKeys_', function(cb) {
    populatePgpKeys(PUBLIC_KEY_ASCII_2);
    cb(['adhintz@google.com'], []);
  });
  composeglass.decorate(document.documentElement);
  asyncTestCase.waitForAsync('Waiting for keys to be imported');
  var textarea = document.querySelector('textarea');
  window.setTimeout(function() {
    textarea.focus();
    window.setTimeout(function() {
      assertArrayEquals(['test 4', 'adhintz@google.com'],
                        composeglass.allAvailableRecipients_);
      asyncTestCase.continueTesting();
    }, 200);
  }, 200);
}


function testEncrypt() {
  populatePgpKeys(PUBLIC_KEY_ASCII_2);
  stubs.replace(composeglass, 'insertMessageIntoPage_',
                mockControl.createFunctionMock('insertMessageIntoPage_'));
  composeglass.insertMessageIntoPage_(
      goog.testing.mockmatchers.ignoreArgument,
      new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
        assertContains('-----BEGIN PGP MESSAGE', arg);
        var parsed = e2e.openpgp.asciiArmor.parse(arg);
        var block = e2e.openpgp.block.factory.parseByteArray(parsed.data,
                                                             parsed.charset);
        // Make sure message was encrypted to both sender and receiver
        assertEquals(2, block.eskPackets.length);
        return true;
      }));
  mockControl.$replayAll();

  composeglass.decorate(document.documentElement);
  var protectBtn = document.querySelector('button.insert');
  protectBtn.click();

  asyncTestCase.waitForAsync('Waiting for message to be encrypted.');
  window.setTimeout(function() {
    mockControl.$verifyAll();
    asyncTestCase.continueTesting();
  }, 500);
}


function testSendUnsignedPlaintext() {
  stubs.replace(composeglass, 'shouldSignMessage_', function() {
    return false;
  });
  var message = 'foo';
  stubs.replace(composeglass, 'insertMessageIntoPage_',
                mockControl.createFunctionMock('insertMessageIntoPage_'));
  composeglass.insertMessageIntoPage_(
      goog.testing.mockmatchers.ignoreArgument,
      new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
        assertEquals('foo', arg);
        return true;
      }));
  stubs.replace(composeglass, 'handleMissingPublicKeys_',
                mockControl.createFunctionMock('handleMissingPublicKeys_'));
  composeglass.handleMissingPublicKeys_(
      goog.testing.mockmatchers.ignoreArgument,
      new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
        arg();
        return true;
      })
  );
  mockControl.$replayAll();

  composeglass.recipients = ['adhintz@google.com', 'yan@yahoo-inc.com'];

  composeglass.decorate(document.documentElement);

  var textarea = document.querySelector('textarea');
  textarea.value = message;

  var protectBtn = document.querySelector('button.insert');
  protectBtn.click();

  asyncTestCase.waitForAsync('Waiting for message to be inserted.');
  window.setTimeout(function() {
    mockControl.$verifyAll();
    asyncTestCase.continueTesting();
  }, 200);
}


function testSendSignedPlaintext() {
  populatePgpKeys();
  var message = 'foo';
  stubs.replace(composeglass, 'insertMessageIntoPage_',
                mockControl.createFunctionMock('insertMessageIntoPage_'));
  composeglass.insertMessageIntoPage_(
      goog.testing.mockmatchers.ignoreArgument,
      new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
        assertContains('-----BEGIN PGP SIGNED MESSAGE', arg);
        return true;
      }));

  stubs.replace(composeglass, 'handleMissingPublicKeys_',
                mockControl.createFunctionMock('handleMissingPublicKeys_'));
  composeglass.handleMissingPublicKeys_(
      goog.testing.mockmatchers.ignoreArgument,
      new goog.testing.mockmatchers.ArgumentMatcher(function(arg) {
        arg();
        return true;
      })
  );
  mockControl.$replayAll();

  composeglass.recipients = ['test@yahoo-inc.com', 'yan@yahoo-inc.com'];

  stubs.replace(composeglass, 'shouldSignMessage_', function() {return true;});
  composeglass.decorate(document.documentElement);

  var textarea = document.querySelector('textarea');
  textarea.value = message;

  var protectBtn = document.querySelector('button.insert');
  protectBtn.click();

  asyncTestCase.waitForAsync('Waiting for message to be inserted.');
  window.setTimeout(function() {
    mockControl.$verifyAll();
    asyncTestCase.continueTesting();
  }, 200);
}


function testDisplayFailure() {
  composeglass.decorate(document.documentElement);
  var errorDiv = document.getElementById(constants.ElementId.ERROR_DIV);

  composeglass.displayFailure_(new Error('test failure'));
  assertEquals('test failure', errorDiv.textContent);
}


function testClose() {
  composeglass.decorate(document.body);
  composeglass.close();

  assertTrue(composeglass.isDisposed());

  goog.array.forEach(
      document.querySelectorAll('textarea,input'), function(elem) {
        assertEquals('', elem.value);
      });
}


function populatePgpKeys(opt_key) {
  var pgpContext = launcher.getContext();

  var TEST_PWD_CALLBACK = function(uid) {
    return e2e.async.Result.toResult('test');
  };

  asyncTestCase.waitForAsync('Importing private key.');
  pgpContext.importKey(TEST_PWD_CALLBACK, PRIVATE_KEY_ASCII)
      .addCallback(function() {
        asyncTestCase.waitForAsync('Importing public key.');
        pgpContext.importKey(TEST_PWD_CALLBACK, PUBLIC_KEY_ASCII)
            .addCallback(function() {
              if (opt_key) {
                asyncTestCase.waitForAsync('Importing opt key.');
                pgpContext.importKey(TEST_PWD_CALLBACK, opt_key);
              }
            });
      });
}
