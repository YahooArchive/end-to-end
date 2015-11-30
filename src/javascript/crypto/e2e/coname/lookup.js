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
goog.provide('e2e.coname.verifyLookup');
goog.provide('e2e.coname.MerkleNode');

goog.require('e2e');
goog.require('e2e.ecc.Ed25519');
goog.require('e2e.ecc.PrimeCurve');
goog.require('e2e.error.InvalidArgumentsError');
goog.require('e2e.vrf.sha3');
goog.require('e2e.vrf.verify');


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
 *    depth: number,
 *    index: ?e2e.ByteArray,
 *    value: ?e2e.ByteArray,
 *    children: ?Array.<object>
 * }}
 */
e2e.coname.MerkleNode;


/**
 * @private
 * In each byte, the bits are ordered MSB to LSB
 * @param {number} num The number of bits
 * @param {!e2e.ByteArray} byteArray The byte array
 * @return {Array.<boolean>} The bit array
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
  var bs = [], i = 0, n = bits.length;
  for (; i < n; i += 8) {
    bs[i / 8] = bits[i] << 7 | bits[i + 1] << 6 |
                bits[i + 2] << 5 | bits[i + 3] << 4 |
                bits[i + 4] << 3 | bits[i + 5] << 2 |
                bits[i + 6] << 1 | bits[i + 7];
  }
  return bs;
};


/**
 * @private
 * @param {object} cfg The config object
 * @param {string} user The username
 * @return {object} ret The *proto.RealmConfig
 */
e2e.coname.getRealmByUser_ = function(cfg, user) {
  var i = user.lastIndexOf('@');
  if (i === -1) {
    throw new e2e.error.InvalidArgumentsError(
        'GetRealm: user must be of the form .*@.* (got ' + user + ')');
  }
  return e2e.coname.getRealmByDomain_(cfg, user.slice(i + 1));
};


/**
 * @private
 * @param {object} cfg The config object
 * @param {string} domain The domain name
 * @return {object} ret The *proto.RealmConfig
 */
e2e.coname.getRealmByDomain_ = function(cfg, domain) {
  var ret = null;
  cfg.realms.forEach(function(realm) {
    realm.domains.forEach(function(pattern) {
      if (pattern === domain) { // TODO: implement wildcards?
        if (ret !== null && ret !== realm) {
          throw new e2e.error.InvalidArgumentsError(
              'GetRealmByDomain: multiple realms match ' + domain +
              ': ' + realm + ' and ' + ret);
        }
        ret = realm;
      }
    });
  });
  if (ret === null) {
    throw new e2e.error.InvalidArgumentsError(
        'GetRealm: unknown domain ' + domain);
  }
  return ret;
};




/**
 * @private
 * @param {e2e.coname.MerkleNode} n The MerkleNode
 * @param {number} childId Number 1 stands for the right child, 0 for the left
 * @return {object} the child
 */
e2e.coname.merkleChild_ = function(n, childId) {
  // Give an error if the lookup algorithm tries to access anything the
  //  server didn't provide us.
  if (n.children[childId].Omitted !== null) {
    throw new e2e.error.InvalidArgumentsError("can't access omitted node");
  }
  // This might still be null if the branch is in fact empty.
  return n.children[childId].Present;
};


/**
 * @private
 * treeLookup looks up the entry at a particular index in the snapshot
 * @param {e2e.coname.MerkleNode} root The MerkleNode
 * @param {!e2e.ByteArray} indexBytes The index bytes
 * @return {?e2e.ByteArray} the entry value
 */
e2e.coname.merkleTreeLookup_ = function(root, indexBytes) {
  if (indexBytes.length !== e2e.coname.MERKLE_INDEX_BYTES) {
    throw new e2e.error.InvalidArgumentsError('Wrong index length');
  }
  if (root === null) {
    // Special case: The tree is empty.
    return null;
  }
  var descendingRight,
      n = root,
      indexBits = e2e.coname.toBits_(e2e.coname.MERKLE_INDEX_BITS, indexBytes);

  // Traverse down the tree, following either the left or right child
  //  depending on the next bit.
  while (n.children) {  // i.e., !isLeaf()
    descendingRight = indexBits[n.depth];
    n = e2e.coname.merkleChild_(n, descendingRight);
    if (n === null) {
      // There's no leaf with this index.
      return null;
    }
  }
  // Once a leaf node is reached, compare the entire index stored in the leaf
  //  node.
  return e2e.compareByteArray(indexBytes, n.index) ?
      // The leaf exists: we will simply return the value.
      n.value :
      // There is no leaf with the requested index.
      null;
};


/**
 * @private
 * @param {!e2e.ByteArray} commitment The commitment
 * @param {object} profile The profile *proto.EncodedProfile
 * @return {Boolean} whether the commitment is validated
 */
e2e.coname.checkCommitment_ = function(commitment, profile) {
  // The hash used here is modeled as a random oracle. This means that SHA3
  // is fine but SHA2 is not (consider HMAC-SHA2 instead).
  var commitmentCheck = e2e.vrf.sha3.shake256(64).
                        update(profile.encoding). // includes a nonce
                        digest();

  return e2e.compareByteArray(commitment, commitmentCheck);
};


/**
 * CheckQuorum evaluates whether the quorum requirement want can be satisfied
 * by ratifications of the verifiers in have.
 * @private
 * @param {object} want The quorum requirement
 * @param {object} have The ratifications
 * @return {boolean} whether the quorum is validated
 */
e2e.coname.checkQuorum_ = function(want, have) {
  if (!want) {
    return true; // no requirements
  }

  var n = 0;
  want.candidates && want.candidates.forEach(function(verifier){
    have[verifier] && n++;
  });

  want.subexpressions && want.subexpressions.forEach(function(e){
    e2e.coname.checkQuorum_(e, have) && n++;
  });

  return n >= want.threshold;
};


/**
 * flattenQuorum_ puts all (nested) quorums into a flattened array
 * @private
 * @param {object} quorums The quorum requirement
 * @param {?Array.<object>} out The array
 * @return {Array.<object>} an array of all quorums
 */
e2e.coname.flattenQuorum_ = function(quorums, out) {
  if (!quorums) {
    return [];
  }

  out || (out = []);
  
  if (quorums.candidates) {
    out = out.concat(quorums.candidates);
  }

  quorums.subexpressions && quorums.subexpressions.forEach(function(e){
    out = e2e.coname.flattenQuorum_(e, out);
  });

  return out;
}

/**
 * verifyQuorumSignature_ returns true iff sig is a valid signature of message
 * by verifier
 * @private
 * @param {!e2e.ByteArray} pk The quorum public key
 * @param {!e2e.ByteArray} message The message
 * @param {!e2e.ByteArray} sig The sigature
 * @return {boolean} whether the signature is valid
 */
e2e.coname.verifyQuorumSignature_ = function(pk, message, sig) {
  var pubKeyType = Object.keys(pk)[0];

  switch (pubKeyType) {
    case 'ed25519':
      return new e2e.ecc.Ed25519(e2e.ecc.PrimeCurve.ED_25519, {
        'pubKey': pk[pubKeyType]
      }).verify(message, sig);
  }

  return false;
}


/**
 * @private
 * @param {object} rcg The RealmConfig
 * @param {object} ratifications The []*proto.SignedEpochHead
 * @param {Date} now The current time
 * @return {!e2e.ByteArray} the root hash
 */
e2e.coname.verifyConsensus_ = function(rcg, ratifications, now) {
  var i = 1, n = ratifications.length, want, got, pks, have = {}, t, valid, 
    verifyQuorumSignature_ = e2e.coname.verifyQuorumSignature_;

  if (n === 0) {
    throw new e2e.error.InvalidArgumentsError(
        "VerifyConsensus: no signed epoch heads provided");
  }
  // check that all the SEHs have the same head
  for (; i < n; i++) {
    want = ratifications[0].head.head.encoding;
    got = ratifications[i].head.head.encoding;
    if (!e2e.compareByteArray(want, got)) {
      throw new e2e.error.InvalidArgumentsError(
        "VerifyConsensus: epoch heads don't match: " + want + " vs " + got);
    }
  }
  // check that the seh is not expired
  // t = ratifications[0].Head.Head.IssueTime.Time().Add(rcg.EpochTimeToLive.Duration());
  t = (ratifications[0].head.head.issue_time.seconds + rcg.epoch_time_to_live.seconds) * 1000;
  if (now.getTime() > t) {
    n = new Date();
    n.setTime(t);
    throw new e2e.error.InvalidArgumentsError(
        "VerifyConsensus: epoch expired at " + n + " < " + now);
  }

  // check that there are sufficiently many fresh signatures.
  pks = rcg.verification_policy.public_keys;
  want = rcg.verification_policy.quorum;
  valid = e2e.coname.flattenQuorum_(want).some(function(id){
    ratifications.some(function(seh){
      var sig = seh.signatures[id];
      return (sig && verifyQuorumSignature_(pks[id], seh.head.encoding, sig)) ?
        (have[id] = true) : 
        false;
    });
    return e2e.coname.checkQuorum_(want, have);
  });

  if (valid) {
    return ratifications[0].head.head.root_hash;
  }

  throw new e2e.error.InvalidArgumentsError(
      "VerifyConsensus: insufficient signatures (have " + 
      JSON.stringify(have) + ", want " + 
      JSON.stringify(want) + ")");
};


/**
 * @private
 * assumes ownership of the array underlying prefixBits
 * @param {!e2e.ByteArray} treeNonce The tree nonce
 * @param {Array.<boolean>} prefixBits The prefix bits
 * @param {object} node The ReconstructedNode
 * @return {!e2e.ByteArray}
 */
e2e.coname.recomputeHash_ = function(treeNonce, prefixBits, node) {
  var shake256 = e2e.vrf.sha3.shake256(e2e.coname.MERKLE_HASH_BYTES);
  if (node === null) {
    // return HashEmptyBranch(treeNonce, prefixBits);
    // This is the same as in the CONIKS paper.
    // H(k_empty || nonce || prefix || depth)
    return shake256.update(e2e.coname.MERKLE_NODEID_EMPTY_BRANCH).
          update(treeNonce).
          update(e2e.coname.toBytes_(prefixBits)).
          // reverse e2e.numberToByteArray() to get little-endian
          update(e2e.numberToByteArray(prefixBits.length).reverse()).
          digest();

  } else if (!node.children) { // i.e., isLeaf()
    // return HashLeaf(treeNonce, node.index, node.depth, node.value);
    // This is the same as in the CONIKS paper:
    // H(k_leaf || nonce || index || depth || value)
    return shake256.update(e2e.coname.MERKLE_NODEID_LEAF).
          update(treeNonce).
          update(node.index).
          // reverse e2e.numberToByteArray() to get little-endian
          update(e2e.numberToByteArray(node.depth).reverse()).
          update(node.value).
          digest();

  } else {
    for (var h, childHashes = [], i = 0; i < 2; i++) {
      h = node.children[i];

      childHashes[i] = h.Omitted ? 
                        h.Omitted : 
                        e2e.coname.recomputeHash_(treeNonce, 
                              prefixBits.concat(i === 1),
                              h.Present);
    }

    throw new e2e.error.InvalidArgumentsError(JSON.stringify(prefixBits));

    // return HashInternalNode(prefixBits, childHashes);
    // Differences from the CONIKS paper:
    // * Add an identifier byte at the beginning to make it impossible for this
    //   to collide with leaves or empty branches.
    // * Add the prefix of the index, to protect against limited hash
    //   collisions or bugs.
    // This gives H(k_internal || h_child0 || h_child1 || prefix || depth)
    return shake256.
          update(e2e.coname.MERKLE_NODEID_INTERNAL).
          update(childHashes[0] || []).
          update(childHashes[1] || []).
          update(e2e.coname.toBytes_(prefixBits)).
          // reverse e2e.numberToByteArray() to get little-endian
          update(e2e.numberToByteArray(prefixBits.length).reverse()).
          digest();
  }

};


/**
 * @private
 * @param {object} trace The tree proof *proto.TreeProof
 * @param {!e2e.ByteArray} lookupIndexBits The bit array of the lookup index
 * @param {Number} depth The depth of the tree
 * @return {e2e.coname.MerkleNode}
 */
e2e.coname.reconstructBranch_ = function(trace, lookupIndexBits, depth) {
  if (depth === trace.neighbors.length) {
    if (trace.existing_entry_hash === null) {
      return null;
    } else {
      return {
        depth: depth,
        index: trace.existing_index,
        value: trace.existing_entry_hash
      };
    }
  } else {
    var presentChild = lookupIndexBits[depth], 
        children = [{}, {}];

    children[presentChild ? 1 : 0].Present =
        e2e.coname.reconstructBranch_(trace, lookupIndexBits, depth + 1);
    children[presentChild ? 0 : 1].Omitted = trace.neighbors[depth];

    return {
      depth: depth,
      children: children
    };
  }
};


/**
 * @private
 * @param {object} trace The tree proof *proto.TreeProof
 * @param {!e2e.ByteArray} lookupIndexBits The bit array of the lookup index
 * @return {object} the ReconstructedNode
 */
e2e.coname.reconstructTree_ = function(trace, lookupIndexBits) {
  return e2e.coname.reconstructBranch_(trace, lookupIndexBits, 0);
};


/**
 * @private
 * @param {!e2e.ByteArray} treeNonce The tree nonce
 * @param {!e2e.ByteArray} rootHash The root hash
 * @param {!e2e.ByteArray} index The user index
 * @param {object} proof The tree proof *proto.TreeProof
 * @return {?e2e.ByteArray} the verified EntryHash
 */
e2e.coname.reconstructTreeAndLookup_ = function(
                                           treeNonce, rootHash, index, proof) {

  // First, reconstruct the partial tree
  var reconstructedHash,
      reconstructed = e2e.coname.reconstructTree_(
          proof, e2e.coname.toBits_(e2e.coname.MERKLE_INDEX_BITS, index));

  // Reconstruct the root hash
  reconstructedHash = e2e.coname.recomputeHash_(treeNonce, [], reconstructed);

  throw new e2e.error.InvalidArgumentsError(reconstructedHash);


  // Compare root hashes
  if (!e2e.compareByteArray(reconstructedHash, rootHash)) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: failed to verify the lookup: ' +
        'Root hashes do not match! Reconstructed ' + reconstructedHash +
        '; wanted ' + rootHash);
  }
  // Then, do the lookup
  value = e2e.coname.merkleTreeLookup_(reconstructed, index);
  // if (err !== null) {
  //  throw new e2e.error.InvalidArgumentsError(
  //    "VerifyLookup: failed to verify the lookup: " + err);
  // }
  return value;
};


/**
 * Returns the profile keys if the lookup is correctly validated
 * Refer to https://github.com/yahoo/coname/blob/master/lookup.go#L49-L90
 *
 * @param {object} cfg The config object
 * @param {string} user The username
 * @param {object} pf The lookup proof retrieved from the keyserver
 * @param {Date} now The current time
 * @return {?object} the profile keys (map[string][]byte)
 */
e2e.coname.verifyLookup = function(cfg, user, pf, now) {
  var realm, root, verifiedEntryHash, entryHash;

  if (pf.user_id !== '' && pf.user_id !== user) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: proof specifies different user ID: ' +
        pf.user_id + ' != ' + user);
  }

  realm = e2e.coname.getRealmByUser_(cfg, user);

  if (!e2e.vrf.verify(realm.VRFPublic,
      // user is converted into a UTF-8 encoded byte array
      e2e.stringToByteArray(user),
      pf.index,
      pf.index_proof)) {
    throw new e2e.error.InvalidArgumentsError(
        'VerifyLookup: VRF verification failed');
  }

  root = e2e.coname.verifyConsensus_(realm, pf.ratifications, now);

  verifiedEntryHash = e2e.coname.reconstructTreeAndLookup_(
      realm.tree_nonce || [], root, pf.index, pf.tree_proof);

  if (verifiedEntryHash === null) {
    if (pf.entry !== null) {
      throw new e2e.error.InvalidArgumentsError(
          'VerifyLookup: non-empty entry ' + pf.entry +
          ' did not match verified lookup result <null>');
    }
    if (pf.profile !== null) {
      throw new e2e.error.InvalidArgumentsError(
          'VerifyLookup: non-empty profile ' + pf.profile +
          ' did not match verified lookup result <null>');
    }
    return null;
  } else {

    entryHash = e2e.vrf.sha3.shake256(32).
            update(pf.entry.encoding).
            digest();

    if (!e2e.compareByteArray(entryHash, verifiedEntryHash)) {
      throw new e2e.error.InvalidArgumentsError(
          'VerifyLookup: entry hash ' + entryHash +
          ' did not match verified lookup result ' + verifiedEntryHash);
    }

    if (!e2e.coname.checkCommitment_(
        pf.entry.profileCommitment, pf.profile)) {
      throw new e2e.error.InvalidArgumentsError(
          'VerifyLookup: profile does not match the hash in the entry');
    }

    return pf.profile.keys;
  }
};
