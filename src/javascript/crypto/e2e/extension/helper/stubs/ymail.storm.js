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
 * @fileoverview A stub that allows the invocation of API calls inside the
 * JavaScript context of Yahoo Mail (codenamed Storm)
 */
goog.provide('YmailApi');
goog.provide('YmailApi.StormUI');
goog.provide('YmailApi.StormUI.AutoSuggest');
goog.provide('YmailApi.StormUI.ComposeView');
goog.provide('YmailApi.StormUI.Header');
goog.provide('YmailApi.StormUI.NeoConfig');
goog.provide('YmailApi.StormUI.Node');
goog.provide('YmailApi.StormUI.YUI');
goog.provide('YmailApi.utils');

goog.require('e2e.ext.MessageApi');
/** @suppress {extraRequire} intentional import */
goog.require('e2e.ext.YmailType');
goog.require('goog.async.Deferred');
goog.require('goog.disposable.IDisposable');
goog.require('goog.string');


goog.scope(function() {
var YmailType = e2e.ext.YmailType;


/**
 * @type {string}
 * @const
 */
YmailApi.APP_ID = 'YmailMailEncrypted';


/**
 * The YUI structure
 * @typedef {{
 *   use: function(...),
 *   on: function(string, Function) : {detach: function()},
 *   fire: function(string, *),
 *   common: {
 *     ui: {
 *       NotificationV2: {
 *         notify: function(!string, {type:!string, duration:!number})
 *       }
 *     }
 *   },
 *   autosuggest: {
 *     api_factory: {
 *       get: function(boolean) : {
 *         create: function(Object) : YmailApi.StormUI.AutoSuggest
 *       }
 *     }
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
 *   simulate: function(string, Object=)
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
 *   },
 *   userDataObj: {
 *     userUIPref: {
 *       useRichText: string
 *     }
 *   }
 * }}
 */
YmailApi.StormUI.NeoConfig;


/**
 * The Email Header structure
 * @typedef {{
 *   from: YmailType.EmailUser,
 *   to: Array.<YmailType.EmailUser>,
 *   cc: Array.<YmailType.EmailUser>,
 *   bcc: Array.<YmailType.EmailUser>,
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
 *       from: YmailType.EmailUser,
 *       to: !Array.<YmailType.EmailUser>,
 *       cc: !Array.<YmailType.EmailUser>,
 *       bcc: !Array.<YmailType.EmailUser>,
 *       subject: !string
 *     },
 *     setHeader: function(YmailApi.StormUI.Header),
 *     removeAllLozenges: function(Object)
 *   },
 *   editor: {
 *     getContent: function(): !string,
 *     getContentAsPlainText: function(): !string,
 *     setContent: function(string, number),
 *     getDefaultFontInfo: function() : {
 *       fontFamily: string,
 *       fontSize: string
 *     }
 *   },
 *   quotedTextBody: string,
 *   draft: {
 *     origin: {
 *       oMsg: {
 *         body: {display: string},
 *         header: {from: YmailType.EmailUser, sentDate: number}
 *       },
 *       action: string
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
 *   fire: function(string, ...*),
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
 *     renderHandler: function(YmailType.Contacts),
 *     errorHandler: function(string),
 *     timeoutHandler: function(string)})
 * }}
 */
YmailApi.StormUI.AutoSuggest;



/**
 * Constructor for serving APIs to/from the extension.
 * @param {YmailApi.StormUI.YUI} Y
 * @param {YmailApi.StormUI.NeoConfig} NeoConfig
 * @implements {goog.disposable.IDisposable}
 * @constructor
 */
YmailApi.StormUI = function(Y, NeoConfig) {
  /**
   * Whether this is already disposed.
   * @type {!boolean}
   * @private
   */
  this.disposed_ = false;

  if (!Y || !NeoConfig) {
    throw new Error('YUI not found. Is it YMail Storm?');
  }

  this.Y = Y;
  this.NeoConfig = NeoConfig;

  // add CSS
  this.addCSS();
  // dispatch the loadUser event as soon as this stub is loaded
  this.dispatchLoadUser();

  this.monitorExtensionEvents_();

  /**
   * @type {Array.<YmailApi.StormUI.ComposeApi>}
   * @private
   */
  this.composeApis_ = [];

  Y.use('event', goog.bind(this.monitorStormEvents_, this));
};


/**
 * The unique selector for elements in composeView
 * @enum {string}
 */
YmailApi.StormUI.Selector = {
  TO: '.cm-to-field',
  CC: '.cm-cc-field',
  BCC: '.cm-bcc-field',
  SUBJECT: '#subject-field',
  EDITOR: '.cm-rtetext'
};


/** @desc extension is disabled. */
YmailApi.StormUI.MSG_DISABLED = goog.getMsg('Extension disabled.');


/**
 * Capture events that are dispatched from the extension
 * @private
 */
YmailApi.StormUI.prototype.monitorExtensionEvents_ = function() {
  this.displayWarning_ = goog.bind(function(evt) {
    this.displayFailure(/** @type {!string} */ (evt.detail), 'attention');
  }, this);
  this.displayError_ = goog.bind(function(evt) {
    this.displayFailure(/** @type {!string} */ (evt.detail));
  }, this);

  var body = document.body;
  body.addEventListener('displayWarning', this.displayWarning_, false);
  body.addEventListener('displayError', this.displayError_, false);
  body.addEventListener('dispose', this.dispose, false);
};


/**
 * Capture events that using Y.on()
 * @param {YmailApi.StormUI.YUI} Y
 * @private
 */
YmailApi.StormUI.prototype.monitorStormEvents_ = function(Y) {
  this.yuiEventListeners_ = [
    Y.on('MessagePane:rendered', goog.bind(this.dispatchOpenMessage, this)),
    Y.on('FullCompose:fullComposeReady',
        goog.bind(this.dispatchOpenCompose, this))
  ];
};


/**
 * Dispatch the openCompose event
 * @param {Object} data The meta data of the message
 * @protected
 */
YmailApi.StormUI.prototype.dispatchOpenCompose = function(data) {
  if (this.isDisposed()) {
    return;
  }
  var composeView = data.context,
      elem = composeView.baseNode.getDOMNode(),
      msgBody = composeView.editor.getContent(),
      apiId = goog.string.getRandomString(),
      composeEventInit = {
        detail: {
          apiId: apiId,
          isEncryptedDraft: YmailApi.utils.isLikelyPGP(msgBody)
        },
        bubbles: true
      };

  elem.dispatchEvent(new CustomEvent('openCompose', composeEventInit));

  // add a lock icon to fire openEncryptedCompose when clicked
  this.addEncryptrIcon(elem, composeEventInit);

  // build an API that wraps the native features provided by Storm
  this.composeApis_.push(
      new YmailApi.StormUI.ComposeApi(this, composeView, apiId));
};


/**
 * Collect message body, and dispatch the openMessage event
 * @param {*} evt This is ignored
 * @param {Object} data The meta data of the message
 * @param {YmailApi.StormUI.Node} baseNode The baseNode containing the message
 * @protected
 */
YmailApi.StormUI.prototype.dispatchOpenMessage = function(
    evt, data, baseNode) {
  if (this.isDisposed()) {
    return;
  }
  // TODO: when rich text is supported. get HTML thru API.
  var node = baseNode.getDOMNode(),
      bodyNode = node.querySelector('.thread-body,.base-card-body'),
      contentNode = bodyNode.querySelector('.body,.msg-body'),
      qt = contentNode.querySelector('.thread-quoted-text'),
      qb = contentNode.querySelector('.thread-quoted-body'),
      text, quotedText;

  // hide "show original message" tentatively, so it wont appear in innerText
  if (qt) {
    var qtDisplayVal = qt.style.display;
    qt.style.display = 'none';
  }

  text = contentNode.innerText;
  quotedText = qb ? qb.innerText : '';

  // only take care of those that appears to be a pgp message
  if (YmailApi.utils.isLikelyPGP(text + quotedText)) {
    // highlight users only on encrypted read
    this.dispatchQueryPublicKey(node);

    var apiId = goog.string.getRandomString();
    var triggerEvent = goog.bind(this.triggerEvent, this, baseNode);

    bodyNode.dispatchEvent(new CustomEvent('openMessage', {
      detail: {
        apiId: apiId,
        meta: data, // not actually in use
        body: text,
        quotedBody: quotedText
      }, bubbles: true}));

    this.log('yme_read');

    var messageApi = this.initApi(apiId, function() {
      messageApi.setRequestHandler('evt.trigger', triggerEvent);
    });
  }

  // restore "show original message"
  qt && (qt.style.display = qtDisplayVal || '');
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
      // '.has-key {color: #00B777}' + // disabled coloring for now
      // '.no-key {color: #EF2E1A}' + // no need to color in red
      '.icon-encrypt {position:relative;float:right;padding:0;opacity:.6}' +
      '.icon-encrypt:hover {opacity:1}' +
      '.icon-encrypt + .cm-rtetext {padding-right:25px}'));
  document.head.appendChild(style);
};


/**
 * Add encryptr icon to compose, firing the openEncryptedCompose event when
 * clicked.
 * @param {Element} target The compose element
 * @param {{detail: *, bubbles: (boolean|undefined),
 *     cancellable: (boolean|undefined)}} eventInit The compose event init
 * @protected
 */
YmailApi.StormUI.prototype.addEncryptrIcon = function(target, eventInit) {
  var textArea = target.querySelector(YmailApi.StormUI.Selector.EDITOR);
  var encryptrIcon = document.createElement('div');
  var clickHandler = goog.bind(function(evt) {
    if (this.isDisposed()) {
      this.displayFailure(YmailApi.StormUI.MSG_DISABLED);
      encryptrIcon.parentElement.removeChild(encryptrIcon);
      encryptrIcon.removeEventListener('click', clickHandler, false);
      return;
    }
    target.dispatchEvent(
        new CustomEvent('openEncryptedCompose', eventInit));
  }, this);
  encryptrIcon.addEventListener('click', clickHandler, false);
  encryptrIcon.classList.add('icon', 'icon-encrypt');

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
 * @return {boolean} Whether the object has been disposed of.
 * @override
 */
YmailApi.StormUI.prototype.isDisposed = function() {
  return this.disposed_;
};


/**
 * Dispose this instance
 */
YmailApi.StormUI.prototype.dispose = function() {
  if (this.isDisposed()) {
    return;
  }
  this.disposed_ = true;

  if (this.yuiEventListeners_) {
    this.yuiEventListeners_.forEach(function(listener) {
      listener.detach();
    });
    this.yuiEventListeners_ = null;
  }

  this.composeApis_ = [];

  var body = document.body;
  body.removeEventListener('displayWarning', this.displayWarning_, false);
  body.removeEventListener('displayError', this.displayError_, false);
  body.removeEventListener('dispose', this.dispose, false);
};


/**
 * Remove the associated instance of ComposeApi from the bookkeeping list, so
 * it would not be handed over.
 * @param {YmailApi.StormUI.ComposeApi} composeApi The instance to remove.
 */
YmailApi.StormUI.prototype.composeApiClosed = function(composeApi) {
  var i = this.composeApis_.indexOf(composeApi);
  if (i >= 0) {
    this.composeApis_.splice(i, 1);
  }
};


/**
 * Revive all composes with the APIs that loaded the last
 * @param {YmailApi.StormUI} newInstance
 */
YmailApi.StormUI.prototype.handoverComposeApis = function(newInstance) {
  for (var i = 0, composeApi; composeApi = this.composeApis_[i]; i++) {
    if (composeApi.composeView_.header !== null) {
      composeApi.registerImplementations(
          composeApi.main_, composeApi.composeView_, composeApi.stats);
      newInstance.composeApis_.push(composeApi);
    } else {
      composeApi.dispose();
    }
  }
};


/**
 * Simulate focus to baseNode before firing the specified event
 * @param {YmailApi.StormUI.Node} node The baseNode
 * @param {!{type: (string|undefined),
 *     metaKey: (boolean|undefined), ctrlKey: (boolean|undefined),
 *     shiftKey: (boolean|undefined), altKey: (boolean|undefined)}} evt
 * @param {YmailApi.StormUI.Selector=} opt_selector
 * @return {!boolean}
 */
YmailApi.StormUI.prototype.triggerEvent = function(
    node, evt, opt_selector) {
  if (opt_selector) {
    node = node.one(opt_selector) || node;
  }
  node.getDOMNode() && node.simulate(evt.type, evt);
  return true;
};


/**
 * Bootstrap the MessageAPI
 * @param {!string} apiId The API id
 * @param {!function(this:YmailApi.StormUI)} onReadyCallback Callback when
 *     the MessageApi instance is done bootstrapping
 * @return {!e2e.ext.MessageApi} The initiatied Message API
 */
YmailApi.StormUI.prototype.initApi = function(apiId, onReadyCallback) {
  var api = new e2e.ext.MessageApi(apiId);
  api.bootstrapClient(YmailApi.utils.isSameOrigin, goog.bind(function(err) {
    if (err instanceof e2e.ext.MessageApi.TimeoutError) {
      this.dispose();
      return this.displayFailure(YmailApi.StormUI.MSG_DISABLED, 'error');
    } else if (err instanceof Error) {
      return this.displayFailure(err.message, 'error');
    }
    onReadyCallback.call(this);
  }, this));
  return api;
};


/**
 * Log an interesting event
 * @param {string} name
 * @param {*=} opt_tags
 */
YmailApi.StormUI.prototype.log = function(name, opt_tags) {
  var data = {name: name};
  opt_tags && (data.tags = opt_tags);
  this.Y.fire('util:ymstats', data);
};



/**
 * Constructor for the Compose API
 * @param {YmailApi.StormUI} main
 * @param {YmailApi.StormUI.ComposeView} composeView
 * @param {!string} apiId The Message API id
 * @constructor
 * @implements {goog.disposable.IDisposable}
 */
YmailApi.StormUI.ComposeApi = function(main, composeView, apiId) {
  this.disposed_ = false;
  this.main_ = main;
  this.composeView_ = composeView;

  /** @type {e2e.ext.YmailType.SendStats} */
  var stats = this.stats = {};

  this.Y = main.Y;
  this.NeoConfig = main.NeoConfig;
  this.dispatchQueryPublicKey_ = goog.bind(main.dispatchQueryPublicKey, main);
  this.displayFailure_ = goog.bind(main.displayFailure, main);

  this.messageApi_ = main.initApi(apiId, goog.bind(
      this.registerImplementations, this, main, composeView, stats));
  this.monitorComposeEvents_();
};


/**
 * Register the implementations for the APIs
 * @param {YmailApi.StormUI} main
 * @param {YmailApi.StormUI.ComposeView} composeView
 * @param {e2e.ext.YmailType.SendStats} stats
 */
YmailApi.StormUI.ComposeApi.prototype.registerImplementations = function(
    main, composeView, stats) {
  // register the implementations in the Message API
  var draftApi = new YmailApi.StormUI.DraftApi(main, composeView, stats);
  var autosuggestApi = new YmailApi.StormUI.AutoSuggestApi(main);

  this.messageApi_.getRequestHandler().addAll({
    'draft.get': goog.bind(draftApi.get, draftApi),
    'draft.set': goog.bind(draftApi.set, draftApi),
    'draft.save': goog.bind(draftApi.save, draftApi),
    'draft.send': goog.bind(draftApi.send, draftApi),
    'draft.getQuoted': goog.bind(draftApi.getQuoted, draftApi),
    'draft.discard': goog.bind(draftApi.discard, draftApi),
    'evt.trigger': goog.bind(main.triggerEvent, main, composeView.baseNode),
    'autosuggest.search': goog.bind(autosuggestApi.search, autosuggestApi)
  });
};


/**
 * @private
 */
YmailApi.StormUI.ComposeApi.prototype.monitorComposeEvents_ = function() {
  var composeView = this.composeView_,
      api = this.messageApi_,
      stats = this.stats;

  this.recipientObservers_ = [
    this.monitorRecipients_(YmailApi.StormUI.Selector.TO),
    this.monitorRecipients_(YmailApi.StormUI.Selector.CC),
    this.monitorRecipients_(YmailApi.StormUI.Selector.BCC)
  ];

  var sendEvt = composeView.draft.on('stateChanged', goog.bind(function(evt) {
    var e = /** @type {{prev: string, next: string, err: string}} */ (evt);
    if (e.prev === 'savingAndSending' ||
        e.prev === 'sending' ||
        e.prev === 'sent' ||
        (e.prev === 'captchaing' && e.next === 'unsaved')) {
      if (e.next === 'final') {
        composeView.fire('compose:sendSuccess');

        // check if msg can be secured if not initiated by encrypted-compose
        if (goog.isDef(stats.encrypted)) {
          this.main_.log('yme_send_encrypted_' + stats.encrypted);
        } else {
          stats.canEncrypt = this.composeView_.baseNode.one('.no-key') ? 0 : 1;
          this.main_.log('yme_send_can_encrypt_' + stats.canEncrypt);
        }
        // log the send event
        this.main_.log('yme_send', stats);

        sendEvt.detach();
      } else if (e.err) { // unsaved
        composeView.fire('compose:sendFailure', e.err);
      }
    }
  }, this));

  // on close
  composeView.on('closeChange', goog.bind(this.dispose, this));
};


/**
 * @param {!YmailApi.StormUI.Selector} selector
 * @return {MutationObserver}
 * @private
 */
YmailApi.StormUI.ComposeApi.prototype.monitorRecipients_ = function(selector) {
  var onNewRecipientCallback = this.dispatchQueryPublicKey_,
      observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          [].forEach.call(mutation.addedNodes, onNewRecipientCallback);
        });
      });

  // pass in the target node, as well as the observer options
  observer.observe(
      document.querySelector(selector).parentElement.parentElement,
      {childList: true});

  return observer;
};


/**
 * @return {boolean} Whether the object has been disposed of.
 * @override
 */
YmailApi.StormUI.ComposeApi.prototype.isDisposed = function() {
  return this.disposed_;
};


/**
 * Dispose this instance
 */
YmailApi.StormUI.ComposeApi.prototype.dispose = function() {
  if (!this.isDisposed()) {
    this.disposed_ = true;
    var api = this.messageApi_;
    api.req('evt.close').addCallback(function() {
      this.recipientObservers_.forEach(function(observer) {
        observer.disconnect();
      });
      api.dispose();
    }, this);

    this.main_.composeApiClosed(this);
  }
};



/**
 * Construct an instance that implements the required draft api calls
 * @param {YmailApi.StormUI} main The main instance
 * @param {YmailApi.StormUI.ComposeView} composeView The ComposeView instance
 *     exposed by Yahoo Mail, codenamed Storm
 * @param {e2e.ext.YmailType.SendStats} stats
 * @constructor
 */
YmailApi.StormUI.DraftApi = function(main, composeView, stats) {
  this.main_ = main;
  this.composeView_ = composeView;
  this.stats = stats;
};


/**
 * @return {!YmailType.Draft}
 */
YmailApi.StormUI.DraftApi.prototype.get = function() {
  var composeView = this.composeView_;
  var draft = composeView.draft;
  var header = composeView.header.getHeader();

  return /** @type {YmailType.Draft} */ ({
    from: header.from,
    to: header.to,
    cc: header.cc,
    bcc: header.bcc,
    subject: header.subject,
    body: composeView.editor.getContent(),
    attachments: draft.getUploadedOrSavedAtt().map(function(att) {
      return {
        name: att.getFilename(),
        type: att.getFileType(),
        isImage: att.isImage(),
        url: att.getDownloadUrl()
      };
    }),
    pref: composeView.editor.getDefaultFontInfo(),
    hasQuoted: Boolean(draft.origin.oMsg &&
        composeView.baseNode.one('.compose-quoted-text'))
  });
};


/**
 * @param {YmailType.Draft} draft
 * @return {!boolean}
 */
YmailApi.StormUI.DraftApi.prototype.set = function(draft) {
  var header = this.composeView_.header, node = header.hdr;

  // TODO: can we not use DOM calls to remove recipients?
  goog.isArray(draft.to) &&
      header.removeAllLozenges(node.one(YmailApi.StormUI.Selector.TO));
  goog.isArray(draft.cc) &&
      header.removeAllLozenges(node.one(YmailApi.StormUI.Selector.CC));
  goog.isArray(draft.bcc) &&
      header.removeAllLozenges(node.one(YmailApi.StormUI.Selector.BCC));
  // TODO: fixed Storm to handle empty subject
  goog.isString(draft.subject) &&
      node.one('#subject-field').set('value', draft.subject).simulate('keyup');

  header.setHeader(draft);

  if (goog.isString(draft.body)) {
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
 * @param {YmailType.Draft} draft
 * @return {!goog.async.Deferred.<boolean>}
 */
YmailApi.StormUI.DraftApi.prototype.save = function(draft) {
  var result;
  this.set(draft);
  // in case the draft is being saved by autoSave, before calling our save()
  // be prepared for next set of save events
  do {
    result = this.nextDraftResult_('save');
  } while (result.hasFired());
  this.composeView_.save(); // avoid less reliable handleComposeAction('save')
  return result;
};


/**
 * @param {YmailType.Draft} draft
 * @return {!goog.async.Deferred.<boolean>}
 */
YmailApi.StormUI.DraftApi.prototype.send = function(draft) {
  var result = this.nextDraftResult_('send'); // rely on the next send event
  this.set(draft);
  this.stats.encrypted = draft.stats.encrypted;
  this.composeView_.handleComposeAction('send');
  return result;
};


/**
 * @param {boolean} isExpandQuoted
 * @return {?goog.async.Deferred.<e2e.ext.YmailType.Quoted>}
 */
YmailApi.StormUI.DraftApi.prototype.getQuoted = function(isExpandQuoted) {
  var origin = this.composeView_.draft.origin,
      oMsg = origin.oMsg;
  if (!oMsg) {
    return null;
  }
  if (isExpandQuoted === true) { // must check against true
    var evt = navigator.platform && navigator.platform.indexOf('Mac') !== -1 ?
        {metaKey: true} : {ctrlKey: true};
    evt.keyCode = 65; //a
    evt.type = 'keydown';
    this.main_.triggerEvent.call(this.main_, this.composeView_.baseNode,
        evt, YmailApi.StormUI.Selector.EDITOR);
  }
  if (oMsg.body) {
    return goog.async.Deferred.succeed({
      body: this.composeView_.quotedTextBody || oMsg.body.display,
      from: oMsg.header.from,
      sentDate: oMsg.header.sentDate
    });
  }
  var result = new goog.async.Deferred;
  this.composeView_.once('draftLoaded', function() {
    var oMsg = this.draft.origin.oMsg;
    oMsg && oMsg.body && result.callback(/** @type {YmailType.Quoted} */ ({
      body: this.composeView_.quotedTextBody || oMsg.body.display,
      from: oMsg.header.from,
      sentDate: oMsg.header.sentDate
    }));
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
 * @param {string} action It is either 'save' or 'send'.
 * @return {!goog.async.Deferred.<boolean>}
 * @private
 */
YmailApi.StormUI.DraftApi.prototype.nextDraftResult_ = function(action) {
  action = action === 'send' ? action : 'save';
  var result = new goog.async.Deferred,
      successHandler = this.composeView_.once('compose:' + action + 'Success',
          goog.bind(result.callback, result, true)),
      failureHandler = this.composeView_.once('compose:' + action + 'Failure',
          goog.bind(result.errback, result, new Error(action + 'Failed')));
  return result.addBoth(function() {
    successHandler.detach();
    failureHandler.detach();
  });
};



/**
 * Construct an instance that implements the required autosuggest api calls
 * @param {YmailApi.StormUI} main The main instance
 * @constructor
 */
YmailApi.StormUI.AutoSuggestApi = function(main) {
  this.main_ = main;
  this.Y = main.Y;
  this.apiConfig_ = {
    debounce: 60,
    getWssid: function() {
      return main.NeoConfig.wssid;
    },
    setWssid: function(newId) {
      main.NeoConfig.wssid = newId;
    },
    getAppid: function() {
      return YmailApi.APP_ID;
    },
    xobniBaseURL: main.Y.xobniContacts.Utils.getXobniBaseURL().url
  };

  this.pendingYUI_();
};


/**
 * @param {{from: string, to: Array<string>, query: !string}} args
 * @return {goog.async.Deferred.<!YmailType.Contacts>}
 */
YmailApi.StormUI.AutoSuggestApi.prototype.search = function(args) {
  var result = new goog.async.Deferred,
      errback = goog.bind(result.errback, result);

  this.pendingYUI_().addCallback(function(api) {
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
YmailApi.StormUI.AutoSuggestApi.prototype.pendingYUI_ = function() {
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


/**
 * The extension content script and this stub both run in the same ymail origin
 * @param {!string} url
 * @return {!boolean} Whether the given url belongs to the ymail origin
 */
YmailApi.utils.isSameOrigin = function(url) {
  return (new URL(url)).origin === location.origin;
};


/**
 * Check whether a message is likely having an PGP ASCII blob
 * @param {!string} message
 * @return {!boolean} Whether the message is likely having an PGP ASCII blob
 */
YmailApi.utils.isLikelyPGP = function(message) {
  return goog.isString(message) && message.indexOf('-----BEGIN PGP') !== -1;
};


/**
 * Bootstrap this script as soon as YUI is ready
 */
YmailApi.bootstrap = function() {
  var win = /** @type {{
    yui: YmailApi.StormUI.YUI,
    NeoConfig: YmailApi.StormUI.NeoConfig}} */ (window);

  // this should generally not happen. remove when everyone updated
  if (window.location.href.indexOf('encryptr') !== -1) {
    window.location.replace('https://mail.yahoo.com/');
    return;
  }

  if (win.NeoConfig) { // Storm
    if (win.yui) {
      YmailApi.bootstraped_ = true;
      // dispose the original YmailApi if one existed
      var oldYmeMain = win.YmeMain,
          newYmeMain = new YmailApi.StormUI(win.yui, win.NeoConfig);
      if (oldYmeMain && oldYmeMain.handoverComposeApis) {
        oldYmeMain.handoverComposeApis(newYmeMain);
        // oldYmeMain.handoverReadApis(newYmeMain);
        oldYmeMain.dispose();
      }
      win.YmeMain = newYmeMain;
      return;
    }

    if (!YmailApi.asyncScriptMonitorInstalled_) {
      YmailApi.asyncScriptMonitorInstalled_ = true;
      // every async script load event will trigger yui detection
      [].forEach.call(document.querySelectorAll('script[async]'),
          function(script) {
            script.addEventListener('load', function() {
              win.yui && !YmailApi.bootstraped_ && YmailApi.bootstrap();
            }, false);
          });
    }
  }
};

// bootstrap the stub
YmailApi.bootstrap();

});  // goog.scope
