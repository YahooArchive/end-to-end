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
goog.provide('e2e.coname.QuorumRequirement');
goog.provide('e2e.coname.RealmConfig');
goog.provide('e2e.coname.VerificationPolicy');
goog.provide('e2e.coname.getRealmByEmail');

goog.require('e2e');
goog.require('e2e.coname.sha3');
goog.require('e2e.coname.verifyLookup');
goog.require('e2e.ecc.Ed25519');
goog.require('e2e.ecc.PrimeCurve');
goog.require('e2e.error.InvalidArgumentsError');
goog.require('e2e.ext.config');
goog.require('e2e.random');
goog.require('goog.array');
goog.require('goog.crypt.base64');
goog.require('goog.net.jsloader');


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
 *    addr: !string,
 *    URL: !string,
 *    VRFPublic: !e2e.ByteArray,
 *    verification_policy: e2e.coname.VerificationPolicy,
 *    epoch_time_to_live: number,
 *    tree_nonce: (undefined|e2e.ByteArray)
 * }}
 */
e2e.coname.RealmConfig;


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
 * @private
 * Initialize and return the realm constants for the provided domain
 * @param {string} domain The domain name
 * @return {?e2e.coname.RealmConfig} ret The corresponding RealmConfig
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
 * @param {string} user The username
 * @return {?e2e.coname.RealmConfig} The RealmConfig
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
   * @type {?Object<string,*>}
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
 * @param {function(Error)} errback The error callback.
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
 * @param {object} proto The initialized protobuf object
 * @param {string} jsonString The lookup message to decode
 * @return {e2e.coname.LookupResponse} The lookup response
 */
e2e.coname.decodeLookupMessage_ = function(proto, jsonString) {
  var lookupProof = JSON.parse(jsonString);
  var b64decode = goog.crypt.base64.decodeStringToByteArray;
  var profile, entry;

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

    r.head = proto['TimestampedEpochHead'].decode(encoding);
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

  if (lookupProof.entry) {
    entry = b64decode(lookupProof.entry);
    lookupProof.entry = proto['Entry'].decode(entry);
    lookupProof.entry.profile_commitment = new Uint8Array(
        lookupProof.entry.profile_commitment.toBuffer());
    lookupProof.entry.encoding = entry;
  }

  if (lookupProof.profile) {
    profile = b64decode(lookupProof.profile);
    lookupProof.profile = proto['Profile'].decode(profile);
    lookupProof.profile.encoding = profile;
  }

  return /** @type {e2e.coname.LookupResponse} */ (lookupProof);
};


/**
 * @private
 * Encode the update request message
 * @param {object} proto The initialized protobuf object
 * @param {string} email The email address
 * @param {!e2e.ByteArray} key OpenPGP key to send
 * @param {object} realm The RealmConfig
 * @param {object} oldProof The lookup proof just obtained
 * @return {object} The update message
 */
e2e.coname.encodeUpdateRequest_ = function(proto, email, key, realm, oldProof) {

  var keys, hProfile, profile, entry;

  // if a current profile exists
  if (oldProof.profile) {
    // clone the old key set
    keys = proto.Profile.decode(oldProof.profile.encoding).keys;
    // update only the pgp key
    keys.set('pgp', goog.crypt.base64.encodeByteArray(key));
  } else {
    keys = {'pgp': new Uint8Array(key)};
  }

  profile = proto.Profile.encode({
    nonce: new Uint8Array(e2e.random.getRandomBytes(16)),
    keys: keys
  });

  hProfile = new Uint8Array(
      e2e.coname.sha3.shake256(64).update(profile.toBuffer()).digest());

  // if a current entry exists
  if (oldProof.entry) {
    entry = proto.Entry.decode(oldProof.entry.encoding); // clone
    entry.version = entry.version.add(1);
    entry.profile_commitment = hProfile;
  } else {
    entry = proto.Entry.encode({
      index: new Uint8Array(oldProof.index),
      version: 0, // version starts at 0 at registration
      // TODO: support other update_policy
      update_policy: {quorum: {}},
      profile_commitment: hProfile
    });
  }

  return {
    update: {
      new_entry: entry.toBase64(),
      signatures: {}
    },
    profile: profile.toBase64(),
    lookup_parameters: {
      user_id: email,
      quorum_requirement: realm.verification_policy.quorum
    },
    // TODO: disable DKIM for now
    // dkim_proof: null
  };

};


/**
 * @private
 * Send the data over AJAX
 * @param {string} method The HTTP method to use, such as "GET", "POST", "PUT",
 *                        "DELETE", etc. Ignored for non-HTTP(S) URLs
 * @param {string} url The URL to send the request to
 * @param {Number} timeout The number of milliseconds a request can take before
 *                         automatically being terminated. A value of 0 (which
 *                         is the default) means there is no timeout.
 * @param {object} data The data to be JSON stringified and sent as the HTTP
 *                      request body
 * @param {function(responseText)} callback The function to call if the server
 *                                          responds 200 OK
 * @param {function(email, error)} errback The function to call when there is
 *                                         any errors (incl. 401, 404 status)
 */
e2e.coname.getAJAX_ = function(method, url, timeout, data, callback, errback) {

  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  timeout && (xhr.timeout = timeout);
  // xhr.setRequestHeader('Content-Type', 'application/json');

  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      var errMessage, status = xhr.status;
      if (status === 200) {
        try {
          callback(xhr.responseText);
        } catch (e) {
          errback(e);
        }
      } else {
        errMessage = (status === 401) ? 'Unauthorized Access:' :
            (status >= 500) ? 'Server Error:' : 'Connection Error:';
        errback(new Error(errMessage + url));
      }
    }
  };

  if (errback) {
    xhr.ontimeout = errback;
    xhr.onerror = errback;
  }

  xhr.send(JSON.stringify(data));
};


/**
 * Lookup and validate public keys for an email address
 * @param {string} email The email address to look up a public key
 * @param {function(string, ?Uint8Array, e2e.coname.RealmConfig,
 *  e2e.coname.LookupResponse, function(string, Error))} callback The function
 *  to call if the email is associated with proper keys
 * @param {function(string, Error)} errback The function to call when the email
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
  
  // TODO: make this possible for polling/retries
  this.initialize(function() {
    var proto = this.proto;

    e2e.coname.getAJAX_(
        'POST',
        realm.addr + '/lookup',
        5000,   // 5 sec
        {
          user_id: email,
          quorum_requirement: realm.verification_policy.quorum
        },
        function(responseText) {
          var pf = e2e.coname.decodeLookupMessage_(proto, responseText),
              profile = pf.profile,
              key;

          if (!e2e.coname.verifyLookup(
              /** @type {e2e.coname.RealmConfig} */ (realm), email, pf)) {
            errback_(new Error('profile/keys cannot be validated'));
            return;
          }

          key = profile &&
                profile.keys &&
                profile.keys.has('pgp') ?
                  profile.keys.get('pgp').toBuffer() : null;

          callback(email, key, realm, pf, errback_);
        },
        errback_);

  }, errback_);

};


/**
 * Update or add public keys for an email address
 * @param {string} email The email address
 * @param {object} key The public key to associate with the email address
 * @param {function(email, pgpKey, realm, proof, errback)} callback The
 *  function to call if the email is updated and verified with proper keys
 * @param {function(email, error)} errback The function to call when the email
 *  lacks proper keys
 */
e2e.coname.Client.prototype.update = function(email, key, callback, errback) {

  // TODO: save persistently the key in case update fails in the mid way

  function lookupCallback(oldKeys, email, realm, oldProof, errback_) {
    var proto = this.proto,
        data = e2e.coname.encodeUpdateRequest_(proto, email, realm, oldProof);

    e2e.coname.getAJAX_(
        'POST',
        realm.addr + '/update',
        60000,  // 1min
        data,
        function(responseText) {
          var pf = e2e.coname.decodeLookupMessage_(proto, responseText),
              profile = pf.profile,
              key;

          if (data.profile !== profile.toBase64() ||
              !e2e.coname.verifyLookup(
                  /** @type {e2e.coname.RealmConfig} */ (realm), email, pf)) {
            // TODO: poll the server until the update can be verified
            errback_(new Error('profile/keys cannot be validated'));
            return;
          }

          key = profile.keys.get('pgp').toBuffer();

          callback(email, key, realm, pf, errback_);
        },
        errback_);
  };

  this.lookup(email, goog.bind(lookupCallback, this), errback);
};
