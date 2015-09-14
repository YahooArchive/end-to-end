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
 * @fileoverview Helper functions for the Yahoo E2E vrf.verify() implementation
 * This is ported from https://github.com/yahoo/coname/blob/master/vrf/vrf.go
 */

goog.provide('e2e.vrf.extra25519');

goog.require('goog.asserts');
goog.require('goog.crypt');
goog.require('e2e.BigNum');
goog.require('e2e.ecc.constant');
goog.require('e2e.ecc.DomainParam');
goog.require('e2e.ecc.PrimeCurve');

goog.require('e2e.vrf.sha3Shake256');

e2e.vrf.ed25519 = e2e.ecc.DomainParam.fromCurve(e2e.ecc.PrimeCurve.ED_25519);
e2e.vrf.curve25519 = e2e.ecc.DomainParam.fromCurve(e2e.ecc.PrimeCurve.CURVE_25519);


/**
 * Unmarshals an elliptic curve point, and validates that it is an Ed25519 public key
 * Refer to Definition 1 in https://www.iacr.org/archive/pkc2003/25670211/25670211.pdf
 * 
 * @param {!e2e.ByteArray} sBytes A byte array of length 32
 * @return {!e2e.ecc.point.Ed25519}
 */
e2e.vrf.extra25519.fromBytesBaseGroup = function(sBytes) {

	var P = e2e.vrf.ed25519.curve.pointFromByteArray(sBytes);

	goog.asserts.assert(!P.isInfinity(),
	// goog.asserts.assert(!P.isIdentity(),
        'P != infinity');

	goog.asserts.assert(P.isOnCurve(),
        'P must satisfy the defining equation of the elliptic curve E');

	// TODO: confirm https://github.com/google/end-to-end/issues/340
	
	// nP = infinity, where n is the order 
	// goog.asserts.assert(P.multiply(e2e.vrf.ed25519.n).isInfinity(), 
	// goog.asserts.assert(P.multiply(e2e.vrf.ed25519.n).isIdentity(),
		// 'nP = infinity, where n is the order');

	return P;
}

/**
 * Returns a*A + b*B, where B is the Ed25519 base point
 *
 * @param {!e2e.BigNum} a the representative coordinate
 * @param {!e2e.ecc.Element} A the representative coordinate
 * @param {!e2e.BigNum} b the representative coordinate
 * @return {!e2e.ecc.Element}
 */
e2e.vrf.extra25519.geDoubleScalarMultVartime = function(a, A, b) {
	return A.multiply(a).add(e2e.vrf.ed25519.curve.B.multiply(b));
}


// converts a uniform representative value for a
// curve25519 public key, as produced by ScalarBaseMult, to a curve25519 public
// key.
// See Elligator paper section 5.2.

/**
 * Converts a uniform representative value to an element in Curve25519, 
 *  using the elligator map
 * Returns an element that is either -A/(1+ur^2) or A - A/(1+ur^2), 
 *  where u = 2, A = 486662 (defined in curve25519)
 *
 * Refer to Section 5.2 in http://elligator.cr.yp.to/elligator-20130828.pdf
 * @param {!e2e.ecc.Element} r the representative coordinate
 * @return {!e2e.ecc.Element}
 */
function representativeToMontgomeryX(r) {
	var A = e2e.vrf.curve25519.curve.A;

	// v = -A/(1+ur^2), where u = 2 (any non-square field element)
	r = r.square();
	var v = r.add(r).add(e2e.vrf.ed25519.curve.ONE).inverse().multiply(A).negate();

	// assertEquals('d4ad43e1aaf9b0ce31093a2cbe62af7e53bcb072c804e23b0d395147be6eed44',
	// 	goog.crypt.byteArrayToHex(v.x.toByteArray().reverse()));

	// e = Chi(v^3 + Av^2 + Bv), where B = 1
	// Chi(z) = z ^ (q - 1) / 2
	var v2 = v.square();
	var v3 = v2.multiply(v);
	var e = v3.add(v2.multiply(A)).add(v)
			.power(e2e.vrf.ed25519.curve.q.subtract(e2e.BigNum.ONE).shiftRight(1));

	// leading zeros are dropped
	// assertEquals('01',
	// 	goog.crypt.byteArrayToHex(e.x.toByteArray().reverse()));

	// e is either 1 or -1
	// x = ev - (1-e)A/2
	var x = e.isEqual(e2e.vrf.ed25519.curve.ONE) ? v : A.substract(v);

	// assertEquals('d4ad43e1aaf9b0ce31093a2cbe62af7e53bcb072c804e23b0d395147be6eed44',
	// 	goog.crypt.byteArrayToHex(x.x.toByteArray().reverse()));

	return x;
}

/**
 * Converts a Curve25519 element to an element in Ed25519 
 *
 * Refer to p.8 in http://ed25519.cr.yp.to/ed25519-20110926.pdf
 * @param {!e2e.ecc.Element} x the Curve25519 coordinate
 * @return {!e2e.ecc.Element}
 */
function montgomeryXToEdwardsY(x) {
	// var t, tt edwards25519.FieldElement
	// edwards25519.FeOne(&t)
	// edwards25519.FeAdd(&tt, x, &t)   // u+1
	// edwards25519.FeInvert(&tt, &tt)  // 1/(u+1)
	// edwards25519.FeSub(&t, x, &t)    // u-1
	// edwards25519.FeMul(out, &tt, &t) // (u-1)/(u+1)

	var y = x.add(e2e.vrf.ed25519.curve.ONE).inverse()
			.multiply(x.subtract(e2e.vrf.ed25519.curve.ONE));

	// assertEquals('2d53cc5079f9f7e495d408c88f43c839c900fea065b38c7901a76289398e283e',
	// 	goog.crypt.byteArrayToHex(y.x.toByteArray().reverse()));

	return y;
}


/**
 * Converts an 32-byte hashed output to an Ed25519 point using Elligator
 *
 * Refer to Section 5.2 in http://elligator.cr.yp.to/elligator-20130828.pdf
 * @param {!e2e.ByteArray} p A byte array of length 32
 * @return {!e2e.ecc.point.Ed25519}
 */
e2e.vrf.extra25519.hashToEdwards = function(h) {
	// hh := *h
	// bit := hh[31] >> 7
	// hh[31] &= 127
	var parity = h[31] >>> 7;
	h[31] &= 127;
	
	// edwards25519.FeFromBytes(&out.Y, &hh)
	// Here it is unsafe to use ed25519.curve.elementFromByteArray(),
	//  as it enforces byteArray to be within the modulus q
	var q = e2e.vrf.ed25519.curve.q;
  	var outY = new e2e.ecc.Element(q, 
  				new e2e.BigNum(h.reverse()).mod(q));
	
	// representativeToMongomeryX(&out.X, &out.Y)
	var outX = representativeToMontgomeryX(outY);

	// montgomeryXToEdwardsY(&out.Y, &out.X)
	outY = montgomeryXToEdwardsY(outX);

	// if ok := out.FromParityAndY(bit, &out.Y); !ok {
	// 	panic("HashToEdwards: point not on curve")
	// }
	var out = e2e.vrf.ed25519.curve.pointFromYCoordinate_(outY, parity);
	goog.asserts.assert(out.isOnCurve(), 
		'HashToEdwards: point not on curve');

	return out;
}

