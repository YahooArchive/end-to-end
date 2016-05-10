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
 * @fileoverview A stub method that allows the invocation of API calls inside
 * the JavaScript context of Yahoo Mail (codenamed Storm)
 */

goog.provide('YmailApi.StormUI');
goog.provide('YmailApi.StormUI.AutoSuggest');
goog.provide('YmailApi.StormUI.AutoSuggestFactory');
goog.provide('YmailApi.StormUI.ComposeView');
goog.provide('YmailApi.StormUI.Header');
goog.provide('YmailApi.StormUI.NeoConfig');
goog.provide('YmailApi.StormUI.Node');
goog.provide('YmailApi.StormUI.YUI');
goog.provide('YmailData.Attachments');
goog.provide('YmailData.Contacts');
goog.provide('YmailData.Draft');
goog.provide('YmailData.EmailUser');

goog.require('e2e.ext.MessageApi');
goog.require('e2e.ext.utils.text');
goog.require('goog.async.Deferred');
goog.require('goog.string');


goog.scope(function() {
var ext = e2e.ext;
var constants = ext.constants;
var messages = ext.messages;
var utils = ext.utils;


/**
 * The contacts structure
 * @typedef {!Array.<{
 *   email: !string,
 *   name: (string|undefined),
 *   imageUrl: !string
 * }>}
 */
YmailData.Contacts;


/**
 * The email user structure
 * @typedef {{name: string, email: string}}
 */
YmailData.EmailUser;


/**
 * The attachment structure
 * @typedef {!Array.<{
 *   url: string,
 *   name: string,
 *   type: (string|undefined),
 *   isImage: boolean
 * }>}
 */
YmailData.Attachments;


/**
 * The draft structure
 * @typedef {{
 *   from: YmailData.EmailUser,
 *   to: !Array.<YmailData.EmailUser>,
 *   cc: !Array.<YmailData.EmailUser>,
 *   bcc: !Array.<YmailData.EmailUser>,
 *   subject: !string,
 *   body: !string,
 *   attachments: !YmailData.Attachments,
 *   glassClosing: boolean,
 *   isInConv: !boolean
 * }}
 */
YmailData.Draft;


/**
 * @type {string}
 * @const
 */
YmailApi.APP_ID = 'YmailMailEncrypted';


/**
 * @type {string}
 * @const
 */
YmailApi.APP_VERSION = '';


/**
 * The YUI structure
 * @typedef {{
 *   use: function(...),
 *   on: function(string, Function) : {detach: function()},
 *   common: {
 *     ui: {
 *       NotificationV2: {
 *         notify: function(!string, {type:!string, duration:!number})
 *       }
 *     }
 *   },
 *   autosuggest: {
 *     api_factory: YmailApi.StormUI.AutoSuggestFactory
 *   },
 *   xobniContacts: {
 *     Utils: {
 *       getXobniBaseURL: function() : {url: !string}
 *     }
 *   }
 * }}
 */
YmailApi.StormUI.YUI;


/**
 * The YUI Node structure
 * @typedef {{
 *   getDOMNode: function(): Element,
 *   one: function(string): (YmailApi.StormUI.Node|undefined),
 *   set: function(string, *),
 *   simulate: function(string, *)
 * }}
 */
YmailApi.StormUI.Node;


/**
 * The Config structure
 * @typedef {{
 *   accounts: {
 *     primaryAccount: !Array.<{
 *       sendingName: !string,
 *       email: !string
 *     }>
 *   }
 * }}
 */
YmailApi.StormUI.NeoConfig;


/**
 * The Email Header structure
 * @typedef {{
 *   from: YmailData.EmailUser,
 *   to: Array.<YmailData.EmailUser>,
 *   cc: Array.<YmailData.EmailUser>,
 *   bcc: Array.<YmailData.EmailUser>,
 *   subject: string
 * }}
 */
YmailApi.StormUI.Header;


/**
 * The ComposeView API structure
 * @typedef {{
 *   header: {
 *     hdr: YmailApi.StormUI.Node,
 *     getHeader: function(): {
 *       from: YmailData.EmailUser,
 *       to: !Array.<YmailData.EmailUser>,
 *       cc: !Array.<YmailData.EmailUser>,
 *       bcc: !Array.<YmailData.EmailUser>,
 *       subject: !string
 *     },
 *     setHeader: function(YmailApi.StormUI.Header),
 *     removeAllLozenges: function(Object)
 *   },
 *   editor: {
 *     getContent: function(): !string,
 *     getContentAsPlainText: function(): !string,
 *     setContent: function(string, number)
 *   },
 *   draft: {
 *     origin: {
 *       oMsg: {body: {display: string}}
 *     },
 *     getUploadedOrSavedAtt: function(): !Array.<{
 *       getFilename: function() : string,
 *       getFileType: function() : (string|undefined),
 *       isImage: function() : boolean,
 *       getDownloadUrl: function() : string
 *     }>,
 *     on: function(string, function(Event)) : {detach: function()}
 *   },
 *   before: function(string, function(Event)) : {detach: function()},
 *   on: function(string, function(Event)) : {detach: function()},
 *   once: function(string, function(Event)) : {detach: function()},
 *   setFocus: function(string),
 *   handleComposeAction: function(string),
 *   save: function(),
 *   resizeRTE: function(),
 *   baseNode: YmailApi.StormUI.Node
 * }}
 */
YmailApi.StormUI.ComposeView;


/**
 * The AutoSuggest API structure
 * @typedef {{
 *   autosuggestSearch: function({
 *     fromContext: string,
 *     toContext: Array<string>,
 *     query: string,
 *     renderHandler: function(YmailData.Contacts),
 *     errorHandler: function(string),
 *     timeoutHandler: function(string)})
 * }}
 */
YmailApi.StormUI.AutoSuggest;


/**
 * The AutoSuggest Factory API structure
 * @typedef {{
 *   get: function(boolean) : {
 *     create: function(Object) : YmailApi.StormUI.AutoSuggest
 *   }
 * }}
 */
YmailApi.StormUI.AutoSuggestFactory;



/**
 * Constructor for the YMail Event Target Helper class.
 * @param {YmailApi.StormUI.YUI} Y
 * @param {YmailApi.StormUI.NeoConfig} NeoConfig
 * @constructor
 */
YmailApi.StormUI = function(Y, NeoConfig) {
  if (!Y || !NeoConfig) {
    throw new Error('YUI not found. Is it YMail Storm?');
  }

  this.Y = Y;
  this.NeoConfig = NeoConfig;

  this.monitorStormEvents_();
  this.monitorExtensionEvents_();
  this.addCSS();
};


/**
 * Capture events that are dispatched from the extension
 * @private
 */
YmailApi.StormUI.prototype.monitorExtensionEvents_ = function() {
  document.body.addEventListener('displayWarning', goog.bind(function(evt) {
    this.displayFailure(/** @type {!string} */ (evt.detail), 'attention');
  }, this));
  document.body.addEventListener('displayError', goog.bind(function(evt) {
    this.displayFailure(/** @type {!string} */ (evt.detail));
  }, this));
};


/**
 * Capture events that are dispatched from Y.fire()
 * @private
 */
YmailApi.StormUI.prototype.monitorStormEvents_ = function() {
  var Y = this.Y;

  Y.on('MessagePane:rendered', goog.bind(function(evt, data, baseNode) {
    var node = baseNode.getDOMNode();
    this.dispatchQueryPublicKey(node);
    this.dispatchOpenMessage(node, data);
  }, this));

  Y.on('FullCompose:fullComposeReady', goog.bind(function(data) {
    var composeView = data.context,
        elem = composeView.baseNode.getDOMNode(),
        msgBody = composeView.editor.getContentAsPlainText(),
        oMsg = composeView.draft.origin.oMsg;
    var apiId = goog.string.getRandomString();

    elem.dispatchEvent(new CustomEvent('openCompose', {
      detail: {
        apiId: apiId,
        isEncryptedDraft: goog.isString(msgBody) &&
            msgBody.indexOf('\nisDraft: true\n') !== -1
      },
      bubbles: true
    }));

    // install a lock icon, that would fire openEncryptedCompose when clicked
    this.addEncryptrIcon(elem);

    // build an API that wraps the native features provided by Storm
    new YmailApi.StormUI.ComposeApi(
        Y, this.NeoConfig, composeView, apiId,
        goog.bind(this.dispatchQueryPublicKey, this),
        goog.bind(this.displayFailure, this));
  }, this));

  // dispatch the loadUser event as soon as this stub is loaded
  this.dispatchLoadUser();
};


/**
 * Check whether the email addresses are registered with public keys
 * @param {Element} node The element where the message can be found
 * @protected
 */
YmailApi.StormUI.prototype.dispatchQueryPublicKey = function(node) {
  var addressAttrName = 'data-address',
      userNodes = node.querySelectorAll(
          '[' + addressAttrName + ']:not(.has-key):not(.no-key)');

  [].forEach.call(userNodes, function(userNode) {
    userNode.dispatchEvent(new CustomEvent('queryPublicKey', {
      detail: userNode.getAttribute(addressAttrName),
      bubbles: true
    }));
  });
};


/**
 * Collect message body, and dispatch the openMessage event
 * @param {Element} node The element where the message can be found
 * @param {Object} data The meta data of the message
 * @protected
 */
YmailApi.StormUI.prototype.dispatchOpenMessage = function(node, data) {
  var bodyNode = node.querySelector('.thread-body,.base-card-body'),
      contentNode = bodyNode.querySelector('.body,.msg-body'),
      qt = contentNode.querySelector('.thread-quoted-text'),
      qb = contentNode.querySelector('.thread-quoted-body');

  // hide "show original message" tentatively, so it wont appear in innerText
  if (qt) {
    var qtDisplayVal = qt.style.display;
    qt.style.display = 'none';
  }

  bodyNode.dispatchEvent(new CustomEvent('openMessage', {
    detail: {
      meta: data, // not actually in use yet
      body: contentNode.innerText,
      quotedBody: qb ? qb.innerText : ''
    }, bubbles: true}));

  // restore "show original message"
  qt && (qt.style.display = qtDisplayVal || '');
};


/**
 * Dispatch the loadUser event
 * @protected
 */
YmailApi.StormUI.prototype.dispatchLoadUser = function() {
  var accounts = this.NeoConfig.accounts;
  var primaryAccount = accounts && accounts.primaryAccount;
  if (primaryAccount && primaryAccount.length) {
    document.body.dispatchEvent(new CustomEvent('loadUser', {
      detail: {
        name: primaryAccount[0].sendingName,
        email: primaryAccount[0].email
      }
    }));
  }
};


/**
 * Add inline CSS to the page
 * @protected
 */
YmailApi.StormUI.prototype.addCSS = function() {
  var style = document.createElement('style');
  style.appendChild(document.createTextNode(
      '.plaintext-above,.plaintext-below{white-space:pre-line}' +
      '.plaintext-above{border-top:1px solid #CCC;padding-top:5px}' +
      '.plaintext-below{border-bottom:1px solid #CCC;padding-bottom:5px}' +
      '.has-key {color: #00B777}' +
      '.no-key {color: #EF2E1A}' +
      '.icon-encrypt {position:relative;float:right;padding:0;opacity:.6}' +
      '.icon-encrypt:hover {opacity:1}' +
      '.icon-encrypt + .cm-rtetext {padding-right:25px}'));
  document.head.appendChild(style);
};


/**
 * Add encryptr icon to compose, firing encrypted-compose event when clicked.
 * @param {Element} target The compose element
 * @protected
 */
YmailApi.StormUI.prototype.addEncryptrIcon = function(target) {
  var textArea = target.querySelector('.cm-rtetext');
  var encryptrIcon = document.createElement('div');
  encryptrIcon.classList.add('icon', 'icon-encrypt');
  encryptrIcon.addEventListener('click', function() {
    target.dispatchEvent(new CustomEvent('openEncryptedCompose'));
  }, false);

  textArea.parentElement.insertBefore(encryptrIcon, textArea);
};


/**
 * Use the YMail API for display notification message
 * @param {!string} message A message
 * @param {string=} opt_type If unspecified, display it as error
 */
YmailApi.StormUI.prototype.displayFailure = function(message, opt_type) {
  this.Y.use('common-ui-notification-v2', function(Y) {
    Y.common.ui.NotificationV2.notify(message, {
      type: opt_type || 'error',
      close: true,
      closeOnExternalClick: true,
      duration: 5000
    });
  });
};



/**
 * Constructor for the Compose API
 * @param {YmailApi.StormUI.YUI} Y
 * @param {YmailApi.StormUI.NeoConfig} NeoConfig
 * @param {YmailApi.StormUI.ComposeView} composeView
 * @param {!string} apiId The Message API id
 * @param {function(Element)} dispatchQueryPublicKey
 * @param {function(!string, string=)} displayFailure
 * @constructor
 */
YmailApi.StormUI.ComposeApi = function(
    Y, NeoConfig, composeView, apiId,
    dispatchQueryPublicKey, displayFailure) {
  this.Y = Y;
  this.NeoConfig = NeoConfig;
  this.composeView_ = composeView;
  this.dispatchQueryPublicKey_ = dispatchQueryPublicKey;
  this.displayFailure_ = displayFailure;

  this.draftApi_ = new YmailApi.StormUI.DraftApi(composeView);
  this.autosuggestApi_ = new YmailApi.StormUI.AutoSuggestApi(Y, NeoConfig);

  this.messageApi_ = this.initApi_(apiId);
  this.monitorComposeEvents_();
};


/**
 * @param {!string} apiId The API id
 * @return {!e2e.ext.MessageApi} The initiatied Message API
 * @private
 */
YmailApi.StormUI.ComposeApi.prototype.initApi_ = function(apiId) {
  var api = new e2e.ext.MessageApi(apiId);
  api.bootstrapClient(utils.text.isYmailOrigin, goog.bind(function(err) {
    if (err instanceof Error) {
      this.displayFailure_(err.message, 'error');
      return;
    }

    var draftApi = this.draftApi_,
        autosuggestApi = this.autosuggestApi_;

    // register the implementations in the Message API
    api.getRequestHandler().addAll({
      'draft.get': goog.bind(draftApi.get, draftApi),
      'draft.set': goog.bind(draftApi.set, draftApi),
      'draft.save': goog.bind(draftApi.save, draftApi),
      'draft.send': goog.bind(draftApi.send, draftApi),
      'draft.getQuoted': goog.bind(draftApi.getQuoted, draftApi),
      'draft.discard': goog.bind(draftApi.discard, draftApi),
      'autosuggest.search': goog.bind(autosuggestApi.search, autosuggestApi)
    });
  }, this));
  return api;
};


/**
 * @private
 */
YmailApi.StormUI.ComposeApi.prototype.monitorComposeEvents_ = function() {
  var composeView = this.composeView_,
      api = this.messageApi_,
      dispatchQueryPublicKey = this.dispatchQueryPublicKey_;

  // notify the glass on close
  composeView.on('closeChange', function() {
    api.req('evt.close').addCallback(goog.bind(api.dispose, api));
  });

  // wrap resizeRTE(), which is called when recipients are modified
  var resizeRTE_ = composeView.resizeRTE;
  composeView.resizeRTE = function() {
    dispatchQueryPublicKey(this.baseNode.getDOMNode());
    return resizeRTE_.apply(this, arguments);
  };
};



/**
 * Construct an instance that implements the required draft api calls
 * @param {YmailApi.StormUI.ComposeView} composeView The ComposeView instance
 *     exposed by Yahoo Mail, codenamed Storm
 * @constructor
 */
YmailApi.StormUI.DraftApi = function(composeView) {
  this.composeView_ = composeView;
};


/**
 * @return {!YmailData.Draft}
 */
YmailApi.StormUI.DraftApi.prototype.get = function() {
  var composeView = this.composeView_;
  var draft = composeView.draft;
  var header = composeView.header.getHeader();
  var oMsg = draft.origin.oMsg;
  return /** @type {YmailData.Draft} */ ({
    from: header.from,
    to: header.to,
    cc: header.cc,
    bcc: header.bcc,
    subject: header.subject,
    // TODO: support rich text later
    body: goog.string.unescapeEntitiesWithDocument(
        composeView.editor.getContentAsPlainText().
            replace(/<br\s*\/?>/ig, '\n'),
        document),
    attachments: draft.getUploadedOrSavedAtt().map(function(att) {
      return {
        name: att.getFilename(),
        type: att.getFileType(),
        isImage: att.isImage(),
        url: att.getDownloadUrl()
      };
    }),
    isInConv: Boolean(oMsg)
  });
};


/**
 * @param {YmailData.Draft} draft
 * @return {!boolean}
 */
YmailApi.StormUI.DraftApi.prototype.set = function(draft) {
  var header = this.composeView_.header, node = header.hdr;

  // TODO: can we not use DOM calls to remove recipients?
  draft.to && draft.to.length &&
      header.removeAllLozenges(node.one('.cm-to-field'));
  draft.cc && draft.cc.length &&
      header.removeAllLozenges(node.one('.cm-cc-field'));
  draft.bcc && draft.bcc.length &&
      header.removeAllLozenges(node.one('.cm-bcc-field'));
  // fixed Storm to handle empty subject
  goog.isDef(draft.subject) &&
      node.one('#subject-field').set('value', draft.subject).simulate('keyup');

  header.setHeader(draft);

  if (goog.isDef(draft.body)) {
    // TODO: support rich text
    draft.body = goog.string.newLineToBr(goog.string.htmlEscape(draft.body));
    this.composeView_.editor.setContent(draft.body, 0);
  }

  //TODO: handle attachments

  if (draft.glassClosing) {
    this.composeView_.resizeRTE();
    this.composeView_.setFocus('body');
  }
  return true;
};


/**
 * @param {YmailData.Draft} draft
 * @return {!goog.async.Deferred.<boolean>}
 */
YmailApi.StormUI.DraftApi.prototype.save = function(draft) {
  var result;
  this.set(draft);
  // in case the draft is being saved by autoSave, before calling our save()
  // be prepared for next set of save events
  do {
    result = this.saveResult_();
  } while (result.hasFired());
  this.composeView_.save(); // avoid less reliable handleComposeAction('save')
  return result;
};


/**
 * @param {YmailData.Draft} draft
 * @return {!goog.async.Deferred.<boolean>}
 */
YmailApi.StormUI.DraftApi.prototype.send = function(draft) {
  var result = this.sendResult_(); // rely on the next send event. no auto send
  this.set(draft);
  this.composeView_.handleComposeAction('send');
  return result;
};


/**
 * @return {!goog.async.Deferred.<?string>}
 */
YmailApi.StormUI.DraftApi.prototype.getQuoted = function() {
  var oMsg = this.composeView_.draft.origin.oMsg;
  if (!oMsg) {
    return goog.async.Deferred.succeed(null);
  } else if (oMsg.body) {
    return goog.async.Deferred.succeed(oMsg.body.display);
  }
  var result = new goog.async.Deferred;
  this.composeView_.once('draftLoaded', function() {
    var oMsg = this.draft.origin.oMsg;
    oMsg && oMsg.body && result.callback(oMsg.body.display);
  });
  return result;
};


/**
 * @return {!boolean}
 */
YmailApi.StormUI.DraftApi.prototype.discard = function() {
  this.composeView_.handleComposeAction('delete');
  return true;
};


/**
 * @return {!goog.async.Deferred.<boolean>}
 * @private
 */
YmailApi.StormUI.DraftApi.prototype.saveResult_ = function() {
  var result = new goog.async.Deferred,
      successHandler = this.composeView_.once('compose:saveSuccess',
          goog.bind(result.callback, result, true)),
      failureHandler = this.composeView_.once('compose:saveFailure',
          goog.bind(result.errback, result, new Error('saveFailed')));
  return result.addBoth(function() {
    successHandler.detach();
    failureHandler.detach();
  });
};


/**
 * @return {!goog.async.Deferred.<boolean>}
 * @private
 */
YmailApi.StormUI.DraftApi.prototype.sendResult_ = function() {
  var result = new goog.async.Deferred;
  var listener = this.composeView_.draft.on('stateChanged', function(evt) {
    var e = /** @type {{prev: string, next: string, err: string}} */ (evt);
    if (e.prev === 'savingAndSending' ||
        e.prev === 'sending' ||
        e.prev === 'sent' ||
        (e.prev === 'captchaing' && e.next === 'unsaved')) {
      if (e.next === 'final') {
        listener.detach();
        result.callback(true);
      } else if (e.err) { // unsaved
        listener.detach();
        result.errback(new Error('sendFailure'));
      }
    }
  });
  return result;
};



/**
 * Construct an instance that implements the required autosuggest api calls
 * @param {YmailApi.StormUI.YUI} Y
 * @param {YmailApi.StormUI.NeoConfig} NeoConfig
 * @constructor
 */
YmailApi.StormUI.AutoSuggestApi = function(Y, NeoConfig) {
  this.Y = Y;
  this.apiConfig_ = {
    debounce: 60,
    getWssid: function() {
      return NeoConfig.wssid;
    },
    setWssid: function(newId) {
      NeoConfig.wssid = newId;
    },
    getAppid: function() {
      return YmailApi.APP_ID;
    },
    xobniBaseURL: Y.xobniContacts.Utils.getXobniBaseURL().url
  };

  this.initApi_();
};


/**
 * @param {{from: string, to: Array<string>, query: !string}} args
 * @return {goog.async.Deferred.<!YmailData.Contacts>}
 */
YmailApi.StormUI.AutoSuggestApi.prototype.search = function(args) {
  var result = new goog.async.Deferred,
      errback = goog.bind(result.errback, result);

  this.initApi_().addCallback(function(api) {
    api.autosuggestSearch({
      fromContext: args.from || '',
      toContext: args.to || [],
      query: args.query || '',
      renderHandler: goog.bind(result.callback, result),
      errorHandler: errback,
      timeoutHandler: errback
    });
  });
  return result;
};


/**
 * @return {!goog.async.Deferred.<YmailApi.StormUI.AutoSuggest>}
 * @private
 */
YmailApi.StormUI.AutoSuggestApi.prototype.initApi_ = function() {
  if (this.api_) {
    return goog.async.Deferred.succeed(this.api_);
  }
  var result = new goog.async.Deferred;
  this.Y.use('autosuggest-api-factory', 'xobni-utilities',
      goog.bind(function(Y) {
        this.api_ = Y.autosuggest.api_factory.
            get(true).create(this.apiConfig_);
        result.callback(this.api_);
      }, this));
  return result;
};


YmailApi.StormUI.bootstrap = function() {
  // this should generally not happen. remove when everyone updated
  if (window.location.href.indexOf('encryptr') !== -1) {
    window.location.href = 'https://mail.yahoo.com/';
    return;
  }

  var globalVar = /** @type {{
    yui: YmailApi.StormUI.YUI,
    NeoConfig: YmailApi.StormUI.NeoConfig}} */ (goog.global);

  if (globalVar.yui) {
    if (typeof globalVar.yui.on === 'function') {
      new YmailApi.StormUI(globalVar.yui, globalVar.NeoConfig);
      return;
    }
    window.setTimeout(YmailApi.StormUI.bootstrap, 300);
  }
}

// bootstrap the stub
YmailApi.StormUI.bootstrap();

});  // goog.scope
