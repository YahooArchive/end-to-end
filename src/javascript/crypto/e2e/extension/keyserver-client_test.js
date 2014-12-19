/** @suppress {extraProvide} */
goog.provide('e2e.ext.KeyserverClientTest');

goog.require('e2e.ext.Launcher');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.keyserver.Client');
goog.require('e2e.ext.testingstubs');
goog.require('goog.dom');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.setTestOnly();

var constants = e2e.ext.constants;
var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall(document.title);
asyncTestCase.stepTimeout = 2000;

var client;
var mockControl = null;
var mockmatchers = goog.testing.mockmatchers;
var stubs = new goog.testing.PropertyReplacer();
var div = goog.dom.createElement('div');
div.id = constants.ElementId.CALLBACK_DIALOG;
var launcher = null;

var TEST_RESPONSE = {kauth_sig: 'TivE3M4ANVLXOh7HDcmd3EdSAYtZmb9e15SgARi_h9b5uyawTmx_UvqHGdmE-p6sXhaC0h1hhlhKY222Ob99iZ6nDpEkUTNRQFnXBwi-8NZ6WIdHJeu3vSIU8IkZM6Hw', data: 'test'};

function setUp() {
  document.body.appendChild(div);
  window.localStorage.clear();
  e2e.ext.testingstubs.initStubs(stubs);
  launcher = new e2e.ext.Launcher();
  launcher.start();
  stubs.setPath('chrome.runtime.getBackgroundPage', function(callback) {
    callback({launcher: launcher});
  });
  stubs.setPath('chrome.cookies.get', function(details, cb) {
    cb({value: 'irrelevant'});
  });
  stubs.replace(e2e.ext.utils, 'sendExtensionRequest',
                function(request, cb) {
                  launcher.ctxApi_.executeAction_(cb, request);
                });

  stubs.replace(e2e.ext.Launcher.prototype, 'hasPassphrase', function() {
    return true;
  });
  mockControl = new goog.testing.MockControl();
  client = new e2e.ext.keyserver.Client('https://mail.yahoo.com/');
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  client = undefined;
}


function testVerifyResponse() {
  assertTrue(client.verifyResponse_(TEST_RESPONSE));
}


function testSendKey() {
  var myUserid = 'yan@mit.edu';
  var myKey = 'foo';
  stubs.replace(e2e.ext.keyserver.Client.prototype, 'fetchKey_',
                function(userid, cb) {
                  if (userid === myUserid) {
                    cb({data: JSON.stringify({keys: {12345: 'irrelevant'},
                      userid: 'yan@mit.edu', timestamp: 0}),
                kauth_sig: 'irrelevant'});
                  }
                });
  stubs.replace(goog.math, 'randomInt', function() {
    return 314;
  });
  stubs.replace(XMLHttpRequest.prototype, 'open',
      mockControl.createFunctionMock('open'));
  XMLHttpRequest.prototype.open(
      new mockmatchers.ArgumentMatcher(function(arg) {
        assertEquals('POST', arg);
        return true;
      }), new mockmatchers.ArgumentMatcher(function(arg) {
        assertEquals('http://localhost:5000/v1/yan@mit.edu/314', arg);
        return true;
      }), new mockmatchers.ArgumentMatcher(function(arg) {
        assertTrue(arg);
        return true;
      })
  );
  stubs.replace(XMLHttpRequest.prototype, 'setRequestHeader',
                goog.nullFunction);
  stubs.replace(XMLHttpRequest.prototype, 'send',
      mockControl.createFunctionMock('send'));
  XMLHttpRequest.prototype.send(
      new mockmatchers.ArgumentMatcher(function(arg) {
        return (arg === myKey);
      }
      ));
  mockControl.$replayAll();

  client.sendKey(myUserid, myKey);
  mockControl.$verifyAll();
}


function testFetchAndImportKeys() {
  var userId = 'adhintz@google.com';
  var sig = 'irrelevant';
  var time = new Date().getTime();
  var key =  // user ID of 'Drew Hintz <adhintz@google.com>'
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
  var keydata = {keys: {12345: key},
        userid: userId, timestamp: time};

  stubs.replace(e2e.ext.keyserver.Client.prototype, 'sendRequest_',
                function(method, path, cb) {
                  if (method === 'GET' && path === userId) {
                    cb({data: JSON.stringify(keydata),
            kauth_sig: sig});
                  }
                });
  stubs.replace(e2e.ext.keyserver.Client.prototype, 'verifyResponse_',
                function(resp) {
                  return (resp.kauth_sig === sig);
                });
  stubs.replace(e2e.ext.keyserver.Client.prototype, 'cacheKeyData_',
      mockControl.createFunctionMock('cacheKeyData_'));
  e2e.ext.keyserver.Client.prototype.cacheKeyData_(
      new mockmatchers.ArgumentMatcher(function(arg) {
        assertObjectEquals(keydata, arg);
        return true;
      })
  );
  mockControl.$replayAll();
  client.fetchAndImportKeys(userId);
  asyncTestCase.waitForAsync('Waiting for key import');
  window.setTimeout(function() {
    assertContains(userId, document.querySelector('.key-meta').textContent);
    mockControl.$verifyAll();
    asyncTestCase.continueTesting();
  }, 500);
}
