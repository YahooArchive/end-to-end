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

goog.require('e2e');
goog.require('e2e.vrf.verify');
goog.require('e2e.vrf.sha3.shake256');



/**
 * 
 * @param {object} cfg The config object
 * @param {string} user The username encoded in ASCII
 * @return {object} ret The *proto.RealmConfig
 */
e2e.coname.getRealmByUser_ = function(cfg, user) {
	return {};
}

/**
 * 
 * @param {object} rcg The RealmConfig
 * @param {object} ratifications The []*proto.SignedEpochHead
 * @param {Date} now The current time
 * @return {!e2e.ByteArray} root
 */
e2e.coname.verifyConsensus_ = function(rcg, ratifications, now) {
	return [];
}



/**
 * 
 * @param {object} trace The tree proof *proto.TreeProof
 * @param {!e2e.ByteArray} lookupIndexBits The bit array of the lookup index
 * @return {object} the ReconstructedNode
 */
e2e.coname.reconstructTree_ = function(trace, lookupIndexBits) {
	return e2e.coname.reconstructBranch_(trace, lookupIndexBits, 0);
}


/**
 * 
 * @param {object} trace The tree proof *proto.TreeProof
 * @param {!e2e.ByteArray} lookupIndexBits The bit array of the lookup index
 * @param {Number} depth The depth of the tree
 * @return {object} the ReconstructedNode
 */

e2e.coname.reconstructBranch_ = function(trace, lookupIndexBits, depth) {
	if (depth === trace.Neighbors.length) {
		if (trace.ExistingEntryHash === null) {
			return null;
		} else {
			return /* &ReconstructedNode */ {
				isLeaf: true,
				depth:  depth,
				index:  trace.ExistingIndex,
				value:  trace.ExistingEntryHash
			};
		}
	} else {
		var node = /* &ReconstructedNode */ {
				isLeaf: false,
				depth:  depth,
				children: {}
			}, 
			presentChild = lookupIndexBits[depth];

		node.children[presentChild ? 1 : 0].Present = e2e.coname.reconstructBranch_(trace, lookupIndexBits, depth+1);
		node.children[presentChild ? 0 : 1].Omitted = trace.Neighbors[depth];
		return node;
	}
}


// https://github.com/yahoo/coname/blob/master/merkle.go#L142-L149
e2e.coname.toBits_ = function(num, bs) {
	// In each byte, the bits are ordered MSB to LSB
	for (var bits = [], i = 0; i < num; i++) {
		// bits[i] = (bs[Math.floor(i/8)] << i%8) & (1<<7) > 0;
		bits[i] = (bs[Math.floor(i/8)] << i%8) & 128 > 0;
	}
	return bits;

}


/**
 * @private IndexBits
 */
e2e.coname.IndexBytes = 32;

/**
 * @private IndexBits
 */
e2e.coname.IndexBits = e2e.coname.IndexBytes * 8;


/**
 * 
 * @param {!e2e.ByteArray} treeNonce The tree nonce
 * @param {!e2e.ByteArray} rootHash The root hash
 * @param {!e2e.ByteArray} index The user index
 * @param {object} proof The tree proof *proto.TreeProof
 * @return {e2e.ByteArray|null} the verified EntryHash
 */
e2e.coname.reconstructTreeAndLookup_ = function(treeNonce, rootHash, index, proof) {

	// First, reconstruct the partial tree
	reconstructed = e2e.coname.reconstructTree_(proof, e2e.coname.toBits_(e2e.coname.IndexBits, index))
	// TODO: this will never get fired
	// if (err !== null) {
	// 	throw new e2e.error.InvalidArgumentsError(
	// 		"VerifyLookup: failed to verify the lookup: " + err);
	// }


	// // Reconstruct the root hash
	// reconstructedHash = e2e.coname.recomputeHash_(treeNonce, reconstructed)
	// if (err !== null) {
	// 	throw new e2e.error.InvalidArgumentsError(
	// 		"VerifyLookup: failed to verify the lookup: " + err);
	// }
	// // Compare root hashes
	// if (!e2e.compareByteArray(reconstructedHash, rootHash)) {
	// 	throw new e2e.error.InvalidArgumentsError(
	// 		"VerifyLookup: failed to verify the lookup: " + 
	// 		"Root hashes do not match! Reconstructed " + reconstructedHash + 
	// 		"; wanted " + rootHash);
	// }
	// // Then, do the lookup
	// value = e2e.coname.treeLookup_(reconstructed, index)
	// if (err !== null) {
	// 	throw new e2e.error.InvalidArgumentsError(
	// 		"VerifyLookup: failed to verify the lookup: " + err);
	// }
	// return value;
}

/**
 * 
 * @param {!e2e.ByteArray} commitment The commitment
 * @param {object} profile The profile *proto.EncodedProfile
 * @return {Boolean} whether the commitment is validated
 */
e2e.coname.checkCommitment_ = function(commitment, profile) {
	// The hash used here is modeled as a random oracle. This means that SHA3
	// is fine but SHA2 is not (consider HMAC-SHA2 instead).
	var commitmentCheck = e2e.vrf.sha3.shake256(64).
							update(profile.Encoding). // includes a nonce
							digest();

	return e2e.compareByteArray(commitment, commitmentCheck);
}



/**
 * Returns the profile keys if the lookup is correctly validated
 * Refer to https://github.com/yahoo/coname/blob/master/lookup.go#L49-L90
 *
 * @param {object} cfg The config object
 * @param {string} user The username encoded in ASCII
 * @param {object} pf The lookup proof retrieved from the keyserver
 * @param {Date} now The current time
 * @return {object|null} the profile keys if validated (in the format of map[string][]byte)
 */
e2e.coname.verifyLookup = function(cfg, user, pf, now) {
	var realm, userByteArray, root, verifiedEntryHash, entryHash;

	if (pf.UserId !== '' && pf.UserId !== user) {
		throw new e2e.error.InvalidArgumentsError(
        	'VerifyLookup: proof specifies different user ID: ' + 
        	pf.UserId + ' != ' + user);
	}

	realm = e2e.coname.getRealmByUser_(cfg, user);

	userByteArray = user.split('').map(function(chr){
		return chr.charCodeAt(0);
	});

	if (!e2e.vrf.verify(
			realm.VRFPublic, userByteArray, pf.Index, pf.IndexProof)) {
		throw new e2e.error.InvalidArgumentsError(
			'VerifyLookup: VRF verification failed');
	}

	root = e2e.coname.verifyConsensus_(realm, pf.Ratifications, now);
	
	verifiedEntryHash = e2e.coname.reconstructTreeAndLookup_(
		realm.TreeNonce, root, pf.Index, pf.TreeProof);

	if (verifiedEntryHash === null) {
		if (pf.Entry !== null) {
			throw new e2e.error.InvalidArgumentsError(
				"VerifyLookup: non-empty entry " + pf.Entry + 
				" did not match verified lookup result <null>");
		}
		if (pf.Profile !== null) {
			throw new e2e.error.InvalidArgumentsError(
				"VerifyLookup: non-empty profile " + pf.Profile + 
				" did not match verified lookup result <null>");
		}
		return null;
	} else {

		entryHash = e2e.vrf.sha3.shake256(32).
						update(pf.Entry.Encoding).
						digest();

		if (!e2e.compareByteArray(entryHash, verifiedEntryHash)) {
			throw new e2e.error.InvalidArgumentsError(
				"VerifyLookup: entry hash " + entryHash + 
				" did not match verified lookup result " + verifiedEntryHash);
		}

		if (!e2e.coname.checkCommitment_(
				pf.Entry.ProfileCommitment, pf.Profile)) {
			throw new e2e.error.InvalidArgumentsError(
				"VerifyLookup: profile does not match the hash in the entry");
		}

		return pf.Profile.Keys;
	}
}