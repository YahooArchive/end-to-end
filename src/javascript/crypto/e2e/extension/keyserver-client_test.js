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
 * @fileoverview Unit tests for the End-To-End keyserver client.
 */

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

var PRIVATE_KEY_ASCII = // userid of test 4
    '-----BEGIN PGP PRIVATE KEY BLOCK-----\n' +
    'Version: GnuPG v1.4.11 (GNU/Linux)\n' +
    '\n' +
    'lQIGBFHMug4BBACW9E+4EJXykFpkdHS1K7nkTFcvFHpnJsbHSB99Px6ib6jusVNJ\n' +
    'SjWhbWlcQXXpwDKRKKItRHE4v2zin89+hWPxQEU4l79S17i8xSXT8o02I4e7cPrj\n' +
    'j1JSyQk2YpIK5zNO7cU1IlVRHrTmvrp8ip9exF9D5UqQGxmXncjtJxsF8wARAQAB\n' +
    '/gkDAgxGSvTcN/9nYDs6DJVcH5zs/RiEw8xwMhVxHepb0D0jHDxWpPxHoT6enWSS\n' +
    'expqlvP6Oclgp0AgUBZNLr1G8i6cFTbH8VP1f+be3isyt/DzBYUE3GEBj/6pg2ft\n' +
    'tRgUs/yWT731BkvK6o3kMBm5OJtOSi6rBwvNgfgA3KLlv4QknOHAFoEZL+CpsjWn\n' +
    'SPE7SdAPIcIiT4aIrIe4RWm0iP1HcCfhoGgvbMlrB9r5uQdlenRxWwhP+Tlik5A9\n' +
    'uYqrAT4Rxb7ce+IDuWPHGOZVIQr4trXegGpCHqfi0DgZ0MOolaSnfcrRDZMy0zAd\n' +
    'HASBijOSPTZiF1aSg/p6ghqBvDwRvRgLv1HNdaObH+LRpr/AI/t0o6AmqWdeuLIG\n' +
    'TctvYIIEZNvThDvYzjcpoxz03qRD3I+b8nuyweKH/2bUSobHc6EacHYSUML8SxRC\n' +
    'TcM/iyDcplK5g1Rul73fhAjw3A9Y6elGiitzmO/oeAi2+Oh7XrUdnaG0BnRlc3Qg\n' +
    'NIi4BBMBAgAiBQJRzLoOAhsDBgsJCAcDAgYVCAIJCgsEFgIDAQIeAQIXgAAKCRAG\n' +
    '/5ysCS2oCL2SA/9EV9j3T/TM3VRD0NvNySHodcxCP1BF0zm/M84I/WHQsGKmHStf\n' +
    'CqqEGruB8E6NHQMJwNp1TzcswuxE0wiTJiXKe3w3+GZhPHdW5zcgiMKKYLn80Tk6\n' +
    'fUMx1zVZtXlSBYCN5Op/axjQRyb+fGnXOhmboqQodYaWS7qhJWQJilH6ip0CBgRR\n' +
    'zLoOAQQAw0zLIR7cmIS5lgu+/dxZThZebZHBH3RSiUZt9JP/cpMuHLs//13uLlzO\n' +
    '9kmkyNQ34ulCM+WbhU8cN25wF2r/kleEOHWaNIW+I1PGGkHwy+E7Eae7juoqsXfJ\n' +
    '5bIfSZwShOhZPwluRaDGWd/8hJt6avduFL9gGZTunWn4F3nMqjUAEQEAAf4JAwIM\n' +
    'Rkr03Df/Z2BQOTPSVVkZoaZ2FC7fly+54YG9jWBCAwR6P8Os8Cp1BM8BG+E6jL3b\n' +
    'X7djq70YwF9t1NMas2sXviGfAZEpZZnjQYfcl6EsvBciDspzYQKiSdndCehuoA4g\n' +
    'QYJ0M9XzBtCaCJ7ti2azTNAYYtw0vWkvGfgzWxw6IbLttHRIWEdvBMul+u2NzPhy\n' +
    'x8MpulrIyAER0SgaE0oJlHm8LfjV/qJd4Gpb9NG9QmdFrpPrIvDFh/mJC6CyqdVU\n' +
    'ZfahmuzfFANMEZehsrFHZmpIAzfrv5BBppVV4/vVVuoR74ohcur36sqiSZPI4pkg\n' +
    'LE7BR0A4PGdSRroZZFB4djV+6dIM0LKwqb+d50UUsJy7JIyIFHZAR70tEIfyyF0I\n' +
    '7ZzlmO9ebwy/XiJnxYuVKh3M1q97b7lGlVGD4hvi37jv+YYqLe4Rd4T9Ho+qM33T\n' +
    'OfVHAfr6v5YhlnaMYfKC7407kWA9bRnItdjy/m5br05bncH7iJ8EGAECAAkFAlHM\n' +
    'ug4CGwwACgkQBv+crAktqAhENwQAkMY/nds36KgzwfMPpxtBaq8GbrUqY1r8lBl6\n' +
    'a/bi8qeOuEgQmIxM2OpVPtL04c1c1hLflPCi1SQUlCIh3DkEGQIcy0/wxUZdCvZK\n' +
    '0mF5nZSq6tez3CwqbeOA4nBOLwbxho50VqxBpR4qypYrB2ipykxlwiqudEe0sE2b\n' +
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
        assertEquals('https://localhost:25519' +
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

function testRefreshKeyring() {
  populatePgpKeys(PUBLIC_KEY_ASCII_2);

  stubs.replace(e2e.ext.keyserver.Client.prototype, 'fetchAndImportKeys',
                mockControl.createFunctionMock('fetchAndImportKeys'));

  e2e.ext.keyserver.Client.prototype.fetchAndImportKeys(
      new mockmatchers.ArgumentMatcher(function(arg) {
        assertArrayEquals(['adhintz@google.com'], arg);
        return true;
      }), mockmatchers.ignoreArgument, mockmatchers.ignoreArgument);
  mockControl.$replayAll();

  client.refreshKeyring(goog.nullFunction);
  asyncTestCase.waitForAsync('Waiting for key refresh');
  window.setTimeout(function() {
    mockControl.$verifyAll();
    asyncTestCase.continueTesting();
  }, 100);
}

function populatePgpKeys(opt_key) {
  var ctx = launcher.getContext();
  ctx.importKey(function(uid, callback) {
    callback('test');
  }, PRIVATE_KEY_ASCII);

  ctx.importKey(function() {}, PUBLIC_KEY_ASCII);
  if (opt_key) {
    ctx.importKey(function() {}, opt_key);
  }
}
