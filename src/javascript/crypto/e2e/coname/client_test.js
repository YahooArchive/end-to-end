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
goog.provide('e2e.coname.ClientTest');

goog.require('e2e.coname');
goog.require('e2e.coname.Client');
goog.require('e2e.coname.getRealmByEmail');

goog.require('e2e.ext.testingstubs');
goog.require('goog.array');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.setTestOnly();

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall(document.title);
asyncTestCase.stepTimeout = 2000;

var client;
var stubs = new goog.testing.PropertyReplacer();

function setUp() {
  e2e.ext.testingstubs.initStubs(stubs);

  stubs.setPath('chrome.runtime.getURL', function(path) {
    var url = '/lib/protobufjs/' + path;
    return url;
  });

  client = new e2e.coname.Client();
}


function tearDown() {
  stubs.reset();
  window.dcodeIO = undefined;
}


function testInitialize() {
  asyncTestCase.waitForAsync('Waiting for protobuf initialize');
  client.initialize(function() {
    assertTrue(client.initialized_);
    assertEquals('function', typeof window.dcodeIO.Long);
    assertEquals('function', typeof window.dcodeIO.ByteBuffer);
    assertEquals('object', typeof window.dcodeIO.ProtoBuf);
    assertEquals('object', typeof client.proto);
    asyncTestCase.continueTesting();
  });
}


function testGetRealmByEmail() {
  asyncTestCase.waitForAsync('Testing getRealmByEmail');

  assertTrue(e2e.coname.realmConfig_['yahoo-inc.com'] === undefined);

  realm = e2e.coname.getRealmByEmail('adon@yahoo-inc.com');
  assertEquals('object', typeof realm);

  // check that the realm is initialized
  assertTrue(realm.verification_policy.quorum_list.length > 0);
  goog.array.forEach(realm.verification_policy.quorum_list, function(id) {
    assertTrue(realm.verification_policy.public_keys[id].ed25519Verifier !== undefined);
  });

  assertTrue(e2e.coname.realmConfig_['yahoo-inc.com'] === realm);
  asyncTestCase.continueTesting();
}


function testDecodeLookupMessage() {
  asyncTestCase.waitForAsync('Decode Lookup Message');

  client.initialize(function() {

    var lookupProof = this.decodeLookupMessage_(JSON.stringify({
      'user_id': 'adon@yahoo-inc.com',
      'index': 'ajBsOaETPLW/TTSRlTDjSelmOxb97pahF73tC+QBqXY=',
      'index_proof': 'KjGw6JX/3h2fWsF4SlXyvtz6fF8y1JdYXhL7OhlM+wx5Nkvq+3pWP8ahgymUAfyWR1JREtEz3XZu8Nylvps5C1jUrWa9ZPnXeMJaFf9XOJ0t1lGn5GTDm0vUUh4HPGl9',
      'ratifications': [{
        'head': 'Cn0KBXlhaG9vEN8FGiCBchrs7C1cZcx1bMWq4qO74XVxelpcJh605IuX2A00AiILCNWZ9LIFEOSA2GIqQODYH1RRrcVjIvtnqiqgOsJa9waJwuIhpAvZB/jgngTFStZQ5v6ewMxOLtaC2r4XEq4CLcyV5vC7C6o3DEAI6vsyABILCNWZ9LIFEOSA2GI=',
        'signatures': {
          '5004056709842995553': 'DrTsY0og0TV3t0ulFZRgiWn/J4WkVtUJTnMCIPFP+08Qzt6Zvxci8FsovEh5NNa3ms/0WL6bus/04o9suSZLAQ=='
        }
      }, {
        'head': 'Cn0KBXlhaG9vEN8FGiCBchrs7C1cZcx1bMWq4qO74XVxelpcJh605IuX2A00AiILCNWZ9LIFEOSA2GIqQODYH1RRrcVjIvtnqiqgOsJa9waJwuIhpAvZB/jgngTFStZQ5v6ewMxOLtaC2r4XEq4CLcyV5vC7C6o3DEAI6vsyABILCNWZ9LIFEOSA2GI=',
        'signatures': {
          '16574727844889599213': '9hDUnSxRlohxBJ475jKEVrq6DUqEvrnkUJsbXUIOjFg7RqjyHa3PeXPKY1TN6G8Y8QS77AIt762jLDKYKIUSDA=='
        }
      }, {
        'head': 'Cn0KBXlhaG9vEN8FGiCBchrs7C1cZcx1bMWq4qO74XVxelpcJh605IuX2A00AiILCNWZ9LIFEOSA2GIqQODYH1RRrcVjIvtnqiqgOsJa9waJwuIhpAvZB/jgngTFStZQ5v6ewMxOLtaC2r4XEq4CLcyV5vC7C6o3DEAI6vsyABILCNWZ9LIFEOSA2GI=',
        'signatures': {
          '1702327623518731708': 'rioH0nqY9H2YFgC7OJ9zPIpbsz3sLIKyM2YngAzGPGqbQRq/JE9JLHAfBtbeeV+7ZIwum41nkG3Z7GXVSlwiCA=='
        }
      }],
      'tree_proof': {
        'neighbors': ['Aj2/iia09hdY9M15RG/mYwIJuuvo5uEzBGiu5WTsF1Q=', 'uHZAo3zIZNmrlvCIVokRuMdBVHGqJ88qdDG4MnbJhpw='],
        'existing_index': 'ajBsOaETPLW/TTSRlTDjSelmOxb97pahF73tC+QBqXY=',
        'existing_entry_hash': 'Uw5tQi6D13ZLkHB42gOD6QYz1EbKf7KlRNpDMVatvTU='
      },
      'entry': 'CiBqMGw5oRM8tb9NNJGVMONJ6WY7Fv3ulqEXve0L5AGpdhAPGgISACJAn/J0QwWL5BE881CrCHUbXWKul6V2dqTHRY+SCWLoFXAQOjOAZCZgLcffUZJSiHQxHcKFWVz+/r3NLlIWih5g5Q==',
      'profile': 'ChC3v0QNmzruiHUB2gxenAdfEg4KA2FiYxIHZm9vIGJhchIPCgN4eXoSCFRFU1QgNDU2'
    }));

    goog.array.forEach(lookupProof.ratifications, function(ratification) {
      assertEquals('object', typeof ratification.head);
      assertEquals('object', typeof ratification.head.head);
      assertEquals('number', typeof ratification.head.head.issue_time);
      assertTrue(ratification.head.encoding.length > 0);  // array
      assertTrue(ratification.head.head.root_hash.length > 0);
      assertTrue(ratification.head.head.previous_summary_hash.length > 0);
      assertTrue(ratification.head.head.encoding.length > 0);
      assertEquals('yahoo', ratification.head.head.realm);
    });

    assertTrue(lookupProof.ratifications[0].signatures['5004056709842995553'].length > 0);
    assertTrue(lookupProof.ratifications[1].signatures['16574727844889599213'].length > 0);
    assertTrue(lookupProof.ratifications[2].signatures['1702327623518731708'].length > 0);

    assertTrue(lookupProof.tree_proof.neighbors[0].length > 0);
    assertTrue(lookupProof.tree_proof.neighbors[1].length > 0);
    assertTrue(lookupProof.tree_proof.existing_index.length > 0);
    assertTrue(lookupProof.tree_proof.existing_entry_hash.length > 0);

    assertEquals('object', typeof lookupProof.entry.index);
    assertTrue(lookupProof.entry.encoding.length > 0);
    assertTrue(lookupProof.entry.profile_commitment.length > 0);

    assertEquals('object', typeof lookupProof.profile.nonce);
    assertTrue(lookupProof.profile.encoding.length > 0);

    asyncTestCase.continueTesting();
  });
}

