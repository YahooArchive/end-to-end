/** @suppress {extraProvide} */
goog.provide('e2e.ext.KeyserverClientTest');

goog.require('e2e.ext.KeyserverClient');
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
var client = null;
var mockControl = null;
var mockmatchers = goog.testing.mockmatchers;
var preferences = e2e.ext.ui.preferences;
var stubs = new goog.testing.PropertyReplacer();

var TEST_SIG = '4GhezXSJ6ByB1LmnUDtDoT7TOepwFUwRPDLjhsLpTTSay5mTHji4J1AOKr8_ppQer8jnppZs9v4aWhCOL4HkmwNCu21DhEeKC6XlyOsl88epik6bZnRYjeYTffxK8lQH';
var TEST_DATA = 'key1';

function setUp() {
  window.localStorage.clear();
  mockControl = new goog.testing.MockControl();
  e2e.ext.testingstubs.initStubs(stubs);

  preferences.setWelcomePageEnabled(false);
  client = new e2e.ext.KeyserverClient(null);
}


function tearDown() {
  stubs.reset();
  mockControl.$tearDown();
  client = null;
}


function testVerifyResponse() {
  var response = {kauth_sig: TEST_SIG, data: TEST_DATA};
  asserTrue(client.verifyResponse_(response));
}
