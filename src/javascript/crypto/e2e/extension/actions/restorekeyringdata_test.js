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
 * @fileoverview Tests for restore key UI
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.actions.RestoreKeyringDataTest');

goog.require('e2e.error.InvalidArgumentsError');
goog.require('e2e.ext.actions.GetKeyringBackupData');
goog.require('e2e.ext.actions.RestoreKeyringData');
goog.require('e2e.ext.constants');
goog.require('e2e.ext.utils.passphrase');
goog.require('goog.crypt.base64');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.require('goog.ui.Component');
goog.setTestOnly();

var stubs = new goog.testing.PropertyReplacer();
var constants = e2e.ext.constants;
var utils = e2e.ext.utils;
var ui = null;

function setUp() {
  stubs.setPath('e2e.openpgp.KeyRing.ECC_SEED_SIZE', 6);

  ui = new goog.ui.Component();
  ui.render(document.body);
}


function tearDown() {
  stubs.reset();

  ui = null;
}


function testRestoreData() {
  var ctx = {
    restoreKeyring: function(d) {
      assertArrayEquals(d.seed, [0, 0, 98, 150, 255, 226]);
      assertEquals(d.count, 2);
    }
  };

  new e2e.ext.actions.RestoreKeyringData().execute(ctx, {
    action: constants.Actions.RESTORE_KEYRING_DATA,
    content: {
      data: 'a hello zoomed 1',
      email: 'Ryan Chan <rcc@google.com>'
    }
  }, ui, goog.partial(assertEquals, 'Ryan Chan <rcc@google.com>'), function(e) {
    console.error(e);
  });
}


function testInvalidVersion() {
  new e2e.ext.actions.RestoreKeyringData().execute({}, {
    action: constants.Actions.RESTORE_KEYRING_DATA,
    content: {
      data: 'a a a 128',
      email: 'Ryan Chan <rcc@google.com>'
    }
  }, ui, function() {
    assert('Invalid restore size not detected', false);
  }, function(err) {
    assertTrue(err instanceof e2e.error.InvalidArgumentsError);
    assertEquals(err.message, 'Invalid version bit');
  });
}


function testInvalidRestoreSize() {
  new e2e.ext.actions.RestoreKeyringData().execute({}, {
    action: constants.Actions.RESTORE_KEYRING_DATA,
    content: {
      data: utils.passphrase.bytesToPhrase([1, 2, 3, 4, 5, 6, 7, 8]) + ' 1',
      email: 'Ryan Chan <rcc@google.com>'
    }
  }, ui, function() {
    assert('Invalid restore size not detected', false);
  }, function(err) {
    assertTrue(err instanceof e2e.error.InvalidArgumentsError);
    assertEquals(err.message, 'Backup data has invalid length');
  });
}


function testBackupThenRestore() {
  var ctx = {
    restoreKeyring: function(d) {
      assertArrayEquals(d.seed, [1, 2, 3, 4, 5, 6]);
      assertEquals(d.count, 4);
    }
  };

  stubs.replace(e2e.ext.actions.GetKeyringBackupData.prototype, 'execute',
                function(ctx, request, requestor, cb) {
    cb({seed: [1, 2, 3, 4, 5, 6], count: 4});
  });

  new e2e.ext.actions.GetKeyringBackupData().execute(ctx, {
    action: constants.Actions.GET_KEYRING_BACKUP_DATA
  }, ui, function(data) {
    var phrase = [utils.passphrase.bytesToPhrase(data.seed), data.count/2].join(' ');
    new e2e.ext.actions.RestoreKeyringData().execute(ctx, {
      action: constants.Actions.RESTORE_KEYRING_DATA,
      content: {
        data: phrase,
        email: 'yan@mit.edu'
      }
    }, ui, goog.partial(assertEquals, 'yan@mit.edu'));
  });
}
