/** @suppress {extraProvide} */
goog.provide('e2e.ext.KeyserverClientTest');

goog.require('e2e.ext.Launcher');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.keyserver.Client');
goog.require('e2e.ext.testingstubs');
goog.require('goog.crypt.base64');
goog.require('goog.dom');
goog.require('goog.object');
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
  var myKey = [1, 2, 3];
  stubs.replace(e2e.ext.keyserver.Client.prototype, 'fetchKey_',
                function(userid, cb) {
                  if (userid === myUserid) {
                    cb({keys: JSON.stringify({12345: {data: 'irrelevant',
                                                      kauth_sig: 'foo'}}),
                        userid: 'yan@mit.edu', t: 0});
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
        return (arg === 'AQID');
      }
      ));
  mockControl.$replayAll();

  client.sendKey(myUserid, myKey);
  mockControl.$verifyAll();
}


function testFetchAndImportKeys() {
  var userId = 'adhintz@google.com';
  var sig = 'irrelevant';
  var time = (new Date().getTime())/1000;
  var rawkey = "xv8AAABSBFP3bHYTCCqGSM49AwEHAgMECt6MVqa43Ab248CosK_cy664pkL_9XvC0O2K0O1Jh2qau7ll3Q9vssdObSwX0EaiMm4Dvegxr1z-SblWSFV4x83_AAAAH0RyZXcgSGludHogPGFkaGludHpAZ29vZ2xlLmNvbT7C_wAAAGYEEBMIABj_AAAABYJT92x2_wAAAAmQ8eznwfj7hkMAADA9AQCWE4jmpmA5XRN1tZduuz8QwtxGZOFurpAK6RCzKDqS8wEAx9eBxXLhKB4xm9xwPdh0-W6rbsvf58FzKjlxrkUfuxTO_wAAAFYEU_dsdhIIKoZIzj0DAQcCAwQ0M6kFa7VaVmt2PRdOUdZWrHp6CZZglTVQi1eyiXB_nnUUbH-qrreWTD7W9RxRtr0IqAYssLG5ZoWsXa5jQC3DAwEIB8L_AAAAZgQYEwgAGP8AAAAFglP3bHf_AAAACZDx7OfB-PuGQwAAkO4BALMuXsta-bCOvzSn7InOs7wA-OmDN5cv1cR_SsN5-FkLAQCmmBa_Fe76gmDd0RjvpQW7pWK2zXj3il6HYQ2NsWlIbQ==";
  var keydata = {kauth_sig: sig,
      data: JSON.stringify(
          {t: time - 1,
           deviceid: '99999',
           userid: userId,
           key: rawkey})};

  stubs.replace(e2e.ext.keyserver.Client.prototype, 'sendGetRequest_',
                function(path, cb) {
                  if (path === userId) {
                    cb({userid: userId,
                        t: time,
                        keys: {99999: keydata}
                      });
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
    launcher.pgpContext_.getAllKeys().addCallback(function(result) {
      assertArrayEquals(['Drew Hintz <adhintz@google.com>'],
                        goog.object.getKeys(result));
      mockControl.$verifyAll();
      asyncTestCase.continueTesting();
    });
  }, 500);
}
