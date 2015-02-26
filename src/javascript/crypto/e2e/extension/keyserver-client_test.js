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

var TEST_NOBODY = "eyJhbGciOiJFUzI1NiJ9.eyJ0IjoxNDI1MDg2Nzc5LCJ1c2VyaWQiOiJ5emh1QHlhaG9vLWluYy5jb20iLCJrZXlzIjpudWxsfQ.5R1DfmLZERb-9sZE0OdSuak4f_PieVQbxXHVde6ukDwevRVLONYc1No2-YcMldCDzL5FjYOJi36faX7p3GoIOQ";

var TEST_DGIL = "eyJhbGciOiJFUzI1NiJ9.eyJ0IjoxNDI1MDg2NjMzLCJ1c2VyaWQiOiJjbmhAeWFob28taW5jLmNvbSIsImtleXMiOnsiMGp0R0xuYkkxSTJ6dE54V3NET2YiOiJleUpoYkdjaU9pSkZVekkxTmlKOS5leUprWlhacFkyVnBaQ0k2SWpCcWRFZE1ibUpKTVVreWVuUk9lRmR6UkU5bUlpd2lhMlY1SWpvaWVIWTRRVUZCUWxOQ1FVRkJRVUZCVkVORGNVZFRUVFE1UVhkRlNFRm5UVVZpUm5sSFgwaEhZa1ZTVGswemNIQnFSRTFGUTNWWU1WQXpTMUZqY2xaVmFHa3RZVE0wZEU5RFpXTjJaRlpKYW1sS1VuWklka1ZSVlRscUxXdDFZemR2UVRrM2RFOVRhWFF5YzIxUGMyb3hZbXR5TjFWTFl6TmZRVUZCUVVWNmVHcGliV2hCWlZkR2IySXlPSFJoVnpWcVRHMU9kbUpVTjBOZmQwRkJRVWt3UlVWQ1RVbEJSRjlmUVVGQlFVSlpTbFU0VVRkU1gzZEJRVUZCUzB4RFpqaEJRVUZCU210UWFtZGFlSFZtVTBsYWNWOTNRVUZCUVZkV1EwRnJTME5mT0VGQlFVRkViR2RGUTE5M1FVRkJRVXRpUVY4NFFVRkJRVU51WjBWQlFVVXlhMEZRT1c0eVVIRkJRazVqYkVkNVdtNU9jVFpqV2xJMVdtNXZUMko0TURGbVUwNVFVV2szTFdVMGFuTnBUVUZGUVdsRFdUZGhUWEJCZDNCaFpUUldWVkUxUTJKemNHaFJVa28yUzFWVGMzSkNjV1IzY2xKVFZFSnFSM0pQWDNkQlFVRkdXVVZCUVVGQlFVSkpTVXR2V2tsNmFqQkVRVkZqUTBGM1VVa3pNbTh6TjJsUVVGbHpUWEpWWTJkelFrUmxTMWh6ZGxNd1JITTFTVTl5WjNGTE5tSlZla1pVTkV0bGNucGxMV1JKWnpsVWJVOHdTVW80YVhOaVJFOHhkRnBXU3pOdmFETTNaSEJ5VVRNeWFqRTRiSEpCZDBWSlFqaE1YMEZCUVVGaVVWRlpSWGRuUVVoZk9FRkJRVUZHWjJ4VWVFUjBTRjlCUVVGQlExcEVORFJIWTJKdU1HbEhZWFk0UVVGQlFVTnRkM2RCUVVnNVYwRlFNRmx5U1dnMlVFMWtYMFpuVUVwR2JrMURXWFpETlhoMlF6TnVSRzVzUW5oRVRXNXZVMjFDUTB0MWFHZEZRWFp3U3pkWlNUbEhhMVpSY1drM2JtSm9Va3BQTUZWaFRtUkhNVXRTZEdsc09GOWlUbUZuYW5NM2RuYzlJaXdpZENJNk1UUXlOVEE0TkRFeE1pd2lkWE5sY21sa0lqb2lZMjVvUUhsaGFHOXZMV2x1WXk1amIyMGlmUS5LX0lLcG9JVm5NeWtaWUhRRWEydXZfUWUwNnF2OEp6NV9qNHpmekpkN2lONkh2cHNoVjBXQWVBaWtndXF1LTZKX05ldGdMM204SlZKV0Utb01tLURYZyJ9fQ.wTubu9k95o7GMFIMp2-Hmt3Eh7qRSpDFyxi_PVftW5D-_vi73X1n2cFTRbegBv_lu2TmwcgDzAKOfQe-4YZ2VA";


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
  assertNotNull(client.verifyResponse_(TEST_DGIL));
  assertNotNull(client.verifyResponse_(TEST_NOBODY));
}


function testSendKey() {
  var myUserid = 'yan@mit.edu';
  var myKey = [1, 2, 3];
  stubs.replace(e2e.random, 'getRandomBytes', function() {
    return [79, 159, 72, 22, 198, 17, 45, 109, 198, 123, 4, 129, 6, 188, 11];
  });
  stubs.replace(XMLHttpRequest.prototype, 'open',
      mockControl.createFunctionMock('open'));
  XMLHttpRequest.prototype.open(
      new mockmatchers.ArgumentMatcher(function(arg) {
        assertEquals('POST', arg);
        return true;
      }), new mockmatchers.ArgumentMatcher(function(arg) {
        assertEquals('https://keyshop.paranoids.corp.yahoo.com:25519' +
            '/v1/k/yan@mit.edu/T59IFsYRLW3GewSBBrwL', arg);
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


function testCacheKeyData() {
  client.cacheKeyData({foo: 'bar'});
  assertArrayEquals([{foo: 'bar'}], JSON.parse(window.localStorage.getItem(
      'keyserver-signed-responses')));
}


function testFetchAndImportKeys() {
  var userId = 'adhintz@google.com';
  var time = (new Date().getTime())/1000;
  var rawkey = "xv8AAABSBFP3bHYTCCqGSM49AwEHAgMECt6MVqa43Ab248CosK_cy664pkL_9XvC0O2K0O1Jh2qau7ll3Q9vssdObSwX0EaiMm4Dvegxr1z-SblWSFV4x83_AAAAH0RyZXcgSGludHogPGFkaGludHpAZ29vZ2xlLmNvbT7C_wAAAGYEEBMIABj_AAAABYJT92x2_wAAAAmQ8eznwfj7hkMAADA9AQCWE4jmpmA5XRN1tZduuz8QwtxGZOFurpAK6RCzKDqS8wEAx9eBxXLhKB4xm9xwPdh0-W6rbsvf58FzKjlxrkUfuxTO_wAAAFYEU_dsdhIIKoZIzj0DAQcCAwQ0M6kFa7VaVmt2PRdOUdZWrHp6CZZglTVQi1eyiXB_nnUUbH-qrreWTD7W9RxRtr0IqAYssLG5ZoWsXa5jQC3DAwEIB8L_AAAAZgQYEwgAGP8AAAAFglP3bHf_AAAACZDx7OfB-PuGQwAAkO4BALMuXsta-bCOvzSn7InOs7wA-OmDN5cv1cR_SsN5-FkLAQCmmBa_Fe76gmDd0RjvpQW7pWK2zXj3il6HYQ2NsWlIbQ==";
  // Keyserver key input
  var keydata = {
      t: time - 1,
      deviceid: '99999',
      userid: userId,
      key: rawkey
  };
  // The fake JWS signature over keydata
  var jws = 'irrelevant';

  stubs.replace(e2e.ext.keyserver.Client.prototype, 'sendGetRequest_',
                function(path, cb) {
                  if (path === userId) {
                    // Fake 200 response
                    cb({userid: userId,
                        t: time,
                        keys: {'99999': jws}
                      });
                  } else {
                    // Fake 404 response
                    cb(null);
                  }
                });
  stubs.replace(e2e.ext.keyserver.Client.prototype, 'verifyResponse_',
                function(resp) {
                  return (resp === jws) ? keydata : null;
                });

  stubs.replace(e2e.ext.keyserver.Client.prototype, 'cacheKeyData',
      mockControl.createFunctionMock('cacheKeyData'));
  e2e.ext.keyserver.Client.prototype.cacheKeyData(
      new mockmatchers.ArgumentMatcher(function(arg) {
        assertObjectEquals(jws, arg);
        return true;
      })
  );

  mockControl.$replayAll();
  client.fetchAndImportKeys([userId], goog.nullFunction);
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
