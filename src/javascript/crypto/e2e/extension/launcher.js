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
goog.require('e2e.ext.config');
goog.require('e2e.ext.yPreferences'); //@yahoo
goog.require('goog.array'); //@yahoo
goog.require('goog.async.Deferred');
goog.require('goog.async.DeferredList');
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

  ext.yExtensionLauncher.base(this, 'constructor', pgpContext,
      preferencesStorage);

  /**
   * The URL of the default WebMail Application
   * @type {!string}
   * @private
   */
  this.defaultUrl_ = e2e.ext.config.CONAME.realms[0].URL;

  this.injectContentScripts({file: 'helper_binary.js'});
};
goog.inherits(ext.yExtensionLauncher, ext.ExtensionLauncher);


/**
 * Configure web requests to boost up redirection speeds
 * @protected
 */
ext.yExtensionLauncher.prototype.configureWebRequests = function() {
  // TODO: redirect non-e2e.mail.yahoo.com to e2e.mail.yahoo.com
  chrome.webRequest.onBeforeRequest.addListener(goog.bind(function(details) {
    if (details.url && details.url.indexOf('encryptr') !== -1) {
      return /** @type {!BlockingResponse} */ ({
        redirectUrl: this.defaultUrl_
      });
    }
  }, this),
  /** @type {!RequestFilter} */ ({
    urls: ['https://*.mail.yahoo.com/*'],
    types: ['main_frame'] // mainframe access only
  }),
  ['blocking']);

};


/**
 * Inject content script to every Webmail tab.
 * @param {{file: (string|undefined), code: (string|undefined)}} details
 *     Details of the script to inject. Refer to 
 *     https://developer.chrome.com/extensions/tabs#method-executeScript
 *     for the definition of details.
 * @param {chrome.tabs.QueryInfo=} opt_queryInfo The queryInfo to filter
 *     out tabs that we are interested in.
 * @return {goog.async.Deferred.<Array<?{result: *, tab: Tab}>>} Those tabs
 *     that the extension can inject script, and its execution result.
 * @protected
 */
ext.yExtensionLauncher.prototype.injectContentScripts = function(
    details, opt_queryInfo) {
  var allResults = new goog.async.Deferred;
  chrome.tabs.query(opt_queryInfo || {}, function(tabs) {
    // Inject the content script to every ymail tab, if any
    var tabResults = goog.array.map(tabs, function(tab) {
      var result = new goog.async.Deferred;
      try {
        goog.isDef(tab.id) && chrome.tabs.executeScript(
            tab.id, details, function(ret) {
              result.callback(!chrome.runtime.lastError && goog.isDef(ret)
                  ? {result: ret, tab: tab} : null);
            });
      } catch (e) {
        result.callback(null);
      }
      return result;
    });

    // filter out those unrelated tabs
    goog.async.DeferredList.gatherResults(tabResults).
        addCallbacks(function(tabs) {
          allResults.callback(
              goog.array.filter(tabs, function(tab) { return tab !== null; }));
        }, allResults.errback, allResults);

  });

  return allResults;
};


/**
 * Focus on the first (top-most) webmail tab found, or open one.
 * @return {goog.async.Deferred.<Tab>} The focused tab
 */
ext.yExtensionLauncher.prototype.focusOnWebmail = function() {
  return this.injectContentScripts({code: 'helper && helper.getUser()'}).
      addCallback(function(tabResults) {
        if (tabResults.length === 0 || !tabResults[0].result[0]) {
          var result = new goog.async.Deferred;
          this.createWindow(
              this.defaultUrl_, true, goog.bind(result.callback, result));
          return result;
        } else {
          // select the tab on topmost window, or the first tab found
          var tab = (goog.array.find(tabResults, function(tabResult) {
            return tabResult.tab.lastFocusedWindow && tabResult.tab.active;
          }) || tabResults[0].tab);
          chrome.windows.update(tab.windowId, {focused: true});
          chrome.tabs.update(tab.id, {active: true});
          return tab;
        }
      }, this);
};


/**
 * Open the settings page if none is there. Otherwise, focus and reload the
 * existing one.
 */
ext.yExtensionLauncher.prototype.showSettingsPage = function() {
  var tabResult = this.settingsTabResult_;

  // no such window is found, possibly closed
  if (tabResult) {
    tabResult.addCallback(function(tab) {
      // focus and reload the existing tab
      chrome.windows.update(tab.windowId, {focused: true});
      chrome.tabs.reload(tab.id);
    });
    return;
  }

  tabResult = this.settingsTabResult_ = new goog.async.Deferred;

  // open a new window for settings
  chrome.windows.create({
    url: 'settings.html',
    width: 840,
    height: 500,
    focused: true,
    type: 'popup'
  }, goog.bind(function(win) {
    var tab = win.tabs[0];
    
    // clear the record of settings tab when it is closed
    var windowRemoved = goog.bind(function(winId) {
      if (winId === tab.windowId) {
        this.settingsTabResult_ = null;
        chrome.windows.onRemoved.removeListener(windowRemoved);
      }
    }, this);
    chrome.windows.onRemoved.addListener(windowRemoved);

    tabResult.callback(tab);
    
  }, this));
};


/**
 * Focus on a webmail tab if no private keys are configured. The content script
 * injected is responsible for opening the welcome screen.
 * @override
 */
ext.yExtensionLauncher.prototype.showWelcomeScreen = function() {
  // in case no private keys are setup locally
  this.getContext().getAllKeys(true).addCallback(function(keyMap) {
    return !goog.structs.some(keyMap, function(keys) {
      return goog.array.some(keys, function(k) { return k.key.secret; });
    });
  }).addCallback(function(hasNoPrivateKeys) {
    hasNoPrivateKeys && this.focusOnWebmail();
  }, this);
};


/**
 * Get the current user id according to the topmost webmail tab
 * @return {goog.async.Deferred.<{name: string, email: string}>}
 */
ext.yExtensionLauncher.prototype.getCurrentUserID = function() {
  return this.focusOnWebmail().addCallback(function(tab) {
    var result = new goog.async.Deferred;
    chrome.tabs.executeScript(
        tab.id, {code: 'helper && helper.getUser()'}, function(ret) {
          if (!chrome.runtime.lastError && ret && ret[0]) {
            result.callback(ret[0].result);
          } else {
            result.errback(new Error('Failed to retrieve user id'));
          }
        });
    return result;
  });
};


/**
 * Collect unique uids in all opened webmail tabs
 * @return {goog.async.Deferred.<Array.<string>>}
 */
ext.yExtensionLauncher.prototype.getUserIDs = function() {
  return this.injectContentScripts({code: 'helper && helper.getUser()'}).
      addCallback(function(results) {
        results = /** @type {Array.<{
          result: {email: string, name: string}, tab: Tab}>} */ (results);
        // deduplicate based on email address
        goog.array.removeDuplicates(results, undefined, function(tabResult) {
          return tabResult.result && tabResult.result[0] &&
              tabResult.result[0].email;
        });
        // convert it to User Id
        return goog.array.map(results, function(tabResult) {
          return e2e.ext.utils.text.userObjectToUid(tabResult.result[0]);
        });
      });
};



/**
 * Stops the launcher. Called to lock keyring in extension/ui/prompt/prompt.js
 */
ext.yExtensionLauncher.prototype.stop = function() {
  this.started_ = false;
  // Unset the passphrase on the keyring
  // TODO: add unsetKeyringPassphrase() into Context
  this.getContext().keyring_ = null;
  this.updatePassphraseWarning();
};

});  // goog.scope
