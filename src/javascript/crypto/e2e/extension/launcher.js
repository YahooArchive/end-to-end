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
goog.require('e2e.ext.config'); //@yahoo
goog.require('e2e.ext.constants.Actions');
goog.require('e2e.ext.utils.TabsHelperProxy'); //@yahoo
goog.require('e2e.ext.utils.text'); //@yahoo
goog.require('e2e.ext.yPreferences'); //@yahoo
goog.require('goog.Uri'); //@yahoo
goog.require('goog.array'); //@yahoo

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

  /**
   * Helper proxy object.
   * @type {!e2e.ext.utils.HelperProxy}
   * @private
   */
  this.helperProxy_ = new e2e.ext.utils.TabsHelperProxy(false);

  ext.yExtensionLauncher.base(this, 'constructor', pgpContext,
      preferencesStorage);
};
goog.inherits(ext.yExtensionLauncher, ext.ExtensionLauncher);


/** @override */
ext.yExtensionLauncher.prototype.start = function(opt_passphrase) {
  this.configureWebRequests();

  return goog.base(this, 'start', opt_passphrase).addCallback(function() {
    // add message listener
    chrome.runtime.onMessage.addListener(goog.bind(function(message, sender) {
      this.proxyMessage(message, sender);
    }, this));

  }, this);
};


/**
 * Configure web requests to boost up redirection speeds
 */
ext.yExtensionLauncher.prototype.configureWebRequests = function() {
  // mainframe access only
  // TODO: redirect non-e2e.mail.yahoo.com to e2e.mail.yahoo.com
  chrome.webRequest.onBeforeRequest.addListener(function(details) {
    var url = new goog.Uri(details.url);
    if (!goog.isDef(url.getParameterValue('encryptr'))) {
      return /** @type {!BlockingResponse} */ ({
        redirectUrl: url.setParameterValue('encryptr', 1).toString()
      });
    }
  },
  /** @type {!RequestFilter} */ ({
    urls: ['https://*.mail.yahoo.com/*'],
    types: ['main_frame']
  }),
  ['blocking']);



  // @yahoo focus or go to ymail instead
  chrome.tabs.query({
    // this must match the one declared in manifest
    url: 'https://*.mail.yahoo.com/*'
  }, goog.bind(function(tabs) {
    // All ymail tabs need to be reloaded for the e2ebind API to work
    goog.array.forEach(tabs, function(tab) {
      chrome.tabs.reload(tab.id);
    });

    // focus if present, otherwise open a new one
    tabs.length ?
        chrome.tabs.update(tabs[0].id, {highlighted: true, active: true}) :
        this.createWindow(
          e2e.ext.config.CONAME.realms[0].URL, true, goog.nullFunction);
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
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.reload(tabId);
  }, this));
};


/** @override */
ext.yExtensionLauncher.prototype.showWelcomeScreen = function() {
  var preferences = this.getPreferences();
  if (preferences.isWelcomePageEnabled()) {
    // @yahoo disabled welcome screen for now
    // this.createWindow('setup.html', true, goog.nullFunction);
    preferences.setWelcomePageEnabled(false);
  }
};


/**
 * Returns the helper proxy object.
 * @return  {!e2e.ext.utils.HelperProxy}
 */
ext.yExtensionLauncher.prototype.getHelperProxy = function() {
  return this.helperProxy_;
};


/**
 * TODO: //@yahoo use WebsiteApi
 * Sets the provided content into the element on the page that the user has
 * selected.
 * Note: This function might not work while debugging the extension.
 * @param {string} content The content to write inside the selected element.
 * @param {!Array.<string>} recipients The recipients of the message.
 * @param {string} origin The web origin where the original message was created.
 * @param {boolean} expectMoreUpdates True if more updates are expected. False
 *     if this is the final update to the selected content.
 * @param {!function(...)} callback The function to invoke once the content has
 *     been updated.
 * @param {string=} opt_subject The subject of the message if applicable.
 * @export
 */
ext.yExtensionLauncher.prototype.updateSelectedContent =
    function(content, recipients, origin, expectMoreUpdates,
             callback, opt_subject) {
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.sendMessage(tabId, {
      value: content,
      response: true,
      detach: !Boolean(expectMoreUpdates),
      origin: origin,
      recipients: recipients,
      subject: opt_subject
    });
    callback();
  }, this), true);
};


/**
 * Retrieves the content that the user has selected.
 * @param {!function(...)} callback The callback where the selected content will
 *     be passed.
 * @export
 */
ext.yExtensionLauncher.prototype.getSelectedContent = function(callback) {
  this.getActiveTab_(goog.bind(function(tabId) {
    chrome.tabs.sendMessage(tabId, {
      editableElem: true,
      enableLookingGlass: this.getPreferences().isLookingGlassEnabled(),
      hasDraft: false
    }, callback);
  }, this), true);
};


/**
 * Finds the current active tab.
 * @param {!function(...)} callback The function to invoke once the active tab
 *     is found.
 * @param {boolean=} opt_runHelper Whether the helper script must be run first.
 * @private
 */
ext.yExtensionLauncher.prototype.getActiveTab_ = function(
    callback, opt_runHelper) {
  var runHelper = opt_runHelper || false;
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, goog.bind(function(tabs) {
    var tab = tabs[0];
    if (!goog.isDef(tab)) {
      // NOTE(radi): In some operating systems (OSX, CrOS), the query will be
      // executed against the window holding the browser action. In such
      // situations we'll provide the last used tab.
      callback(this.lastTabId_);
      return;
    } else {
      this.lastTabId_ = tab.id;
    }

    // NOTE(yan): The helper script is executed automaticaly on ymail pages.
    if (e2e.ext.utils.text.isYmailOrigin(tab.url) || !runHelper) {
      callback(tab.id);
    } else {
      try {
        chrome.tabs.executeScript(tab.id, {file: 'helper_binary.js'},
                                  function() {
                                    callback(tab.id);
                                  });
      } catch (e) {
        // chrome-extension:// tabs throw an error. Ignore.
        callback(tab.id);
      }
    }
  }, this));
};


/**
 * Proxies a message to the active tab.
 * @param {messages.proxyMessage} incoming
 * @param {!MessageSender} sender
 */
ext.yExtensionLauncher.prototype.proxyMessage = function(incoming, sender) {
  if (incoming.proxy === true) {
    var message = /** @type {messages.proxyMessage} */ (incoming);
    this.getActiveTab_(goog.bind(function(tabId) {
      // Execute the action, then forward the response to the correct tab.
      var response = this.executeRequest_(message, tabId);
      if (response) {
        console.log('launcher proxying', response, tabId);
        chrome.tabs.sendMessage(tabId, response);
      }
    }, this));
  }
};


/**
* Executes an action from a proxy request.
* @param {messages.proxyMessage} args The message request
* @param {number} tabId The ID of the active tab
* @return {?(messages.proxyMessage|messages.BridgeMessageResponse|
*           messages.GetSelectionRequest)}
* @private
*/
ext.yExtensionLauncher.prototype.executeRequest_ = function(args, tabId) {
  if (args.action === constants.Actions.GLASS_CLOSED ||
      args.action === constants.Actions.SET_GLASS_SIZE) {
    return /** @type {messages.proxyMessage} */ ({
      content: args.content,
      action: args.action
    });
  } else if (args.action === constants.Actions.SET_AND_SEND_DRAFT) {
    var content = args.content;
    return /** @type {messages.BridgeMessageResponse} */ ({
      value: content.value,
      response: content.response,
      detach: content.detach,
      origin: content.origin,
      recipients: content.recipients,
      subject: content.subject,
      from: content.from
    });
  } else if (args.action === constants.Actions.GET_SELECTED_CONTENT) {
    return /** @type {messages.GetSelectionRequest} */ ({
      editableElem: true,
      hasDraft: true,
      enableLookingGlass: this.getPreferences().isLookingGlassEnabled()
    });
  } else if (args.action === constants.Actions.CHANGE_PAGEACTION) {
    chrome.browserAction.setTitle({
      tabId: tabId,
      title: chrome.i18n.getMessage('composeGlassTitle')
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128-green.png'
    });
    return null;
  } else if (args.action === constants.Actions.RESET_PAGEACTION) {
    chrome.browserAction.setTitle({
      title: chrome.i18n.getMessage('extName'),
      tabId: tabId
    });
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: 'images/yahoo/icon-128.png'
    });
    return null;
  }
};

});  // goog.scope
