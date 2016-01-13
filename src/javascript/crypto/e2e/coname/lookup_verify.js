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
 * @fileoverview The Yahoo E2E Lookup Verify implementation
 * This is ported from https://github.com/yahoo/coname/blob/master/lookup.go
 */
goog.provide('e2e.coname');
goog.provide('e2e.coname.EpochHead');
goog.provide('e2e.coname.ServerResponse');
goog.provide('e2e.coname.MerkleLeaf');
goog.provide('e2e.coname.MerkleNode');
goog.provide('e2e.coname.SignedEpochHead');
goog.provide('e2e.coname.Timestamp');
goog.provide('e2e.coname.TreeProof');
goog.provide('e2e.coname.verifyLookup');

goog.require('e2e');
goog.require('e2e.coname.sha3');
goog.require('e2e.coname.vrf');
goog.require('e2e.error.InvalidArgumentsError');
goog.require('goog.array');


/**
 * @const
 * @type {number}
 */
e2e.coname.MERKLE_HASH_BYTES = 32;


/**
 * @const
 * @type {number}
 */
e2e.coname.MERKLE_INDEX_BYTES = 32;


/**
 * @const
 * @type {number}
 */
e2e.coname.MERKLE_INDEX_BITS = e2e.coname.MERKLE_INDEX_BYTES * 8;


/**
 * @const
 * @type {e2e.ByteArray}
 */
e2e.coname.MERKLE_NODEID_INTERNAL = [73]; // ['I'.charCodeAt(0)]


/**
 * @const
 * @type {e2e.ByteArray}
 */
e2e.coname.MERKLE_NODEID_LEAF = [76]; // ['L'.charCodeAt(0)]


/**
 * @const
 * @type {e2e.ByteArray}
 */
e2e.coname.MERKLE_NODEID_EMPTY_BRANCH = [69]; // ['E'.charCodeAt(0)]


/**
 * Refer to https://github.com/yahoo/coname/blob/master/merkle.go#L31-L44
 * @typedef {{
 *  depth: !number,
 *  children:!Array.<e2e.ByteArray|e2e.coname.MerkleNode|e2e.coname.MerkleLeaf>
 * }}
 */
e2e.coname.MerkleNode;


/**
 * Refer to https://github.com/yahoo/coname/blob/master/merkle.go#L31-L44
 * @typedef {{
 *    depth: !number,
 *    index: !e2e.ByteArray,
 *    value: !e2e.ByteArray
 * }}
 */
e2e.coname.MerkleLeaf;


/**
 * The structure of tree proof
 * @typedef {{
 *    neighbors: Array.<e2e.ByteArray>,
 *    existing_index: e2e.ByteArray,
 *    existing_entry_hash: e2e.ByteArray
 * }}
 */
e2e.coname.TreeProof;


/**
 * The structure of tree proof
 * @typedef {{
 *    realm: !string,
 *    epoch: !Long,
 *    root_hash: !e2e.ByteArray,
 *    issue_time: !number,
 *    previous_summary_hash: !e2e.ByteArray,
 *    next_epoch_policy: ProtoBuf.Builder.Message,
 *    encoding: (e2e.ByteArray|Uint8Array)
 * }}
 */
e2e.coname.EpochHead;


/**
 * The structure of Timestamp
 * @typedef {{seconds: Long, nanos: number}}
 */
e2e.coname.Timestamp;


/**
 * The structure of Signed Epoch Head
 * @typedef {{
 *    head: e2e.coname.EpochHead,
 *    timestamp: e2e.coname.Timestamp,
 *    signatures: Object<string, e2e.ByteArray>,
 *    encoding: (e2e.ByteArray|Uint8Array)
 * }}
 */
e2e.coname.SignedEpochHead;


/**
 * The structure of Lookup response message
 * @typedef {{
 *    user_id: !string,
 *    index: !e2e.ByteArray,
 *    index_proof: !e2e.ByteArray,
 *    ratifications: ?Array.<e2e.coname.SignedEpochHead>,
 *    tree_proof: !e2e.coname.TreeProof,
 *    entry: (undefined|ProtoBuf.Builder.Message),
 *    profile: (undefined|ProtoBuf.Builder.Message)
 * }}
 */
e2e.coname.ServerResponse;


/**
 * @private
 * In each byte, the bits are ordered MSB to LSB
 * @param {!number} num The number of bits
 * @param {!e2e.ByteArray} byteArray The byte array
 * @return {!Array.<boolean>} The bit array
 */
e2e.coname.toBits_ = function(num, byteArray) {
  for (var bits = [], i = 0, b; i < num; i += 8) {
    b = byteArray[i / 8];
    bits[i] = (b & 128) > 0;
    bits[i + 1] = (b & 64) > 0;
    bits[i + 2] = (b & 32) > 0;
    bits[i + 3] = (b & 16) > 0;
    bits[i + 4] = (b & 8) > 0;
    bits[i + 5] = (b & 4) > 0;
    bits[i + 6] = (b & 2) > 0;
    bits[i + 7] = (b & 1) > 0;
  }
  return bits;
};


/**
 * @private
 * In each byte, the bits are ordered MSB to LSB
 * @param {Array.<boolean>} bits The bit array
 * @return {!e2e.ByteArray} The byte array
 */
e2e.coname.toBytes_ = function(bits) {
  for (var i = 0, n = bits.length, bs = []; i < n; i++) {
    bs[Math.floor(i / 8)] |= bits[i] ? (128 >> (i % 8)) : 0;
  }
  return bs;
};


/**
 * CheckQuorum evaluates whether the quorum requirement want can be
 * satisfied by ratifications of the verifiers in have.
 * @private
 * @param {e2e.coname.QuorumRequirement} want The quorum requirement
 * @param {Object<string, boolean>} have The valid verifier ids
 * @return {boolean} whether the quorum is validated
 */
e2e.coname.checkQuorum_ = function(want, have) {
  if (!want) {
    return true; // no requirements
  }

  var n = 0;
  want.candidates && goog.array.forEach(want.candidates, function(verifier) {
    have[verifier] && n++;
  });

  want.subexpressions && goog.array.forEach(want.subexpressions, function(e) {
    e2e.coname.checkQuorum_(e, have) && n++;
  });

  return n >= want.threshold;
};


/**
 * @private
 * @param {!e2e.coname.RealmConfig} rcg The realm config
 * @param {Array.<e2e.coname.SignedEpochHead>} ratifications The array of
 *        Signed Epoch Head
 * @param {!Date} now The current time
 * @return {boolean} whether sufficient ratifications are in consensus
 */
e2e.coname.verifyConsensus_ = function(rcg, ratifications, now) {
  var i = 1, n, have = {}, want, got, t, valid, pks, firstHeadHead;

  if (!ratifications || (n = ratifications.length) === 0) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyConsensus: no signed epoch heads provided');
  }

  // check that all the SEHs have the same head
  firstHeadHead = ratifications[0].head.head;
  want = firstHeadHead.encoding;
  for (; i < n; i++) {
    got = ratifications[i].head.head.encoding;
    if (!e2e.compareByteArray(want, got)) {
      throw new e2e.error.InvalidArgumentsError(
          'VerifyConsensus: epoch heads don\'t match: ' + want + ' vs ' + got);
    }
  }

  // check that the seh corresponds to the realm in question
  if (firstHeadHead.realm !== rcg.realm_name) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyConsensus: SEH does not match realm: ' +
        firstHeadHead.realm + ' != ' + rcg.realm_name);
  }

  // check that the seh is not expired
  t = 1000 * (firstHeadHead.issue_time + rcg.epoch_time_to_live);
  if (now.getTime() > t) {
    n = new Date();
    n.setTime(t);
    throw new e2e.error.InvalidArgumentsError(
        'VerifyConsensus: epoch expired at ' + n + ' < ' + now);
  }

  // check that there are sufficiently many fresh signatures.
  pks = rcg.verification_policy.public_keys;
  // quorum_list is initialized and prepared during realm lookup
  return goog.array.some(rcg.verification_policy.quorum_list, function(id) {
    goog.array.some(ratifications, function(seh) {
      // ed25519Verifier is an initialized Ed25519 instance in realm config
      // See e2e.coname.getRealmByDomain_ for details
      var sig = seh.signatures[id], ed25519 = pks[id].ed25519Verifier;
      // sig is a valid ed25519 signature of the head
      return (sig && ed25519 && ed25519.verify(seh.head.encoding, sig)) ?
          (have[id] = true) :
          false;
    });
    return e2e.coname.checkQuorum_(rcg.verification_policy.quorum, have);
  });
};


/**
 * Converts a non-negative 32-bit integer into a 4-byte little-endian ByteArray
 * @private
 * @param {!number} value The number to convert
 * @return {!e2e.ByteArray} The number as a little-endian ByteArray.
 */
e2e.coname.numberTo4ByteArray_ = function(value) {
  if (value < 0 || value > 4294967295) {
    throw new e2e.error.InvalidArgumentsError('The number is out of range');
  }

  for (var i = 0, byteArray = [0, 0, 0, 0]; value > 0; i++) {
    byteArray[i] = value & 0xff;
    value >>>= 8;
  }
  return byteArray;
};


/**
 * @private
 * Recompute the root hash that represents the merkle tree
 * @param {!e2e.ByteArray} treeNonce The tree nonce
 * @param {Array.<boolean>} prefixBits The prefix bits
 * @param {?e2e.coname.MerkleNode|e2e.coname.MerkleLeaf} node The reconstructed
 *        node
 * @return {!e2e.ByteArray}
 */
e2e.coname.recomputeHash_ = function(treeNonce, prefixBits, node) {
  var shake256 = e2e.coname.sha3.shake256(e2e.coname.MERKLE_HASH_BYTES);
  if (!node) {
    // return HashEmptyBranch(treeNonce, prefixBits);
    // This is the same as in the CONIKS paper.
    // H(k_empty || nonce || prefix || depth)
    return shake256.update(e2e.coname.MERKLE_NODEID_EMPTY_BRANCH).
        update(treeNonce).
        update(e2e.coname.toBytes_(prefixBits)).
        update(e2e.coname.numberTo4ByteArray_(prefixBits.length)).
        digest();

  } else if (!node.children) { // i.e., isLeaf()
    // return HashLeaf(treeNonce, node.index, node.depth, node.value);
    // This is the same as in the CONIKS paper:
    // H(k_leaf || nonce || index || depth || value)
    return shake256.update(e2e.coname.MERKLE_NODEID_LEAF).
        update(treeNonce).
        update(node.index).
        update(e2e.coname.numberTo4ByteArray_(node.depth)).
        update(node.value).
        digest();

  } else {
    for (var h, childHashes = [], i = 0; i < 2; i++) {
      h = node.children[i];

      childHashes[i] = goog.isArray(h) ?
          h :
          e2e.coname.recomputeHash_(treeNonce, prefixBits.concat(i === 1), h);
    }

    // return HashInternalNode(prefixBits, childHashes);
    // Differences from the CONIKS paper:
    // * Add an identifier byte at the beginning to make it impossible for this
    //   to collide with leaves or empty branches.
    // * Add the prefix of the index, to protect against limited hash
    //   collisions or bugs.
    // This gives H(k_internal || h_child0 || h_child1 || prefix || depth)
    return shake256.
        update(e2e.coname.MERKLE_NODEID_INTERNAL).
        update(childHashes[0]).
        update(childHashes[1]).
        update(e2e.coname.toBytes_(prefixBits)).
        update(e2e.coname.numberTo4ByteArray_(prefixBits.length)).
        digest();
  }

};


/**
 * @private
 * @param {!e2e.coname.TreeProof} trace The tree proof
 * @param {!Array<boolean>} lookupIndexBits The bit array of the lookup index
 * @param {!number} depth The depth of the tree
 * @return {?e2e.coname.MerkleNode|e2e.coname.MerkleLeaf}
 */
e2e.coname.reconstructBranch_ = function(trace, lookupIndexBits, depth) {

  if (depth === trace.neighbors.length) {
    if (trace.existing_entry_hash) {
      return {
        depth: depth,
        index: trace.existing_index,
        value: trace.existing_entry_hash
      };
    }
    return null;
  }

  var children = [], presentChild = lookupIndexBits[depth] ? 1 : 0;

  children[presentChild] = e2e.coname.reconstructBranch_(
      trace, lookupIndexBits, depth + 1);
  // xor 1 can flip the bit (i.e., switching bit 0 to 1, and vice versa)
  children[presentChild ^ 1] = trace.neighbors[depth];

  return {
    depth: depth,
    children: children
  };
};


/**
 * @private
 * @param {e2e.coname.TreeProof} trace The tree proof
 * @param {!Array.<boolean>} lookupIndexBits The bit array of the lookup index
 * @return {?e2e.coname.MerkleNode|e2e.coname.MerkleLeaf}
 */
e2e.coname.reconstructTree_ = function(trace, lookupIndexBits) {
  return e2e.coname.reconstructBranch_(trace, lookupIndexBits, 0);
};


/**
 * Check if the lookup request and proof is correctly validated
 * Refer to https://github.com/yahoo/coname/blob/master/lookup.go#L49-L90
 *
 * @param {e2e.coname.RealmConfig} realm The realm config
 * @param {string} user The userid (typically email address)
 * @param {e2e.coname.ServerResponse} pf The lookup proof from keyserver
 * @return {boolean} whether the proof is properly validated
 */
e2e.coname.verifyLookup = function(realm, user, pf) {
  var tree, rootHash, entryHash, profileHash, verifiedEntryHash,
      SHA3Shake256 = e2e.coname.sha3.shake256;

  if (pf.user_id !== '' && pf.user_id !== user) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: proof specifies different user ID: ' +
        pf.user_id + ' != ' + user);
  }

  if (!e2e.coname.vrf.verify(realm.VRFPublic,
      // user is converted into a UTF-8 encoded byte array
      e2e.stringToByteArray(user),
      pf.index,
      pf.index_proof)) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: VRF verification failed');
  }

  if (!e2e.coname.verifyConsensus_(realm, pf.ratifications, new Date())) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyConsensus: insufficient signatures');
  }

  // reconstruct the partial merkle tree
  tree = e2e.coname.reconstructTree_(
      pf.tree_proof,
      e2e.coname.toBits_(e2e.coname.MERKLE_INDEX_BITS, pf.index));

  // recompute the hash of the constructed tree
  rootHash = e2e.coname.recomputeHash_(realm.tree_nonce || [], [], tree);

  // since the hash is already verified, the merkle lookup is unneccessary
  // compare root hash with the recomputed hash of the constructed tree
  if (!e2e.compareByteArray(
      rootHash,
      pf.ratifications[0].head.head.root_hash)) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: failed to verify merkle tree: Root hashes mismatch!');
  }

  // compare the entire index stored in the leaf node
  if (!e2e.compareByteArray(pf.index, pf.tree_proof.existing_index)) {
    // getting into this branch means no leaf with the requested index
    if (pf.entry) {
      throw new e2e.error.InvalidArgumentsError(
          'VerifyLookup: non-empty entry ' + JSON.stringify(pf.entry) +
          ' did not match verified lookup result <null>');
    }
    if (pf.profile) {
      throw new e2e.error.InvalidArgumentsError(
          'VerifyLookup: non-empty profile ' + JSON.stringify(pf.profile) +
          ' did not match verified lookup result <null>');
    }
    return true;
  }

  entryHash = SHA3Shake256(32).update(pf.entry.encoding).digest();

  if (!e2e.compareByteArray(entryHash, pf.tree_proof.existing_entry_hash)) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: entry hash ' + entryHash +
        ' did not match verified lookup result ' +
        pf.tree_proof.existing_entry_hash);
  }

  // The hash used here is modeled as a random oracle. This means that SHA3
  // is fine but SHA2 is not (consider HMAC-SHA2 instead).
  // profile.encoding includes a nonce
  profileHash = SHA3Shake256(64).update(pf.profile.encoding).digest();

  if (!e2e.compareByteArray(profileHash, pf.entry.profile_commitment)) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: profile does not match the hash in the entry');
  }

  return true;
};
