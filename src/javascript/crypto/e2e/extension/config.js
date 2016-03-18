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
 * Keyserver config
 * @const {!Object<string, *>}
 */
e2e.ext.config = {
  /* The name of the cookie used to authenticate users to the keyserver. */
  AUTH_COOKIE: 'YBY',
  /* Some location that has access to the auth cookie. */
  AUTH_DEFAULT_ORIGIN: 'https://mail.yahoo.com',

  /* The CONAME CONFIG */
  CONAME: {
    'realms': [{
      'realm_name': 'yahoo',
      'domains': ['yahoo-inc.com'],
      'addr': 'https://localhost:4443',
      'URL': 'https://mail.yahoo.com',
      'VRFPublic': goog.crypt.base64.decodeStringToByteArray(
          'Dvt4a09K1ZTZQl/JGJ4gQa94XU+RdK4hWmd5hJBp9ww='),
      'verification_policy': {
        'public_keys': {
          '1003492262947017977': {
            'ed25519': goog.crypt.base64.decodeStringToByteArray(
                'jU87Wearzbx1duuxKxlIkZFfGqxXQwOV3VEHccqSrcE=')
          },
          '6235162068590490013': {
            'ed25519': goog.crypt.base64.decodeStringToByteArray(
                '56OAlXk3/+GMxUadaQH9CbYDMp/igmrQ1MlG7l1aKXQ=')
          },
          '9687269752368895265': {
            'ed25519': goog.crypt.base64.decodeStringToByteArray(
                'xvmwGzeT/OtOt8yBn4QqKjubRnkkeFFYitkF4um+la4=')
          }
        },
        'quorum': {
          'threshold': 2,
          'candidates': [
            '1003492262947017977',
            '6235162068590490013',
            '9687269752368895265'
          ]
        }
      },
      'epoch_time_to_live': 180
    }]
  }
};
