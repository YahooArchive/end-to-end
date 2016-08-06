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
 * @fileoverview Provides user-configurable constants used throughout the
 * extension. If you're building from source, make sure to edit this first!
 */

goog.provide('e2e.ext.config');

goog.require('goog.crypt.base64');


/**
 * Config
 * @const {!Object<string, *>}
 */
e2e.ext.config = {};


/**
 * The name of the cookie used to authenticate users to the keyserver.
 * @type {!string}
 */
e2e.ext.config.AUTH_COOKIE = 'YBY';


/**
 * Some location that has access to the auth cookie.
 * @type {!string}
 */
e2e.ext.config.AUTH_DEFAULT_ORIGIN = 'https://mail.yahoo.com';


/**
 * CONAME Config
 * @const {!Object<string, *>}
 */
e2e.ext.config.CONAME = {};


/** @enum {number} */
e2e.ext.config.CONAME.RealmAuthType = {
  'COOKIES': 1,
  'SAML': 2,
  'OPENID': 3
};


/** @type {!Array<e2e.coname.RealmConfig>} */
e2e.ext.config.CONAME.realms = [{
  'realm_name': 'yahoo',
  'domains': ['yahoo-inc.com'],
  'addr': 'https://alpha.keyserver.yahoo.com:443',
  'auth': {
    'type': e2e.ext.config.CONAME.RealmAuthType.SAML,
    'startRelUrl': '/saml',
    'endRelUrl': '/samlsso'
  },
  'URL': 'https://mail.yahoo.com',
  'VRFPublic': goog.crypt.base64.decodeStringToByteArray(
      'iTCFkCyphd85gGLsH7WBWDJb9Tjj461Z6Bm/8hYLPbA='),
  'verification_policy': {
    'public_keys': {
      '13003662298214047307': {
        'ed25519': goog.crypt.base64.decodeStringToByteArray(
            'JdSPh9URZOA0rHD3QY3V+/bBpzC8QfS7Ww7skfVnSlY=')
      },
      '13652783584848560137': {
        'ed25519': goog.crypt.base64.decodeStringToByteArray(
            'A7FQWRuct+8yj2SrDI1gLTPvOb7/229Aos9rj6EGw04=')
      },
      '13962823393513964601': {
        'ed25519': goog.crypt.base64.decodeStringToByteArray(
            'yGsVg12ehJWPan9A4OEW19qf900xQqCVjcX/ytVX4Q8=')
      },
      '16119809317788517140': {
        'ed25519': goog.crypt.base64.decodeStringToByteArray(
            'KV/XWTHzobdWsJmXhacvG7+5geAteK4h/tT/Gw8ZX4w=')
      },
      '16188257911045619698': {
        'ed25519': goog.crypt.base64.decodeStringToByteArray(
            '3xiM95uid/bd4T9O+JWFq4UZ60T3XhL/H2TY2suiLHY=')
      },
      '16294118277475929171': {
        'ed25519': goog.crypt.base64.decodeStringToByteArray(
            'KsVdZ80eqgnWbT2x+D/HWODkADQ+VfZUHIhRmJs7hqI=')
      },
      '9222307167264895650': {
        'ed25519': goog.crypt.base64.decodeStringToByteArray(
            'H+34Q/IyT/YzW4Ttg7BqRBSs92FYo06pejfZlyYI5s8=')
      }
    },
    'quorum': {
      'threshold': 2,
      'candidates': [
        '13003662298214047307',
        '13652783584848560137',
        '13962823393513964601',
        '16119809317788517140',
        '16188257911045619698',
        '16294118277475929171',
        '9222307167264895650'
      ]
    }
  },
  'epoch_time_to_live': 180
}];
