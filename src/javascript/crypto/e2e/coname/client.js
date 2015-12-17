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
 * @fileoverview coname client.
 */

goog.provide('e2e.coname.Client');
goog.provide('e2e.coname.getRealmByEmail');

goog.require('e2e.coname.verifyLookup');
goog.require('e2e.ecc.Ed25519');
goog.require('e2e.ecc.PrimeCurve');
goog.require('e2e.error.InvalidArgumentsError');
goog.require('e2e.ext.config');
goog.require('goog.array');
goog.require('goog.crypt.base64');
goog.require('goog.net.jsloader');


/**
 * @private
 * This cache serves as a map of domain to realm config
 */
e2e.coname.realmConfig_ = {};


/**
 * flattenRealmQuorums_ puts all (nested) quorums into a flattened array
 * @private
 * @param {object} quorums The quorum requirement extracted from realm config
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
 * @private
 * Initialize and return the realm constants for the provided domain
 * @param {string} domain The domain name
 * @return {?object} ret The corresponding RealmConfig, null if not found
 */
e2e.coname.getRealmByDomain_ = function(domain) {
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
              e2e.ecc.PrimeCurve.ED_25519,
              {'pubKey': keys[id].ed25519});
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
 * @param {string} user The username
 * @return {object} ret The RealmConfig
 */
e2e.coname.getRealmByEmail = function(user) {
  var i = user.indexOf('@');
  if (i === -1) {
    throw new e2e.error.InvalidArgumentsError(
        'GetRealm: user must be of the form .*@.* (got ' + user + ')');
  }
  return e2e.coname.getRealmByDomain_(user.slice(i + 1));
};



/**
 * Constructor for the coname client.
 * @constructor
 */
e2e.coname.Client = function() {
  /**
   * @type {?{LookupRequest: Function}}
   */
  this.proto = null;

  /**
   * @private {boolean}
   */
  this.initialized_ = false;
};


/**
 * Initializes the external protobuf dependency.
 * @param {function()} callback The function to call when protobuf is loaded.
 * @param {function()} errback The error callback.
 */
e2e.coname.Client.prototype.initialize = function(callback, errback) {
  var pbURL = chrome.runtime.getURL('protobuf-light.alldeps.js');
  var clientProtoURL = chrome.runtime.getURL('coname-client.proto.json');

  this.initialized_ = true;

  if (window.dcodeIO && window.dcodeIO.ByteBuffer &&
      window.dcodeIO.Long && window.dcodeIO.ProtoBuf) {
    callback.call(this);
    return;
  }

  // XXX: jsloader has spurious timeout errors, so set it to 0 for no timeout.
  goog.net.jsloader.load(pbURL, {timeout: 0}).addCallback(function() {
    var d = window.dcodeIO, self = this;
    if (d && d.Long && d.ByteBuffer && d.ProtoBuf) {
      // Success
      d.ProtoBuf.loadJsonFile(clientProtoURL, function(err, builder) {
        if (!err) {
          self.proto = builder.build('proto');
          callback.call(self);
        }
      });
    } else {
      return new Error('Missing protobuf!');
    }
  }, this).addErrback(errback, this);
};


/**
 * @private
 * Parse, decode, and transform a lookup response
 * @param {string} jsonString The lookup message to decode
 * @return {object} The lookup response
 */
e2e.coname.Client.prototype.decodeLookupMessage_ = function(jsonString) {
  var self = this;
  var lookupProof = JSON.parse(jsonString);
  var b64decode = goog.crypt.base64.decodeStringToByteArray;

  // a lot of convertions before they can be verified
  // TODO: except the use of encodeAB(), may be better to move them to server
  lookupProof.index = b64decode(lookupProof.index);
  lookupProof.index_proof = b64decode(lookupProof.index_proof);

  lookupProof.tree_proof.neighbors = goog.array.map(
      lookupProof.tree_proof.neighbors,
      function(n) {return b64decode(n)});
  lookupProof.tree_proof.existing_index = b64decode(
      lookupProof.tree_proof.existing_index);
  lookupProof.tree_proof.existing_entry_hash = b64decode(
      lookupProof.tree_proof.existing_entry_hash);

  goog.array.forEach(lookupProof.ratifications, function(r) {
    var id, encoding = b64decode(r.head), rHH;

    r.head = self.proto.TimestampedEpochHead.decode(encoding);
    rHH = r.head.head;
    rHH.encoding = new Uint8Array(rHH.encodeAB());
    rHH.previous_summary_hash = new Uint8Array(
        rHH.previous_summary_hash.toBuffer());
    rHH.root_hash = new Uint8Array(rHH.root_hash.toBuffer());
    // drop nanos; seconds can be well represented by Number (max 2^53-1)
    rHH.issue_time = rHH.issue_time.seconds.toNumber();
    r.head.encoding = encoding;

    for (id in r.signatures) {
      r.signatures[id] = b64decode(r.signatures[id]);
    }
  });

  var entry = b64decode(lookupProof.entry);
  lookupProof.entry = self.proto.Entry.decode(entry);
  lookupProof.entry.profile_commitment = new Uint8Array(
      lookupProof.entry.profile_commitment.toBuffer());
  lookupProof.entry.encoding = entry;


  var profile = b64decode(lookupProof.profile);
  lookupProof.profile = self.proto.Profile.decode(profile);
  lookupProof.profile.encoding = profile;

  return lookupProof;
};


/**
 * Lookup and validate public keys for an email address
 * @param {string} email The email address to look up a public key
 * @param {function(email, keys)} callback The function to call when the email
 *  is associated with proper keys
 * @param {function(email, error)} errback The function to call when the email
 *  lacks proper keys
 */
e2e.coname.Client.prototype.lookup = function(email, callback, errback) {
  // normalize the email address
  email = email.toLowerCase();

  var errback_ = function(e) { errback && errback(email, e); }.bind(this);
  var realm = e2e.coname.getRealmByEmail(email);

  if (realm === null) {
    throw new e2e.error.InvalidArgumentsError(
        'Lookup: no realm is found for ' + email);
  }

  this.initialize(function() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', realm.addr + '/lookup', true);
    xhr.timeout = 5000; // 5s
    // xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var lookupProof = this.decodeLookupMessage_(xhr.responseText);
            if (e2e.coname.verifyLookup(realm, userid, lookupProof)) {
              callback && callback(email, lookupProof.keys.map);
              return;
            }
          } catch (e) {
            errback_(e);
          }

        }
        errback_(new Error('Lookup: no keys found'));
      }
    }.bind(this);

    if (errback) {
      xhr.ontimeout = errback_;
      xhr.onerror = errback_;
    }

    xhr.send(JSON.stringify({
      epoch: realm.epoch_time_to_live.seconds,
      user_id: email,
      quorum_requirement: realm.verification_policy.quorum
    }));
  }, errback_);

};

