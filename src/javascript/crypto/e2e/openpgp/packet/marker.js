/**
 * @license
 * Copyright 2014 Google Inc. All rights reserved.
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
 * @fileoverview Marker packet.
 */

goog.provide('e2e.openpgp.packet.Marker');

goog.require('e2e.openpgp.packet.Packet');
goog.require('e2e.openpgp.packet.factory');



/**
 * @constructor
 * @extends {e2e.openpgp.packet.Packet}
 */
e2e.openpgp.packet.Marker = function() {
  goog.base(this);
};
goog.inherits(e2e.openpgp.packet.Marker,
              e2e.openpgp.packet.Packet);


/** @inheritDoc */
e2e.openpgp.packet.Marker.prototype.tag = 10;


/** @override */
e2e.openpgp.packet.Marker.prototype.serializePacketBody = function() {
  return [0x50, 0x47, 0x50];
};


/**
 * @param {!e2e.ByteArray} body
 * @return {e2e.openpgp.packet.Marker}
 */
e2e.openpgp.packet.Marker.parse = function(body) {
  return new e2e.openpgp.packet.Marker;
};


e2e.openpgp.packet.factory.add(e2e.openpgp.packet.Marker);
