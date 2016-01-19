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
var beforeAsyncTestsRealmConfig_ = e2e.coname.realmConfig_['yahoo-inc.com'];

var lookupProofSample = {
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
};

var lookupProofNoBodySample = {
  "user_id": "nobody@yahoo-inc.com",
  "index": "SJQKzcNiCvNb93qzZ51JZLCKn+C1JR176FdVcZwXIOc=",
  "index_proof": "Xvwig8MNFNbKnfWAPY/ofZRHAS+ry6DzM82Sje/70gKALkPDY/+NElCaXbwCoCaXfx0wCSaenrTpNI2LM+sbBzkviC4+O4LEvjzsO2pHI+TAxNVqg/0/pml+9HzPqQhY",
  "ratifications": [{
    "head": "Cn4KBXlhaG9vEMszGiCrUYYKackJHdA76UUDR7tMJwt77suZyJTi0khtJjArmSIMCJ/S4rMFENDb6JgDKkCGcI173yhSDSO11xUkalK9HKeF7OTl8m/Y7QPp6JU/JKOxU9gj0EvuuQlb0EvYmwfsXW8dq2QwGJqOxo+8oyw5MgASDAif0uKzBRDQ2+iYAw==",
    "signatures": {
       "5004056709842995553": "WEArjKaPWitnJQ7crHhxO81v391PK995YD24yxMPQmqxcomu2H0joomHJrLK6NNEFvSiKxcdhhTlJl0TI7g+DA=="
    }
  }, {
    "head": "Cn4KBXlhaG9vEMszGiCrUYYKackJHdA76UUDR7tMJwt77suZyJTi0khtJjArmSIMCJ/S4rMFENDb6JgDKkCGcI173yhSDSO11xUkalK9HKeF7OTl8m/Y7QPp6JU/JKOxU9gj0EvuuQlb0EvYmwfsXW8dq2QwGJqOxo+8oyw5MgASDAif0uKzBRDQ2+iYAw==",
    "signatures": {
      "16574727844889599213": "v3XY8JVb1FHE24c5vI4cDazh7A3FRWO/zhtyztqUTIeUrCbd++ZfWnufkOnmziWtxbm4Cv4W1HACItMCCoA1Ag=="
    }
  }, {
    "head": "Cn4KBXlhaG9vEMszGiCrUYYKackJHdA76UUDR7tMJwt77suZyJTi0khtJjArmSIMCJ/S4rMFENDb6JgDKkCGcI173yhSDSO11xUkalK9HKeF7OTl8m/Y7QPp6JU/JKOxU9gj0EvuuQlb0EvYmwfsXW8dq2QwGJqOxo+8oyw5MgASDAif0uKzBRDQ2+iYAw==",
    "signatures": {
      "1702327623518731708": "wH+3WGxS5oLTdYW1aH/Uhb8nIPAeYbRevLJmK6sA8HCArIF2B4KOOwWzNqGp+unjlBDqIfjC0DcBHrfkpeuoDA=="
    }
  }],
  "tree_proof": {
    "neighbors": ["Aj2/iia09hdY9M15RG/mYwIJuuvo5uEzBGiu5WTsF1Q=", "uHZAo3zIZNmrlvCIVokRuMdBVHGqJ88qdDG4MnbJhpw="]
  }
};

function setUp() {
  e2e.ext.testingstubs.initStubs(stubs);

  stubs.setPath('chrome.runtime.getURL', function(path) {
    var url = '/lib/protobufjs/' + path;
    return url;
  });

  protobuf = new e2e.coname.ProtoBuf();
  client = new e2e.coname.Client();
}


function tearDown() {
  stubs.reset();
  window.dcodeIO = undefined;
}


function testProtoBufInitialize() {
  asyncTestCase.waitForAsync('Waiting for protobuf initialize');
  protobuf.initialize().addCallback(function() {
    assertTrue(protobuf.initialized_);
    assertEquals('function', typeof window.dcodeIO.Long);
    assertEquals('function', typeof window.dcodeIO.ByteBuffer);
    assertEquals('object', typeof window.dcodeIO.ProtoBuf);
    asyncTestCase.continueTesting();
  });
}


function testClientInitialize() {
  asyncTestCase.waitForAsync('Waiting for client initialize');
  client.initialize().addCallback(function() {
    assertEquals('function', typeof window.dcodeIO.Long);
    assertEquals('function', typeof window.dcodeIO.ByteBuffer);
    assertEquals('object', typeof window.dcodeIO.ProtoBuf);
    assertEquals('object', typeof client.proto);
    asyncTestCase.continueTesting();
  });
}


function testGetRealmByEmail() {
  asyncTestCase.waitForAsync('Testing getRealmByEmail');

  assertTrue(beforeAsyncTestsRealmConfig_ === undefined);

  var realm = e2e.coname.getRealmByEmail('adon@yahoo-inc.com');
  assertEquals('object', typeof realm);

  // check that the realm is initialized
  assertTrue(realm.verification_policy.quorum_list instanceof Array);
  goog.array.forEach(realm.verification_policy.quorum_list, function(id) {
    assertTrue(realm.verification_policy.public_keys[id].ed25519Verifier !== undefined);
  });

  assertTrue(e2e.coname.realmConfig_['yahoo-inc.com'] === realm);
  asyncTestCase.continueTesting();
}


function testDecodeLookupMessage() {
  asyncTestCase.waitForAsync('Decode Lookup Messages');

  function testDecodedMessage(lookupProof) {
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
    assertTrue(lookupProof.tree_proof.existing_index instanceof Array);
    assertTrue(lookupProof.tree_proof.existing_entry_hash instanceof Array);
  }

  client.initialize().addCallback(function(proto) {

    var lookupProof = e2e.coname.decodeLookupMessage_(proto, JSON.stringify(lookupProofSample));

    testDecodedMessage(lookupProof);

    assertEquals('object', typeof lookupProof.entry.index);
    assertTrue(lookupProof.entry.encoding.length > 0);
    assertTrue(lookupProof.entry.profile_commitment.length > 0);

    assertEquals('object', typeof lookupProof.profile.nonce);
    assertTrue(lookupProof.profile.encoding.length > 0);


    var lookupProofNoBody = e2e.coname.decodeLookupMessage_(proto, JSON.stringify(lookupProofNoBodySample));
    testDecodedMessage(lookupProofNoBody);

    asyncTestCase.continueTesting();
  });
}


function testEncodeUpdateRequest() {
  asyncTestCase.waitForAsync('Encode Update Request');

  function encodeUpdateRequest_(proto, email, lookupProof) {

    var realm = e2e.coname.getRealmByEmail(email);
    var key = [1,2,3];

    var message = e2e.coname.encodeUpdateRequest_(proto, email, key, realm, lookupProof);

    assertEquals('string', typeof message.profile);
    assertEquals('string', typeof message.update.new_entry);
    assertEquals('object', typeof message.lookup_parameters);

    var newProfile = proto.Profile.decode64(message.profile);
    // at least 16 bytes (each 2 hex digits represent 1 byte)
    assertTrue(newProfile.nonce.toHex().length >= 32); 
    assertTrue(newProfile.keys.has('pgp'));

    return message;
  }

  client.initialize().addCallback(function(proto) {
    var message, oldEntry, newEntry, lookupProof;

    // update an existing profile and entry
    lookupProof = e2e.coname.decodeLookupMessage_(proto, JSON.stringify(lookupProofSample));
    oldEntry = lookupProof.entry;

    message = encodeUpdateRequest_(proto, 'adon@yahoo-inc.com', lookupProof);
    newEntry = proto.Entry.decode64(message.update.new_entry);

    // indexes representing userid are the same as the lookup one
    assertEquals(goog.crypt.base64.encodeByteArray(lookupProof.index), newEntry.index.toBase64());
    assertEquals(oldEntry.index.toBase64(), newEntry.index.toBase64());
    // version increased by 1
    assertEquals(1, newEntry.version.toNumber() - oldEntry.version.toNumber());


    // initial registration
    lookupProof = e2e.coname.decodeLookupMessage_(proto, JSON.stringify(lookupProofNoBodySample));

    message = encodeUpdateRequest_(proto, 'nobody@yahoo-inc.com', lookupProof);
    newEntry = proto.Entry.decode64(message.update.new_entry);

    // index representing userid is the same as the lookup one
    assertEquals(goog.crypt.base64.encodeByteArray(lookupProof.index), newEntry.index.toBase64());
    // version is 0 for initial registration
    assertEquals(0, newEntry.version.toNumber());



    asyncTestCase.continueTesting();
  });
}

