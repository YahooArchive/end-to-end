/** @suppress {extraProvide} */
goog.provide('e2e.ext.KeyserverClientTest');

goog.require('e2e.ext.keyserver.Client');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.preferences');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.setTestOnly();

var constants = e2e.ext.constants;
var client;
var mockControl = null;
var mockmatchers = goog.testing.mockmatchers;
var preferences = e2e.ext.ui.preferences;
var stubs = new goog.testing.PropertyReplacer();

var TEST_SIG = '4GhezXSJ6ByB1LmnUDtDoT7TOepwFUwRPDLjhsLpTTSay5' +
    'mTHji4J1AOKr8_ppQer8jnppZs9v4aWhCOL4HkmwNCu21DhEeKC6XlyOs' +
    'l88epik6bZnRYjeYTffxK8lQH';
var TEST_DATA = 'key1';


function setUp() {
  window.localStorage.clear();
  mockControl = new goog.testing.MockControl();
  e2e.ext.testingstubs.initStubs(stubs);
  client = new e2e.ext.keyserver.Client();
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  client = undefined;
}


function testVerifyResponse() {
  var response = {kauth_sig: TEST_SIG, data: TEST_DATA};
  assertTrue(client.verifyResponse_(response));
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
  var userId = 'yan@mit.edu';
  var sig = 'irrelevant';
  var time = new Date().getTime();
  var keydata = {keys: {12345: 'irrelevant'},
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
  stubs.replace(e2e.ext.keyserver.Client.prototype, 'importKeys_',
               mockControl.createFunctionMock('importKeys'));
  e2e.ext.keyserver.Client.prototype.importKeys_(
    new mockmatchers.ArgumentMatcher(function(arg) {
      assertObjectEquals(keydata, arg);
      return true;
    })
  );
  mockControl.$replayAll();
  client.fetchAndImportKeys(userId);
  mockControl.$verifyAll();
}
