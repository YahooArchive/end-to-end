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
 * @fileoverview The Yahoo E2E vrf.verify() implementation
 * This is ported from https://github.com/yahoo/coname/blob/master/vrf/vrf.go
 */

goog.provide('e2e.coname.vrf');
goog.provide('e2e.coname.vrf.verify');

goog.require('e2e');
goog.require('e2e.BigNum');
goog.require('e2e.coname.sha3');
goog.require('e2e.coname.vrf.extra25519');
goog.require('e2e.ecc.DomainParam');
goog.require('e2e.ecc.PrimeCurve');


/**
 * @private Public Key Size
 */
e2e.coname.vrf.PUBLIC_KEY_SIZE_ = 32;


/**
 * @private VRF Size
 */
e2e.coname.vrf.SIZE_ = 32;


/**
 * @private Intermediate Size
 */
e2e.coname.vrf.INTERMEDIATE_SIZE_ = 32;


/**
 * @private Proof Size
 */
e2e.coname.vrf.PROOF_SIZE_ = 32 + 32 + e2e.coname.vrf.INTERMEDIATE_SIZE_;


/**
 * @private Domain Params for ed25519
 */
e2e.coname.vrf.ed25519_ = e2e.ecc.DomainParam.fromCurve(
    e2e.ecc.PrimeCurve.ED_25519);


/**
 * Returns true iff the vrf is correctly validated
 * Refer to https://github.com/yahoo/coname/blob/master/vrf/vrf.go
 *
 * @param {!e2e.ByteArray} pk The public key, in a byte array of length 32
 * @param {!e2e.ByteArray} m The message, in a byte array of length 32
 * @param {!e2e.ByteArray} vrf The vrf, in a byte array of length 32
 * @param {!e2e.ByteArray} proof The proof, containing c t iiB, each
 *  consisting of 32 bytes in a byte array of length 96
 * @return {boolean}
 */
e2e.coname.vrf.verify = function(pk, m, vrf, proof) {

  if (proof.length !== e2e.coname.vrf.PROOF_SIZE_ ||
      vrf.length !== e2e.coname.vrf.SIZE_ ||
      pk.length !== e2e.coname.vrf.PUBLIC_KEY_SIZE_) {
    return false;
  }

  var ed25519 = e2e.coname.vrf.ed25519_;

  // copy(vrf[:], vrfBytes)
  // copy(pk[:], pkBytes)
  // copy(c[:32], proof[:32])
  // copy(t[:32], proof[32:64])
  // copy(iiB[:], proof[64:96])
  var c = new e2e.BigNum(proof.slice(0, 32).reverse());
  var t = new e2e.BigNum(proof.slice(32, 64).reverse());
  var iiB = proof.slice(64, 96);

  // hash := sha3.NewShake256()
  // hash.Write(iiB[:]) // const length
  // hash.Write(m)
  // var hCheck [Size]byte
  // hash.Read(hCheck[:])
  // if !bytes.Equal(hCheck[:], vrf[:]) {
  //  return false
  // }
  // hash.Reset()

  var hash = e2e.coname.sha3.shake256(32).update(iiB).update(m).digest();
  if (!e2e.compareByteArray(hash, vrf)) {
    return false;
  }

  try {
    // var P, B, ii, iic edwards25519.ExtendedGroupElement
    // var A, hmtP, iicP edwards25519.ProjectiveGroupElement

    // if !P.FromBytesBaseGroup(&pk) {
    //   return false
    // }
    // if !ii.FromBytesBaseGroup(&iiB) {
    //   return false
    // }
    var P = e2e.coname.vrf.extra25519.fromBytesBaseGroup(pk);
    if (P === false) {
      return P;
    }
    var ii = e2e.coname.vrf.extra25519.fromBytesBaseGroup(iiB);
    if (ii === false) {
      return ii;
    }

    // edwards25519.GeDoubleScalarMultVartime(&A, &c, &P, &t)
    // A.ToBytes(&ABytes)
    var ABytes = P.multiply(c).add(ed25519.curve.B.multiply(t)).toByteArray();

    // hm := hashToCurve(m)
    // edwards25519.GeDoubleScalarMultVartime(&hmtP, &t, hm, &[32]byte{})
    // edwards25519.GeDoubleScalarMultVartime(&iicP, &c, &ii, &[32]byte{})
    var hm = e2e.coname.vrf.hashToCurve(m);
    var zeroB = ed25519.curve.B.multiply(e2e.BigNum.ZERO);
    var hmtP = hm.multiply(t).add(zeroB);
    var iicP = ii.multiply(c).add(zeroB);

    // iicP.ToExtended(&iic)
    // hmtP.ToExtended(&B)
    // edwards25519.GeAdd(&B, &B, &iic)
    // B.ToBytes(&BBytes)
    var BBytes = iicP.add(hmtP).toByteArray();


    // var cH [64]byte
    // hash.Write(ABytes[:]) // const length
    // hash.Write(BBytes[:]) // const length
    // hash.Write(m)
    // hash.Read(cH[:])

    // the two ABytes and BBytes must be of length 32
    // ref: e2e.ecc.point.Ed25519.prototype.toByteArray
    hash = e2e.coname.sha3.shake256(64)
        .update(ABytes)
        .update(BBytes)
        .update(m)
        .digest();

    // edwards25519.ScReduce(&cRef, &cH)
    var cRef = ed25519.n.residue(new e2e.BigNum(hash.reverse()));

    // return cRef == c
    return cRef.isEqual(c);

  } catch (e) {
    return false;
  }
};


/**
 * Converts an 32-byte hashed output to an Ed25519 point using Elligator.
 * This point is multiplied by 8. This is not constant time due to use of
 * hashToEdwards
 *
 * Refer to Section 5.2 in http://elligator.cr.yp.to/elligator-20130828.pdf
 * @param {!e2e.ByteArray} m A byte array of length 32
 * @return {!e2e.ecc.point.Ed25519}
 */
e2e.coname.vrf.hashToCurve = function(m) {

  // H(n) = (f(h(n))^8)
  // var hmb [32]byte
  // sha3.ShakeSum256(hmb[:], m)
  var hmb = e2e.coname.sha3.shake256(32).update(m).digest();

  // var hm edwards25519.ExtendedGroupElement
  // extra25519.HashToEdwards(&hm, &hmb)
  // edwards25519.GeDouble(&hm, &hm)
  // edwards25519.GeDouble(&hm, &hm)
  // edwards25519.GeDouble(&hm, &hm)
  // return &hm

  var hm = e2e.coname.vrf.extra25519.hashToEdwards(hmb);
  hm = hm.add(hm);
  hm = hm.add(hm);
  hm = hm.add(hm);
  return hm;
};
