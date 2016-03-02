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
      'VRFPublic': [
        173, 87, 173, 65, 228, 26, 136, 105, 43, 83, 77, 76, 161, 218, 39, 33,
        97, 50, 127, 195, 12, 229, 140, 60, 240, 87, 97, 1, 135, 45, 42, 179
      ],
      'verification_policy': {
        'public_keys': {
          '16574727844889599213': {
            'ed25519': [
              139, 247, 147, 143, 90, 107, 47, 34, 139, 129, 25, 121, 52, 78,
              40, 154, 218, 194, 223, 24, 213, 127, 107, 40, 192, 156, 224,
              118, 196, 151, 41, 75
            ]
          },
          '1702327623518731708': {
            'ed25519': [
              182, 124, 135, 223, 177, 101, 145, 255, 103, 123, 76, 163, 240,
              54, 209, 152, 104, 12, 131, 227, 3, 242, 150, 102, 101, 46, 201,
              82, 84, 13, 95, 70
            ]
          },
          '5004056709842995553': {
            'ed25519': [
              205, 132, 50, 39, 212, 81, 159, 117, 232, 176, 253, 41, 48, 137,
              185, 124, 250, 169, 77, 128, 242, 1, 237, 94, 254, 140, 88, 182,
              94, 141, 161, 129
            ]
          }
        },
        'quorum': {
          'threshold': 2,
          'candidates': [
            '5004056709842995553',
            '16574727844889599213',
            '1702327623518731708']
        }
      },
      'epoch_time_to_live': 180
    }]
  }
};
