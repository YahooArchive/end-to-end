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

var TEST_NOBODY = "eyJhbGciOiJFUzM4NCJ9.eyJ0IjoxNDIyMzM2ODAyLCJ1c2VyaWQiOiJub2JvZHkiLCJrZXlzIjp7fX0.p-lLq-dRdzIT8pTvpJEI5v8X7bBtLLmlYWUxuTlpBgmM-0BP-hlnHlmtswlefnnSs0Hc3MD0t49pQlHbAWaN5vi7XthX3YTyo_3vJRZdw4vwCoEGCFyf1P3ooRT6JArE";

var TEST_DGIL = "eyJhbGciOiJFUzM4NCJ9.eyJ0IjoxNDIyMzM3MDE1LCJ1c2VyaWQiOiJkZ2lsIiwia2V5cyI6eyJkZXZpY2UwIjoiZXlKaGJHY2lPaUpGVXpNNE5DSjkuZXlKa1pYWnBZMlZwWkNJNkltUmxkbWxqWlRBaUxDSnJaWGtpT2lKNGRqaEJRVUZDVTBKQlFVRkJRVUZVUTBOeFIxTk5ORGxCZDBWSVFXZE5SWGQxV1hjelEwdzJZMFpxVWpKNE4yUk9ibWxMVFhSVVRVdFpiMVJQZUdsdlEyaFFkSGxZT0VWcFZreDRPVTgzVURGd1VqWmhibVJYU1hWb1JFSmZNM05wZGtGZk9HNVVPRmhPTWt4QlVIZExRVGRqU0Y5ek0xOUJRVUZCUmtSNGExb3liSE5SU0d4b1lVYzVka3hYYkhWWmVUVnFZakl3TFhkMk9FRkJRVU5PUWtKQlZFTkJRVjlmZDBGQlFVRlhRMVpKWlVWU1pqaEJRVUZCUTJsM2JsOUJRVUZCUTFwQmFWRlNhelZ0VkZSV1FtWTRRVUZCUVVac1VXZEtRMmQyWDBGQlFVRkJOVmxDUVhZNFFVRkJRVU50ZDFCZlFVRkJRVUZ3TkVKQlFVUkdTSGRFWDFsbFVWSnpUVlJxU2s1alYwVnhSM2hzUlY5RE4ydEZkalZDUm1NeFNYQnVNMk5LUmtObVkwbzVZVmxCWDFKeFpsRlVYMHQ1UVV3elVFUlBTalYyWWxWM2NVSnZMVEJNVVdSc1dWVTJSakp3V0hBNFVYQlJkM1o2ZGpoQlFVRkNWMEpCUVVGQlFVRlRRME54UjFOTk5EbEJkMFZJUVdkTlJYZHNRVUpVWW1wRGJUWjJPRTFzY1d4bE9WVldWQzFQVUZKWVlrWmhORk01UWs5NVkySlpPR0ZYVEMxTGRpMTJjMFExTmpGVlVURlZXRUZOWlV0V09WQXlaVzUyVVdkNFYxRmljRGxIZWpobllUSnNWRlpCVFVKRFFXWkRYM2RCUVVGSE1FVkhRazFKUVVKZlgwRkJRVUZDV1VwVmFEUlNSbDkzUVVGQlFXMVJTV3RGV2s5YWF6QXhVVmhmUVVGQlFVRndjMDFCUVVKRGVWRkVYMWd6V1ZGamFrbEdaMkZ5VVdSTlgwOTJiRkJCZUdsRmRXaFlTa3hOUWpKMWNFcHliM3B5ZGtjNVZqUkJYek5xUlRrMFJGVnpWMmRvTFhWUGEwcFVORXhsYWxKS04ySTNaMWhLYXpSTkxWcGlSMFJxU21Zd1RrNGlMQ0owSWpveE5ESXlNVFl3TmpNNUxDSjFjMlZ5YVdRaU9pSmtaMmxzSW4wLkhuNG83YlB3NE5vR0d6SmNSZExGRzdOTkU1NENKMlR5VENadkVhbDFNUWdTc01qNWk0X0hqcGhNYmJZcU1kQXQxT0YyalU2Wk51QVVzdV96NFVSQnYyVjR0bXJuNmIyenFTUENtejFlRG5sZTdLb1lmOHppU290QjJJNjZjbGJTIiwiZGV2aWNlMSI6ImV5SmhiR2NpT2lKRlV6TTROQ0o5LmV5SmtaWFpwWTJWcFpDSTZJbVJsZG1salpURWlMQ0pyWlhraU9pSjRkamhCUVVGQ1UwSkJRVUZCUVVGVVEwTnhSMU5OTkRsQmQwVklRV2ROUlhkMVdYY3pRMHcyWTBacVVqSjROMlJPYm1sTFRYUlVUVXRaYjFSUGVHbHZRMmhRZEhsWU9FVnBWa3g0T1U4M1VERndValpoYm1SWFNYVm9SRUpmTTNOcGRrRmZPRzVVT0ZoT01reEJVSGRMUVRkalNGOXpNMTlCUVVGQlJrUjRhMW95YkhOUlNHeG9ZVWM1ZGt4WGJIVlplVFZxWWpJd0xYZDJPRUZCUVVOT1FrSkJWRU5CUVY5ZmQwRkJRVUZYUTFaSlpVVlNaamhCUVVGQlEybDNibDlCUVVGQlExcEJhVkZTYXpWdFZGUldRbVk0UVVGQlFVWnNVV2RLUTJkMlgwRkJRVUZCTlZsQ1FYWTRRVUZCUVVOdGQxQmZRVUZCUVVGd05FSkJRVVJHU0hkRVgxbGxVVkp6VFZScVNrNWpWMFZ4UjNoc1JWOUROMnRGZGpWQ1JtTXhTWEJ1TTJOS1JrTm1ZMG81WVZsQlgxSnhabEZVWDB0NVFVd3pVRVJQU2pWMllsVjNjVUp2TFRCTVVXUnNXVlUyUmpKd1dIQTRVWEJSZDNaNmRqaEJRVUZDVjBKQlFVRkJRVUZUUTBOeFIxTk5ORGxCZDBWSVFXZE5SWGRzUVVKVVltcERiVFoyT0Uxc2NXeGxPVlZXVkMxUFVGSllZa1poTkZNNVFrOTVZMkpaT0dGWFRDMUxkaTEyYzBRMU5qRlZVVEZWV0VGTlpVdFdPVkF5Wlc1MlVXZDRWMUZpY0RsSGVqaG5ZVEpzVkZaQlRVSkRRV1pEWDNkQlFVRkhNRVZIUWsxSlFVSmZYMEZCUVVGQ1dVcFZhRFJTUmw5M1FVRkJRVzFSU1d0RldrOWFhekF4VVZoZlFVRkJRVUZ3YzAxQlFVSkRlVkZFWDFneldWRmpha2xHWjJGeVVXUk5YMDkyYkZCQmVHbEZkV2hZU2t4TlFqSjFjRXB5YjNweWRrYzVWalJCWHpOcVJUazBSRlZ6VjJkb0xYVlBhMHBVTkV4bGFsSktOMkkzWjFoS2F6Uk5MVnBpUjBScVNtWXdUazRpTENKMElqb3hOREl5TVRZd05qTTVMQ0oxYzJWeWFXUWlPaUprWjJsc0luMC5NSU1OQzB4QTNWUkxuNURXZ2FNVVU1RDdWWENueXg5TmhWNXNDYjJZYy02YjlDUDhSQzl6SVFfWEZVYlhNbjYySFltRE8zRXpZMS1ycGRsTmRuRzlwMzVTZGFleDdQbEJhVWtiRF9vYkh2QlN6emIxUHVIZThjZDZaOWRQVFUzbCIsImRldmljZTIiOiJleUpoYkdjaU9pSkZVek00TkNKOS5leUprWlhacFkyVnBaQ0k2SW1SbGRtbGpaVElpTENKclpYa2lPaUo0ZGpoQlFVRkNVMEpCUVVGQlFVRlVRME54UjFOTk5EbEJkMFZJUVdkTlJYZDFXWGN6UTB3MlkwWnFVako0TjJST2JtbExUWFJVVFV0WmIxUlBlR2x2UTJoUWRIbFlPRVZwVmt4NE9VODNVREZ3VWpaaGJtUlhTWFZvUkVKZk0zTnBka0ZmT0c1VU9GaE9Na3hCVUhkTFFUZGpTRjl6TTE5QlFVRkJSa1I0YTFveWJITlJTR3hvWVVjNWRreFhiSFZaZVRWcVlqSXdMWGQyT0VGQlFVTk9Ra0pCVkVOQlFWOWZkMEZCUVVGWFExWkpaVVZTWmpoQlFVRkJRMmwzYmw5QlFVRkJRMXBCYVZGU2F6VnRWRlJXUW1ZNFFVRkJRVVpzVVdkS1EyZDJYMEZCUVVGQk5WbENRWFk0UVVGQlFVTnRkMUJmUVVGQlFVRndORUpCUVVSR1NIZEVYMWxsVVZKelRWUnFTazVqVjBWeFIzaHNSVjlETjJ0RmRqVkNSbU14U1hCdU0yTktSa05tWTBvNVlWbEJYMUp4WmxGVVgwdDVRVXd6VUVSUFNqVjJZbFYzY1VKdkxUQk1VV1JzV1ZVMlJqSndXSEE0VVhCUmQzWjZkamhCUVVGQ1YwSkJRVUZCUVVGVFEwTnhSMU5OTkRsQmQwVklRV2ROUlhkc1FVSlVZbXBEYlRaMk9FMXNjV3hsT1ZWV1ZDMVBVRkpZWWtaaE5GTTVRazk1WTJKWk9HRlhUQzFMZGkxMmMwUTFOakZWVVRGVldFRk5aVXRXT1ZBeVpXNTJVV2Q0VjFGaWNEbEhlamhuWVRKc1ZGWkJUVUpEUVdaRFgzZEJRVUZITUVWSFFrMUpRVUpmWDBGQlFVRkNXVXBWYURSU1JsOTNRVUZCUVcxUlNXdEZXazlhYXpBeFVWaGZRVUZCUVVGd2MwMUJRVUpEZVZGRVgxZ3pXVkZqYWtsR1oyRnlVV1JOWDA5MmJGQkJlR2xGZFdoWVNreE5RakoxY0VweWIzcHlka2M1VmpSQlh6TnFSVGswUkZWelYyZG9MWFZQYTBwVU5FeGxhbEpLTjJJM1oxaEthelJOTFZwaVIwUnFTbVl3VGs0aUxDSjBJam94TkRJeU1UWXdOak01TENKMWMyVnlhV1FpT2lKa1oybHNJbjAuMzJyMlBYUWtqWFB0eDBJaDZ6LWFKV1VsWDNvYlNzWFJpdkswOXN6TGJjdktEenpza3dmU1JxXzh3VHFiRXFrdDdRNk9XTVlSRWUtTXNkRHNfV210Z3l0eE9KMmtpNkY3Q1RJMHRKRGVzYjZYdnlnRjJLWFl3ck04Zi1NX0ZRYmwifX0.BSTPhwwExzzI6IwXAOpihikwl6j_kVwUUfLc3xHBtGd_i_6kQRPI5G6IirIVMdefbJmLOI8mblVb1PKszJZL46gmL0noEQeBikjUK1fcPdFh_KJLS2285irSGEkvuOCe";





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
