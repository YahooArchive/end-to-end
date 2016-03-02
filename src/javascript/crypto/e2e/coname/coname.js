/**
 * @license
 * Copyright 2016 Yahoo Inc. All rights reserved.
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
 * @fileoverview Coname definitions and utilities.
 */

goog.provide('e2e.coname.KeyData');
goog.provide('e2e.coname.QuorumRequirement');
goog.provide('e2e.coname.RealmConfig');
goog.provide('e2e.coname.VerificationPolicy');
goog.provide('e2e.coname.getRealmByDomain');
goog.provide('e2e.coname.getRealmByEmail');
goog.provide('e2e.coname.getSupportedEmailByUid');


goog.require('e2e.ecc.Ed25519');
goog.require('e2e.ecc.PrimeCurve');
goog.require('e2e.ext.config');
goog.require('e2e.ext.utils.text');
goog.require('goog.array');


/**
 * @private
 * @type {Object<string, e2e.coname.RealmConfig>}
 * This cache serves as a map of domain to realm config
 */
e2e.coname.realmConfig_ = {};


/**
 * The structure of Quorum Requirement
 * @typedef {{
 *    threshold: !Number,
 *    candidates: ?Array.<string>,
 *    subexpressions: ?e2e.coname.QuorumRequirement
 * }}
 */
e2e.coname.QuorumRequirement;


/**
 * The structure of Verification Policy
 * @typedef {{
 *    public_keys: Object<string, Object<string, e2e.ByteArray>>,
 *    quorum: e2e.coname.QuorumRequirement
 * }}
 */
e2e.coname.VerificationPolicy;


/**
 * The structure of Realm Config
 * @typedef {{
 *    realm_name: !string,
 *    domains: !Array.<string>,
 *    authURLs: !Array.<string>,
 *    addr: !string,
 *    URL: !string,
 *    VRFPublic: !e2e.ByteArray,
 *    verification_policy: e2e.coname.VerificationPolicy,
 *    epoch_time_to_live: number,
 *    tree_nonce: (undefined|e2e.ByteArray),
 *    passphrase: ?string,
 *    newPassphrase: ?string
 * }}
 */
e2e.coname.RealmConfig;


/**
 * The structure of key lookup result
 * @typedef {{
 *    keyData: ?e2e.ByteArray,
 *    proof: Object
 * }}
 */
e2e.coname.KeyData;


/**
 * flattenRealmQuorums_ puts all (nested) quorums into a flattened array
 * @private
 * @param {e2e.coname.QuorumRequirement} quorums The quorum requirement
 *        extracted from realm config
 * @return {Array.<string>} an array of all quorum IDs
 */
e2e.coname.flattenRealmQuorums_ = function(quorums) {
  var out = [];

  if (quorums) {
    if (quorums.candidates) {
      out = out.concat(quorums.candidates);
    }

    if (quorums.subexpressions) {
      goog.array.forEach(quorums.subexpressions, function(e) {
        out = out.concat(e2e.coname.flattenRealmQuorums_(e));
      });
    }
  }

  return out;
};


/**
 * Initialize and return the realm constants for the provided domain
 * @param {string} domain The domain name
 * @return {?e2e.coname.RealmConfig} The corresponding RealmConfig
 */
e2e.coname.getRealmByDomain = function(domain) {
  domain = domain.toLowerCase();
  var ret = e2e.coname.realmConfig_[domain] || null;

  // if the realm is found in cache, immediately return it
  if (ret) {
    return ret;
  }

  // TODO: duplicate realm for a domain should be checked during config import
  goog.array.some(e2e.ext.config.CONAME.realms, function(realm) {
    var id, keys;
    if (goog.array.indexOf(realm.domains, domain) !== -1) {

      // initialize the realm config for performance

      // prepare the Ed25519 instance - facilitate ed25519 signature check
      keys = realm.verification_policy.public_keys;
      for (id in keys) {
        if (keys[id].ed25519) {
          keys[id].ed25519Verifier = new e2e.ecc.Ed25519(
              e2e.ecc.PrimeCurve.ED_25519, {
                pubKey: keys[id].ed25519,
                privKey: []
              });
        }
      }

      // aggregate (nested) quorums and flatten them in an array
      realm.verification_policy.quorum_list = e2e.coname.flattenRealmQuorums_(
          realm.verification_policy.quorum);

      e2e.coname.realmConfig_[domain] = ret = realm;

      return true;
    }
  });

  return ret;
};


/**
 * Get the realm constants based on the domain of email address
 * @param {string} email The email address
 * @return {?e2e.coname.RealmConfig} The RealmConfig
 */
e2e.coname.getRealmByEmail = function(email) {
  var i = email.indexOf('@');
  return i === -1 ? null : e2e.coname.getRealmByDomain(email.slice(i + 1));
};


/**
 * Get the email address if it is CONAME-capable.
 * @param {string} uid The OpenPGP User Id that may contain an email address
 * @return {?string} The email address of which a realm profile can be located
 */
e2e.coname.getSupportedEmailByUid = function(uid) {
  var email = e2e.ext.utils.text.extractValidEmail(uid);
  return email && e2e.coname.getRealmByEmail(email) ?
         email.toLowerCase() :
         null;
};

