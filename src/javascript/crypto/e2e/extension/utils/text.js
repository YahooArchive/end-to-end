/**
 * @license
 * Copyright 2014 Google Inc. All rights reserved.
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
 * @fileoverview Utility methods for working with free-text and PGP messages.
 */

goog.provide('e2e.ext.utils.text');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.openpgp.asciiArmor');
goog.require('goog.Uri');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.format.EmailAddress');
goog.require('goog.string');
goog.require('goog.string.format');


goog.scope(function() {
var constants = e2e.ext.constants;
var utils = e2e.ext.utils.text;


/**
 * Formats a body of text such that all lines do not exceed a given length.
 * @param {string} str The body of text to wrap around.
 * @param {number} maxlen The maximum length of a line.
 * @return {string} The formatted text.
 */
utils.prettyTextWrap = function(str, maxlen) {
  var regexp = new RegExp(goog.string.format('(.{%d})', maxlen), 'g');
  str = str.trim().replace(regexp, '$1\n');

  var carry = '';
  var lines = goog.array.map(str.split('\n'), function(line) {
    var newline = goog.string.format('%s%s', carry, line).trim();
    carry = '';

    if (newline.length >= maxlen && !goog.string.endsWith(newline, ' ')) {
      var lastSpace = newline.lastIndexOf(' ');
      if (lastSpace > -1 &&
          goog.string.isAlphaNumeric(newline.substring(newline.length - 1))) {
        carry = newline.substring(lastSpace + 1);
        return newline.substring(0, lastSpace);
      }
    }

    return newline;
  });

  if (carry) {
    goog.array.extend(lines, utils.prettyTextWrap(carry, maxlen).split('\n'));
  }

  return lines.join('\n');
};


/**
 * Determines the requested PGP action based on the content that the user has
 * selected.
 * @param {string} content The content that the user has selected.
 * @return {constants.Actions} The requested PGP action.
 */
utils.getPgpAction = function(content) {
  if (/^-----BEGIN PGP (?:SIGNED )?MESSAGE-----/.test(content)) {
    return constants.Actions.DECRYPT_VERIFY;
  }

  if (/^-----BEGIN PGP PUBLIC KEY BLOCK-----/.test(content)) {
    return constants.Actions.IMPORT_KEY;
  }

  if (/^-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(content)) {
    return constants.Actions.IMPORT_KEY;
  }

  return constants.Actions.ENCRYPT_SIGN;
};


/**
 * Invoke callback to handle clearsign and decryptVerify ASCII armors, amid
 * preserving surronding plaintext.
 * @param {!Element} elem The elem containing the message
 * @param {!function(!e2e.openpgp.ArmoredMessage)} armorHandler Callback to
 *     consume an ASCII armor.
 * @param {string=} opt_message Message body, defaulted to use elem.innerText
 * @param {number=} opt_limit Stop parsing once opt_limit armors have been
 *     parsed. Defaulted to 20.
 */
utils.isolateAsciiArmors = function(
    elem, armorHandler, opt_message, opt_limit) {
  var div, plaintext, lastEndOffset = 0;
  var message = opt_message || elem.innerText;
  var armors = e2e.openpgp.asciiArmor.parseAll(message, opt_limit || 20);

  // do nothing if we cannot parse any ASCII armors
  if (!armors || armors.length === 0 || armors[0].type === 'BINARY') {
    return;
  }

  goog.array.forEach(armors, function(armor) {
    var isValidDecryptVerifyArmor = false, textStartOffset = 0;

    if (armor.type === 'SIGNATURE') {
      // adjust startOffset to capture the whole message body
      textStartOffset = lastEndOffset + message.slice(lastEndOffset).
          indexOf('-----BEGIN PGP SIGNED MESSAGE-----');

      isValidDecryptVerifyArmor = true;
    } else if (armor.type === 'MESSAGE') {
      textStartOffset = armor.startOffset;
      isValidDecryptVerifyArmor = true;
    }

    // capture the text upto the next valid armor (or include it if invalid)
    plaintext = message.slice(lastEndOffset,
        isValidDecryptVerifyArmor ? textStartOffset : armor.endOffset);

    // insert the text before the next armor
    if (plaintext && goog.string.trim(plaintext)) {
      div = document.createElement('div');
      div.className = elem.className +
          (isValidDecryptVerifyArmor ? ' plaintext-above' : '') +
          ' plaintext-below';
      div.textContent = plaintext;

      goog.dom.insertSiblingBefore(div, elem);
    }

    // invoke callback to decrypt the next armor
    if (isValidDecryptVerifyArmor) {
      // add the original text to the armor object
      armor.text = message.slice(textStartOffset, armor.endOffset);
      armorHandler(armor);
    }

    lastEndOffset = armor.endOffset;
  });

  // insert the remaining text
  plaintext = message.slice(lastEndOffset);
  if (plaintext && goog.string.trim(plaintext)) {
    div = document.createElement('div');
    div.className = elem.className + ' plaintext-above';
    div.textContent = plaintext;
    goog.dom.insertSiblingBefore(div, elem);
  }
};


/**
 * Extract a valid e-mail address from 'user id &lt;email&gt;' string. If no
 * valid e-mail address can be extracted, returns null. Uses
 * {@link goog.format.EmailAddress}, but also enforces stricter rules.
 * @param {string} recipient "username &lt;email&gt;" string.
 * @return {?string} Valid email address or null
 */
utils.extractValidEmail = function(recipient) {
  var uid = utils.parseUid(recipient);
  return uid && uid.email;
};


/**
 * Return a normalized User ID if an valid e-mail address from 'user id &lt;
 * email&gt;' string is found. If no valid e-mail address can be extracted,
 * returns null. Uses * {@link goog.format.EmailAddress}, but also enforces
 * stricter rules on email address.
 * @param {string} uidOrEmail User Id or Email
 * @return {?string} the normalized uid or null
 */
utils.normalizeUid = function(uidOrEmail) {
  var uid = utils.parseUid(uidOrEmail);
  return uid && ((uid.name && uid.name + ' ') + '<' + uid.email + '>');
};


/**
 * Parse 'user id &lt;email&gt;' string and return the User ID object. If no
 * valid email address can be extracted, returns null. Uses stricter rules on
 * email address and {@link goog.format.EmailAddress}.
 * @param {string} uidOrEmail User Id or Email
 * @return {?{name: !string, email: !string}}
 */
utils.parseUid = function(uidOrEmail) {
  var emailAddress = goog.format.EmailAddress.parse(uidOrEmail);
  if (!emailAddress.isValid()) {
    return null;
  }
  var email = emailAddress.getAddress();
  if (!constants.EMAIL_ADDRESS_REGEXP.exec(emailAddress.getAddress())) {
    return null;
  }
  return {
    name: emailAddress.getName(),
    email: email
  };
};


/**
 * Extracts a valid yahoo-inc email address.
 * @param {string} recipient "username <email> string"
 * @return {?string} Valid email or null
 */
utils.extractValidYahooEmail = function(recipient) {
  var email = utils.extractValidEmail(recipient);
  var domain;
  if (email) {
    domain = email.split('@')[1].toLowerCase();
    // TODO: This needs other yahoo domains like yahoo.jp
    if (domain === 'yahoo-inc.com' || domain === 'yahoo.com') {
      return email;
    }
  }
  return null;
};


/**
 * Map an array of emails in string to array of objects, of which each has a
 * name and email address.
 * @param {Array.<string>} uids array of "username &lt;email&gt;" string.
 * @return {Array.<{name:string, email:string}>}
 */
utils.uidsToObjects = function(uids) {
  return goog.array.map(uids, function(uid) {
    var email = utils.extractValidEmail(goog.string.collapseWhitespace(uid));
    return email && email !== uid ?
        {
          name: goog.string.trimRight(uid.replace('<' + email + '>', '')),
          email: email
        } :
        {name: uid, email: uid};
  });
};


/**
 * Convert an user object to uid, of which the format is "name &lt;email&gt;"
 * @param {?{name:(string|undefined), email:!string}} userObj
 * @return {!string}
 */
utils.userObjectToUid = function(userObj) {
  return userObj ?
      (userObj.name || userObj.email) + ' <' + userObj.email + '>' :
      '';
};


/**
 * Extracts valid email addresses out of a string with comma-separated full
 *  email labels (e.g. "John Smith" <john@example.com>, Second
 *  <second@example.org>).
 * @param {string} emailLabels The full email labels
 * @return {!Array.<string>} The extracted valid email addresses.
 */
utils.getValidEmailAddressesFromString = function(emailLabels) {
  var emails = goog.format.EmailAddress.parseList(emailLabels);
  return goog.array.filter(
      goog.array.map(
          goog.array.map(emails, function(email) {return email.toString()}),
          utils.extractValidEmail),
      goog.isDefAndNotNull);
};


/**
 * Extracts valid email addresses out of an array with full email labels
 * (e.g. "John Smith" <john@example.com>, Second <second@example.org>).
 * @param {!Array.<string>} recipients List of recipients
 * @param {boolean=} opt_email_only If true, return email addresses instead of
 *   full recipient records.
 * @return {!Array.<string>} List of emails/recipients with valid e-mails
 */
utils.getValidEmailAddressesFromArray = function(recipients, opt_email_only) {
  var list = [];
  goog.array.forEach(recipients, function(recipient) {
    var emailAddress = goog.format.EmailAddress.parse(recipient);
    var validEmail = utils.extractValidEmail(emailAddress.getAddress());
    if (validEmail) {
      if (opt_email_only) {
        list.push(validEmail);
      } else {
        // Add full recipient record
        list.push(emailAddress.toString());
      }
    }
  });
  return list;
};


/**
 * Checks whether a URI is an HTTPS ymail origin.
 * @param {!string} uri
 * @return {boolean}
 */
utils.isYmailOrigin = function(uri) {
  var googUri = new goog.Uri(uri);
  return (googUri.getScheme() === 'https' &&
      goog.string.endsWith(googUri.getDomain(), '.mail.yahoo.com'));
};


/**
 * Checks whether a URI is an HTTPS Gmail origin.
 * @param {!string} uri
 * @return {boolean}
 */
utils.isGmailOrigin = function(uri) {
  var googUri = new goog.Uri(uri);
  return (googUri.getScheme() === 'https' &&
          googUri.getDomain() === 'mail.google.com');
};


/**
 * Normalizes whitespace formatting in user input text.
 * @param {string} text
 * @return {string}
 */
utils.normalizeWhitespace = function(text) {
  var lines = text.split('\n');
  return goog.array.map(lines, function(line) {
    return line.trim();
  }).join('\n');
};
});  // goog.scope
