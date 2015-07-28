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

e2e.ext.config = {
  /* The ECDSA pub key of the keyserver as a byte array */
  KAUTH_PUB: [4, 22, 240, 7, 228, 205, 195, 228, 101, 20, 52, 102, 64, 156, 187, 161, 103, 116, 56, 53, 184, 217, 167, 145, 0, 5, 253, 110, 141, 68, 125, 174, 234, 121, 214, 32, 3, 202, 137, 43, 233, 216, 49, 180, 106, 116, 245, 46, 53, 217, 249, 182, 122, 3, 164, 143, 107, 61, 144, 80, 103, 238, 192, 110, 54],
  /* The keyserver origin. Make sure you change this in manifest.json too */
  TESTSERVER_ORIGIN: 'https://localhost:25519',
  /* The name of the cookie used to authenticate users to the keyserver. */
  AUTH_COOKIE: 'YOUR_COOKIE_HERE',
  /* Whether users need a valid auth cookie in order to use the keyserver */
  AUTH_ENABLED: false,
  /* Some location that has access to the auth cookie. */
  AUTH_DEFAULT_ORIGIN: 'https://us-mg5.mail.yahoo.com',
  /* Whether we are running in Chrome or Firefox. */
  FIREFOX: false
};
