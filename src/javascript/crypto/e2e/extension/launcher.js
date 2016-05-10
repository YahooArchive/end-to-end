/**
 * @license
 * Copyright 2013 Google Inc. All rights reserved.
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
 * @fileoverview The launcher for the End-To-End extension. Establishes
 * communication with the content scripts. Instantiates the required UI bits
 * that allow the user to interact with the extension.
 */

goog.provide('e2e.ext.AppLauncher');
goog.provide('e2e.ext.ExtensionLauncher');
goog.provide('e2e.ext.Launcher');
goog.provide('e2e.ext.yExtensionLauncher'); //@yahoo

goog.require('e2e.ext.api.Api');
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.yPreferences'); //@yahoo
goog.require('goog.Uri'); //@yahoo
goog.require('goog.array'); //@yahoo
goog.require('goog.structs');

goog.scope(function() {
var ext = e2e.ext;
var constants = e2e.ext.constants;
var messages = e2e.ext.messages;



/**
 * Base class for the End-To-End launcher.
 * @param {!e2e.openpgp.Context} pgpContext The OpenPGP context to use.
 * @param {!goog.storage.mechanism.IterableMechanism} preferencesStorage
 *    Storage mechanism for user preferences.
 * @constructor
 */
ext.Launcher = function(pgpContext, preferencesStorage) {

  /**
   * Whether the launcher was started correctly.
   * @type {boolean}
   * @private
   */
  this.started_ = false;

  /**
   * The OpenPGP context used by the extension.
   * @type {!e2e.openpgp.Context}
   * @private
   */
  this.pgpContext_ = pgpContext;

  /**
   * //@yahoo used yPreferences
   * Object for accessing user preferences.
   * @type {!e2e.ext.yPreferences}
   * @private
   */
  this.preferences_ = new e2e.ext.yPreferences(preferencesStorage);


  /**
   * The context API that the rest of the extension can use to communicate with
   * the PGP context.
   * @type {!ext.api.Api}
   * @private
   */
  this.ctxApi_ = new ext.api.Api();
};


/**
 * Asks for the keyring passphrase and start the launcher.
 * @param {string=} opt_passphrase The passphrase of the keyring.
 * @return {!goog.async.Deferred} Async result. If the passphrase is wrong, an
 * errback of that result will be executed.
 * @export
 */
ext.Launcher.prototype.start = function(opt_passphrase) {
  return this.start_(opt_passphrase || '');
};


/**
 * Starts the launcher.
 * @param {string} passphrase The passphrase of the keyring.
 * @return {!goog.async.Deferred} Async result.
 * @private
 */
ext.Launcher.prototype.start_ = function(passphrase) {
  return this.pgpContext_.initializeKeyRing(passphrase).addCallbacks(
      function() {
        if (goog.global.chrome &&
        goog.global.chrome.runtime &&
        goog.global.chrome.runtime.getManifest) {
          var manifest = chrome.runtime.getManifest();
          return this.pgpContext_.setArmorHeader(
          'Version',
          manifest.name + ' v' + manifest.version);
        }
      }, function(e) {
        this.updatePassphraseWarning();
        throw e;
      }, this).addCallback(this.completeStart_, this);
};


/** @private */
ext.Launcher.prototype.completeStart_ = function() {
  this.ctxApi_.installApi();
  this.started_ = true;
  this.preferences_.initDefaults();

  this.showWelcomeScreen();
  this.updatePassphraseWarning();
};


/**
 * Returns the PGP context used within the extension.
 * @return {e2e.openpgp.Context} The PGP context.
 * @export
 */
ext.Launcher.prototype.getContext = function() {
  return this.pgpContext_;
};


/**
 * //@yahoo returns yPreferences
 * Returns the Preferences object used within the extension.
 * @return {e2e.ext.yPreferences} The Preferences object.
 * @export
 */
ext.Launcher.prototype.getPreferences = function() {
  return this.preferences_;
};


/**
 * Indicates if the keyring was loaded with the correct passphrase.
 * @return {boolean} True if the keyring was loaded with the correct passphrase.
 * @export
 */
ext.Launcher.prototype.hasPassphrase = function() {
  return this.started_;
};


/**
 * Display a warning to the user if there is no available passphrase to access
 * the keyring.
 * @protected
 */
ext.Launcher.prototype.updatePassphraseWarning = goog.abstractMethod;


/**
 * Creates a window displaying a document from an internal End-To-End URL.
 * @param {string} url URL of the document.
 * @param {boolean} isForeground Should the focus be moved to the new window.
 * @param {!function(...)} callback Function to call once the window has been
 *     created.
 * @protected
 */
ext.Launcher.prototype.createWindow = goog.abstractMethod;


/**
 * Shows the welcome screen to first-time users.
 * @protected
 */
ext.Launcher.prototype.showWelcomeScreen = function() {
  if (this.preferences_.isWelcomePageEnabled()) {
    this.createWindow('welcome.html', true, goog.nullFunction);
  }
};



/**
 * Constructor to use in End-To-End Chrome extension.
 * @param {!e2e.openpgp.Context} pgpContext The OpenPGP context to use.
 * @param {!goog.storage.mechanism.IterableMechanism} preferencesStorage Storage
 * mechanism for user preferences.
 * @constructor
 * @extends {ext.Launcher}
 */
ext.ExtensionLauncher = function(pgpContext, preferencesStorage) {
  ext.ExtensionLauncher.base(this, 'constructor', pgpContext,
      preferencesStorage);
};
goog.inherits(ext.ExtensionLauncher, ext.Launcher);


/** @override */
ext.ExtensionLauncher.prototype.updatePassphraseWarning = function() {
  if (this.hasPassphrase()) {
    chrome.browserAction.setBadgeText({text: ''});
    chrome.browserAction.setTitle({
      title: chrome.i18n.getMessage('extName')
    });
  } else {
    chrome.browserAction.setBadgeText({text: '!'});
    chrome.browserAction.setTitle({
      title: chrome.i18n.getMessage('passphraseEmptyWarning')
    });
  }
};


/** @override */
ext.ExtensionLauncher.prototype.createWindow = function(url, isForeground,
    callback) {
  chrome.tabs.create({
    url: url,
    active: isForeground
  }, callback);
};



/**
 * Constructor to use in End-To-End Chrome app.
 * @param {!e2e.openpgp.Context} pgpContext The OpenPGP context to use.
 * @param {!goog.storage.mechanism.IterableMechanism} preferencesStorage Storage
 * mechanism for user preferences.
 * @constructor
 * @extends {ext.Launcher}
 */
ext.AppLauncher = function(pgpContext, preferencesStorage) {
  ext.AppLauncher.base(this, 'constructor', pgpContext, preferencesStorage);
  chrome.app.runtime.onLaunched.addListener(function() {
    chrome.app.window.create(
        'webview.html',
        /** @type {!chrome.app.window.CreateWindowOptions} */ ({
          innerBounds: {
            width: 960,
            height: 580
          }
        }));
  });
};
goog.inherits(ext.AppLauncher, ext.Launcher);


/** @override */
ext.AppLauncher.prototype.updatePassphraseWarning = function() {
  // TODO(evn): Implement.
};


/** @override */
ext.AppLauncher.prototype.createWindow = function(url, isForeground, callback) {
  chrome.app.window.create(
      url,
      /** @type {!chrome.app.window.CreateWindowOptions} */ ({
        focused: isForeground,
        innerBounds: {
          width: 900,
          height: 700
        }
      }),
      callback);
};



/**
 * Constructor to use in End-To-End Chrome extension.
 * @param {!e2e.openpgp.Context} pgpContext The OpenPGP context to use.
 * @param {!goog.storage.mechanism.IterableMechanism} preferencesStorage Storage
 * mechanism for user preferences.
 * @constructor
 * @extends {ext.ExtensionLauncher}
 */
ext.yExtensionLauncher = function(pgpContext, preferencesStorage) {
  this.configureWebRequests();

  chrome.runtime.onInstalled.addListener(goog.bind(this.onInstall, this));

  ext.yExtensionLauncher.base(this, 'constructor', pgpContext,
      preferencesStorage);
};
goog.inherits(ext.yExtensionLauncher, ext.ExtensionLauncher);


/**
 * Configure web requests to boost up redirection speeds
 * @protected
 */
ext.yExtensionLauncher.prototype.configureWebRequests = function() {
  // TODO: redirect non-e2e.mail.yahoo.com to e2e.mail.yahoo.com
  chrome.webRequest.onBeforeRequest.addListener(function(details) {
    var url = new goog.Uri(details.url);
    if (goog.isDef(url.getParameterValue('encryptr'))) {
      return /** @type {!BlockingResponse} */ ({
        redirectUrl: url.removeParameter('encryptr').toString()
      });
    }
  },
  /** @type {!RequestFilter} */ ({
    urls: ['https://*.mail.yahoo.com/*'],
    types: ['main_frame'] // mainframe access only
  }),
  ['blocking']);

};


/**
 * Open a new tab to display the setup page
 * @protected
 */
ext.yExtensionLauncher.prototype.openSetupPage = function() {
  // @yahoo open welcome screen when there's no private key
  var ctx = this.getContext();
  ctx.getAllKeys(true).addCallback(function(keyMap) {
    return !goog.structs.some(keyMap, function(keys) {
      return goog.array.some(keys, function(k) { return k.key.secret; });
    });
  }).addCallback(function(hasNoPrivateKeys) {
    if (hasNoPrivateKeys) {
      this.createWindow('settings.html', true, goog.nullFunction);
    }
  }, this);
};


/**
 * Inject helper script to all ymail tabs after installation. If none is there,
 * open the setup page
 * @param {Object} detail It details the OnInstalledReason
 * @protected
 */
ext.yExtensionLauncher.prototype.onInstall = function(detail) {
  detail = /** @type {{reason: !string}} */ (detail);
  if (detail.reason !== 'install') {
    return;
  }

  chrome.tabs.query({}, goog.bind(function(tabs) {
    // Inject the content script to every ymail tab, if any
    var tabResults = goog.array.map(tabs, function(tab) {
      var result = new goog.async.Deferred;
      try {
        if (goog.isDef(tab.id)) {
          chrome.tabs.executeScript(
              tab.id,
              {file: chrome.runtime.getURL('helper_binary.js')},
              function(ret) {
                result.callback(!chrome.runtime.lastError && goog.isDef(ret));
              });
        }
      } catch(e) {
        result.callback(false);
      }
      return result;
    });

    // If no ymail tab is found, open the setup page
    goog.async.DeferredList.gatherResults(tabResults).
        addCallback(function(injected) {
          if (!goog.array.contains(injected, true)) {
            this.openSetupPage();
          }
        }, this);
  }, this));
};


/**
 * Stops the launcher. Called to lock keyring in extension/ui/prompt/prompt.js
 */
ext.yExtensionLauncher.prototype.stop = function() {
  this.started_ = false;
  // Unset the passphrase on the keyring
  // TODO: add unsetKeyringPassphrase() into Context
  this.getContext().keyring_ = null;
  // Remove the API
  this.ctxApi_.removeApi();
  this.updatePassphraseWarning();
};


/** @override */
ext.yExtensionLauncher.prototype.showWelcomeScreen = goog.nullFunction;

});  // goog.scope
