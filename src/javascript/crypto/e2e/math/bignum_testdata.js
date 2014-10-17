/**
 * @license
 * Copyright 2013 Google Inc. All rights reserved.
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
 * @fileoverview Test data for point arithmetics.
 * @author thaidn@google.com (Thai Duong)
 */

goog.provide('e2e.bigNumTestData');
goog.provide('e2e.bigNumTestData.ABmodN');
goog.provide('e2e.bigNumTestData.ABmodP_256');
goog.provide('e2e.bigNumTestData.RRmodP_256');
goog.setTestOnly();


/**
 * P-256.
 */
e2e.bigNumTestData.P_256 = [
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];


/**
 * Some random number.
 */
e2e.bigNumTestData.N = [
   0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
   0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
   0xBC, 0xE6, 0xFA, 0xAD, 0xA7, 0x17, 0x9E, 0x84,
   0xF3, 0xB9, 0xCA, 0xC2, 0xFC, 0x63, 0x25, 0x51];


/**
 * Some random number.
 */
e2e.bigNumTestData.A = [
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFC];


/**
 * Another random number.
 */
e2e.bigNumTestData.B = [
   0x5A, 0xC6, 0x35, 0xD8, 0xAA, 0x3A, 0x93, 0xE7,
   0xB3, 0xEB, 0xBD, 0x55, 0x76, 0x98, 0x86, 0xBC,
   0x65, 0x1D, 0x06, 0xB0, 0xCC, 0x53, 0xB0, 0xF6,
   0x3B, 0xCE, 0x3C, 0x3E, 0x27, 0xD2, 0x60, 0x4B];


/**
 * P_256 - 1.
 */
e2e.bigNumTestData.P_255 = [
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFE];


/**
 * P_256 + 1.
 */
e2e.bigNumTestData.P_257 = [
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];


/**
 * P_256 * 2.
 */
e2e.bigNumTestData.P_512 = [0x01,
   0xff, 0xff, 0xff, 0xfe, 0x00, 0x00, 0x00, 0x02,
   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
   0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xff,
   0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe];


/**
 * P_256 ^ 2.
 */
e2e.bigNumTestData.P_256_SQUARE = [
   0xff, 0xff, 0xff, 0xfe, 0x00, 0x00, 0x00, 0x02,
   0xff, 0xff, 0xff, 0xfe, 0x00, 0x00, 0x00, 0x01,
   0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xfe,
   0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xfe,
   0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xfe,
   0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
   0xff, 0xff, 0xff, 0xfe, 0x00, 0x00, 0x00, 0x00,
   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01];


/**
 * e2e.ecc.constant.P_256.A * e2e.ecc.constant.P_256.B.
 */
e2e.bigNumTestData.AB = [
    0x5a, 0xc6, 0x35, 0xd8, 0x4f, 0x74, 0x5e, 0x0f,
    0x64, 0x77, 0x5f, 0x46, 0x6c, 0xe7, 0x5d, 0x4e,
    0xa2, 0x70, 0x3d, 0x4a, 0x38, 0x95, 0x66, 0xda,
    0x7e, 0xd2, 0x25, 0xe0, 0x6c, 0x43, 0x92, 0x57,
    0x1f, 0x7b, 0x8b, 0x4c, 0xe4, 0x05, 0x17, 0x5c,
    0xfc, 0xa4, 0xbb, 0xa0, 0x61, 0x6c, 0x21, 0x4c,
    0x93, 0x5e, 0x45, 0x87, 0xce, 0xb1, 0x3c, 0x27,
    0x10, 0xc7, 0x0f, 0x07, 0x60, 0xb6, 0x7e, 0xd4];


/**
 * AB mod P_256.
 */
e2e.bigNumTestData.ABmodP_256 = [
    0xef, 0xad, 0x5e, 0x74, 0x01, 0x50, 0x44, 0x4a,
    0xe4, 0x3c, 0xc7, 0xff, 0x9c, 0x36, 0x6b, 0xca,
    0xd0, 0xa8, 0xeb, 0xef, 0x9b, 0x04, 0xed, 0x1d,
    0x4c, 0x95, 0x4b, 0x45, 0x88, 0x88, 0xdf, 0x1d];


/**
 * AB mod N (N is the order of the base point in P_256 curve).
 */
e2e.bigNumTestData.ABmodN = [
   0xf4, 0x1e, 0x54, 0x98, 0x61, 0x62, 0x73, 0x29,
   0x6e, 0x87, 0x55, 0x9d, 0x9e, 0xec, 0x6b, 0xc0,
   0x51, 0x79, 0x6a, 0x2b, 0x4f, 0xdb, 0x15, 0xa5,
   0xdd, 0x6f, 0xba, 0x2d, 0x50, 0x84, 0x35, 0xdc];


/**
 * A^{-1} mod P.
 */
e2e.bigNumTestData.aInv = [
    0x55, 0x55, 0x55, 0x55, 0x00, 0x00, 0x00, 0x00,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0xaa, 0xaa, 0xaa, 0xaa,
    0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa];


/**
 * B^{-1} mod P.
 */
e2e.bigNumTestData.bInv = [
    0xab, 0x9e, 0x4c, 0x64, 0xb6, 0x03, 0x63, 0x07,
    0x3d, 0x96, 0x8b, 0x0b, 0x52, 0x91, 0x45, 0x98,
    0x60, 0x71, 0xef, 0x1c, 0xd6, 0xda, 0x80, 0xe9,
    0xff, 0x6b, 0xad, 0x7f, 0xf5, 0x11, 0xd9, 0xa5];


/**
 * RR = 1 << (2 * 256).
 */
e2e.bigNumTestData.RR = [0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];


/**
 * RR mod P_256.
 */
e2e.bigNumTestData.RRmodP_256 = [
    0x04, 0xff, 0xff, 0xff, 0xfd, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xfe, 0xff, 0xff, 0xff,
    0xfb, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x03];
