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
 * @fileoverview Provides the full version of the keyring management UI.
 */

goog.provide('e2e.ext.ui.panels.KeyringMgmtFull');

goog.require('e2e.ext.constants.CssClass');
goog.require('e2e.ext.constants.ElementId');
goog.require('e2e.ext.ui.panels.KeyringMgmtMini');
goog.require('e2e.ext.ui.templates.panels.keyringmgmt');
goog.require('e2e.openpgp.KeyRing'); //@yahoo
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.dom.classlist');
goog.require('goog.events.EventType');
goog.require('goog.string'); //@yahoo
goog.require('goog.structs.Map');
goog.require('goog.ui.Component');
goog.require('soy');

goog.scope(function() {
var constants = e2e.ext.constants;
var panels = e2e.ext.ui.panels;
var templates = e2e.ext.ui.templates.panels.keyringmgmt;



/**
 * Constructor for the full version of the keyring management UI.
 * @param {!Object} pgpKeys A collection of raw PGP keys.
 * @param {!function()} exportKeyringCallback The callback to invoke when the
 *     keyring is to be exported.
 * @param {!function((string|!File))} importKeyringCallback The callback to
 *     invoke when an existing keyring is to be imported. //@yahoo allows string
 * @param {!function(string)} updateKeyringPassphraseCallback The callback to
 *     invoke when the passphrase to the keyring is to be updated.
 * @param {!function(string)} restoreKeyringCallback The callback to invoke when
 *     the keyring is restored.
 * @param {!function(string)} exportKeyCallback The callback to invoke when a
 *     single PGP key is to be exported.
 * @param {!function(string, string=, e2e.openpgp.KeyRing.Type=)}
 *     removeKeyCallback The callback to invoke when a single PGP key is to be
 *     removed. //@yahoo allowed deleting keys by fingerprint and type
 * @constructor
 * @extends {goog.ui.Component}
 */
panels.KeyringMgmtFull = function(pgpKeys, exportKeyringCallback,
    importKeyringCallback, updateKeyringPassphraseCallback,
    restoreKeyringCallback, exportKeyCallback, removeKeyCallback) {
  goog.base(this);

  /**
   * The PGP keys stored in the extension.
   * @type {!goog.structs.Map}
   * @private
   */
  this.pgpKeys_ = new goog.structs.Map(pgpKeys);

  /**
   * Provides keyring-wide management controls.
   * @type {!panels.KeyringMgmtMini}
   * @private
   */
  this.keyringMgmtControls_ = new panels.KeyringMgmtMini(exportKeyringCallback,
      importKeyringCallback, updateKeyringPassphraseCallback,
      restoreKeyringCallback);

  /**
   * The callback to invoke when a single PGP key is to be exported.
   * @type {!function(string)}
   * @private
   */
  this.exportKeyCallback_ = exportKeyCallback;

  /**
   * The callback to invoke when a single PGP key is to be removed.
   * //@yahoo allowed deleting keys by fingerprint and type
   * @type {!function(string, string=, e2e.openpgp.KeyRing.Type=)}
   * @private
   */
  this.removeKeyCallback_ = removeKeyCallback;
};
goog.inherits(panels.KeyringMgmtFull, goog.ui.Component);


/** @override */
panels.KeyringMgmtFull.prototype.disposeInternal = function() {
  this.pgpKeys_.clear();

  goog.base(this, 'disposeInternal');
};


/** @override */
panels.KeyringMgmtFull.prototype.createDom = function() {
  goog.base(this, 'createDom');
  this.decorateInternal(this.getElement());
};


/** @override */
panels.KeyringMgmtFull.prototype.decorateInternal = function(elem) {
  goog.base(this, 'decorateInternal', elem);
  elem.id = constants.ElementId.KEYRING_DIV;

  var storedKeys = goog.array.map(this.pgpKeys_.getKeys(), function(userId) {
    var pgpKeys = this.pgpKeys_.get(userId);
    return {
      userId: userId,
      hasPrivKey: this.hasPrivKey_(pgpKeys), //@yahoo
      keys: this.getKeysDescription_(pgpKeys)
      // keys: this.getKeysDescription_(this.pgpKeys_.get(userId))
    };
  }, this);
  soy.renderElement(elem, templates.listKeys, {
    storedKeys: storedKeys,
    sectionTitle: chrome.i18n.getMessage('keyMgmtTitle'),
    welcomeHeader: chrome.i18n.getMessage('welcomeHeader'), //@yahoo
    exportLabel: chrome.i18n.getMessage('keyMgmtExportLabel'),
    removeLabel: chrome.i18n.getMessage('keyMgmtRemoveLabel'),
    noneLabel: chrome.i18n.getMessage('keyMgmtNoneLabel'),
    keyFingerprintLabel: chrome.i18n.getMessage('keyFingerprintLabel'),
    keyRingDescriptionLabel: chrome.i18n.getMessage(
        'keyRingDescriptionLabel') //@yahoo
  });

  var keyringTable = this.getElement().querySelector('table');
  this.addChild(this.keyringMgmtControls_, false);
  this.keyringMgmtControls_.renderBefore(keyringTable);
};


/** @override */
panels.KeyringMgmtFull.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  var keyringTable = this.getElement().querySelector('table');
  this.getHandler()
      .listen(
          keyringTable,
          goog.events.EventType.CLICK,
          this.handleClick_,
          true);
};


/**
 * Renders a new PGP key into the UI.
 * @param {string} userId The ID of the key.
 * @param {Array} pgpKeys The keys and subkeys to render into the UI.
 */
panels.KeyringMgmtFull.prototype.addNewKey = function(userId, pgpKeys) {
  // @yahoo use table tbody instead of table, so <tr> can be properly appended
  var keyringTable = this.getElement().querySelector('table tbody');

  // escaped according to http://www.w3.org/TR/CSS21/syndata.html#characters
  var userIdSel = 'tr[data-user-id="' +
      userId.replace(/[^A-Za-z0-9_\u00A0-\uFFFF-]/g, function(c) {
        return '\\' + c;
      }) + '"]';

  goog.dom.removeNode(keyringTable.querySelector(userIdSel));

  if (keyringTable.textContent == chrome.i18n.getMessage('keyMgmtNoneLabel')) {
    keyringTable.removeChild(keyringTable.firstElementChild);
  }

  var tr = document.createElement(goog.dom.TagName.TR);
  tr.dataset.userId = userId;
  // @yahoo annotate if the userId has private keys
  if (this.hasPrivKey_(pgpKeys)) {
    goog.dom.classlist.add(tr, constants.CssClass.HAS_PRIV_KEY);
  }
  soy.renderElement(tr, templates.keyEntry, {
    keyMeta: {
      'userId': userId,
      'keys': this.getKeysDescription_(pgpKeys)
    },
    exportLabel: chrome.i18n.getMessage('keyMgmtExportLabel'),
    removeLabel: chrome.i18n.getMessage('keyMgmtRemoveLabel'),
    // @yahoo added keyRingDescriptionLabel
    keyRingDescriptionLabel: chrome.i18n.getMessage('keyRingDescriptionLabel')
  });
  keyringTable.appendChild(tr);
  this.keyringMgmtControls_.refreshOptions();
};


/**
 * //@yahoo added specific keys to remove
 * Removes a PGP key from the UI.
 * @param {string} userId The ID of the PGP key to remove.
 * @param {string=} opt_fingerprintHex The specific key fingerprint to remove
 * @param {e2e.openpgp.KeyRing.Type=} opt_keyType The specific key type to
 *     remove.
 */
panels.KeyringMgmtFull.prototype.removeKey = function(
    userId, opt_fingerprintHex, opt_keyType) {
  var tableRows = this.getElement().querySelectorAll('tr');
  tableRows = goog.array.filter(tableRows, function(row) {
    return row.textContent.indexOf(userId) > -1;
  });

  var uidElems = goog.array.filter(
      this.getElementsByClass(constants.CssClass.KEY_UID),
      function(elem) {
        return elem.textContent == userId;
      });

  goog.array.forEach(uidElems, function(elem) {
    var parentRow = this.getParentTableRow_(/** @type {!HTMLElement} */ (elem));

    // @yahoo delete only the specified ones
    opt_fingerprintHex && goog.array.some(
        goog.dom.getElementsByClass(constants.CssClass.KEY_META, parentRow),
        function(keyRow) {
          var fpElem = goog.dom.getElementByClass(
              constants.CssClass.KEY_FINGERPRINT, keyRow);
          var typeElem = goog.dom.getNextElementSibling(fpElem);
          var pubString = chrome.i18n.getMessage('publicKeyDescription');
          var privString = chrome.i18n.getMessage('secretKeyDescription');

          if (fpElem && typeElem) {
            var keyType = goog.string.contains(
                                      typeElem.textContent, pubString) ?
                e2e.openpgp.KeyRing.Type.PUBLIC :
                goog.string.contains(typeElem.textContent, privString) ?
                    e2e.openpgp.KeyRing.Type.PRIVATE :
                    null;

            if (opt_fingerprintHex === fpElem.textContent &&
                opt_keyType === keyType) {
              // remove the whole row if it's the only remaining item
              if (goog.dom.getElementsByClass(
                  constants.CssClass.KEY_META, parentRow).length > 1) {
                parentRow = fpElem.parentElement;
              }
              return true;
            }
          }
          return false;
        });

    // parentRow.parentElement.removeChild(parentRow);
    goog.dom.removeNode(parentRow);
  }, this);

  if (this.getElement().querySelectorAll('tr').length == 0) {
    soy.renderElement(this.getElement().querySelector('table'),
        templates.noneEntry, {
          'noneLabel': chrome.i18n.getMessage('keyMgmtNoneLabel')
        });
  }
  this.keyringMgmtControls_.refreshOptions();
};


/**
 * Updates the button to set the keyring's passphrase according to whether the
 * keyring is encrypted or not.
 * @param {boolean} encrypted True if the keyring is encrypted.
 */
panels.KeyringMgmtFull.prototype.setKeyringEncrypted = function(encrypted) {
  this.keyringMgmtControls_.setKeyringEncrypted(encrypted);
};


/**
 * Resets the appearance of the management controls.
 */
panels.KeyringMgmtFull.prototype.resetControls = function() {
  this.keyringMgmtControls_.reset();
};


/**
 * //@yahoo
 * Returns whether there has a private key in the given collection of PGP keys.
 * @param {Array} keys Raw collection of PGP keys.
 * @return {boolean} Whether there has a private key
 * @private
 */
panels.KeyringMgmtFull.prototype.hasPrivKey_ = function(keys) {
  return goog.array.some(keys, function(key) {
    return key.key.secret;
  });
};


/**
 * Returns a human readable representation of the given collection of PGP keys.
 * @param {Array} keys Raw collection of PGP keys.
 * @return {Array} A collection of PGP key metadata.
 * @private
 */
panels.KeyringMgmtFull.prototype.getKeysDescription_ = function(keys) {
  // @yahoo sort it by fingerprint
  var ret = goog.array.map(keys, function(key) {
    var type = (key.key.secret ?
        chrome.i18n.getMessage('secretKeyDescription') :
        chrome.i18n.getMessage('publicKeyDescription'));
    return {
      type: type,
      algorithm: key.key.algorithm,
      fingerprint: key.key.fingerprintHex
    };
  });

  goog.array.sortObjectsByKey(ret, 'fingerprint');
  return ret;
};


/**
 * Returns the parent table row of the given element.
 * @param {HTMLElement} elem The element for which we need to find the parent
 *     table row.
 * @return {Element} The parent table row.
 * @private
 */
panels.KeyringMgmtFull.prototype.getParentTableRow_ = function(elem) {
  var parentTR = elem.parentElement;
  while (parentTR.tagName != goog.dom.TagName.TR) {
    parentTR = parentTR.parentElement;
  }

  return parentTR;
};


/**
 * //@yahoo
 * Handles events when the user clicks on export/remove icons in the UI.
 * @param {!goog.events.Event} clickEvt The event generated by the user's click.
 * @private
 */
panels.KeyringMgmtFull.prototype.handleClick_ = function(clickEvt) {
  var icon = /** @type {HTMLElement} */ (clickEvt.target);
  // if (!(icon instanceof HTMLImageElement)) {
  //   return;
  // }

  // var callback = goog.dom.classlist.contains(
  //       icon, constants.CssClass.REMOVE) ?
  //     this.removeKeyCallback_ : this.exportKeyCallback_;
  // var parentTR = this.getParentTableRow_(icon);
  // var keyUid = goog.dom.getElementByClass(
  //     constants.CssClass.KEY_UID, parentTR).textContent;
  // callback(keyUid);


  // @yahoo allowed removal of individual key by fingerprint
  var callback = goog.dom.classlist.contains(icon, constants.CssClass.REMOVE) ?
      this.removeKeyCallback_ :
      goog.dom.classlist.contains(icon, constants.CssClass.EXPORT) ?
          this.exportKeyCallback_ :
          null;

  if (callback) {
    var parentTR = this.getParentTableRow_(icon);
    var keyUid = goog.dom.getElementByClass(
        constants.CssClass.KEY_UID, parentTR).textContent;

    if (icon instanceof HTMLImageElement) {
      callback(keyUid);
    } else if (callback === this.removeKeyCallback_) {
      var fpElem = goog.dom.getElementByClass(
          constants.CssClass.KEY_FINGERPRINT, icon.parentElement);
      var typeElem = goog.dom.getNextElementSibling(fpElem);
      var pubString = chrome.i18n.getMessage('publicKeyDescription');
      var privString = chrome.i18n.getMessage('secretKeyDescription');
      if (fpElem && typeElem) {
        var keyType = goog.string.contains(typeElem.textContent, pubString) ?
            e2e.openpgp.KeyRing.Type.PUBLIC :
            goog.string.contains(typeElem.textContent, privString) ?
                e2e.openpgp.KeyRing.Type.PRIVATE :
                null;

        callback(keyUid, fpElem.textContent, keyType);
      }
    }
  }
};


});  // goog.scope
