/**
 * @license
 * Copyright 206 Yahoo Inc. All rights reserved.
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
 * @fileoverview Provides a message API using HTML5 Message Channel
 */

goog.provide('e2e.ext.MessageApi');
goog.provide('e2e.ext.MessageApi.Request');
goog.provide('e2e.ext.MessageApi.Response');

goog.require('e2e.ext.utils.CallbacksMap');
goog.require('goog.object');

goog.scope(function() {
var ext = e2e.ext;



/**
 * @param {string} id The id for bootstraping the message channel.
 * @constructor
 */
ext.MessageApi = function(id) {
  /**
   * The API name to be used in the bootstraping message
   * @type {!string}
   * @private
   */
  this.name_ = id || 'e2e-yinit';

  /**
   * Object storing response callbacks for API calls in progress
   * @type {!e2e.ext.utils.CallbacksMap}
   * @private
   */
  this.pendingCallbacks_ = new e2e.ext.utils.CallbacksMap();
  /**
   * Map for storing the request handler, which maps request call to a callback
   * function that takes args and whatever returned will be passed to
   * sendResponse.
   * @type {!goog.structs.Map<string, function(*):*>}
   * @private
   */
  this.requestHandler_ = new goog.structs.Map();
  /**
   * The API version to be used in the bootstraping message
   * @type {!number}
   * @private
   */
  this.version_ = 1;
};


/**
 * Message API request.
 * @typedef {{id:string,call:string,args}}
 */
ext.MessageApi.Request;


/**
 * Message API response.
 * @typedef {{result:*,error:*,requestId:string}}
 */
ext.MessageApi.Response;


/**
 * Timeout for requests sent to Message API connectors (in ms).
 * @type {number}
 * @const
 */
ext.MessageApi.REQUEST_TIMEOUT = 10000;


/**
 * Timeout for the bootstrap handler in the client to respond (in ms).
 * @type {number}
 * @const
 */
ext.MessageApi.BOOTSTRAP_TIMEOUT = 1500;


/**
 * Bootstraps the MessageChannel between the client and this object.
 * @param {Object} messageTarget The target window object for messaging.
 * @param {string} messageTargetOrigin The origin of the target window.
 * @param {function(Error=)} onReadyCallback Callback to run when the two-way
 *     communication is established.
 */
ext.MessageApi.prototype.bootstrapServer = function(
    messageTarget, messageTargetOrigin, onReadyCallback) {
  // Code in the bootstrapClient() will phone home by connecting to a port sent
  // in a bootstrap postMessage.
  // In case the extension is restarted within document lifetime, the old port
  // will cease to work and the new object will start a new channel.
  if (!goog.global.MessageChannel) {
    onReadyCallback(new Error('no HTML5 MessageChannel support'));
    return;
  }
  var channel = new MessageChannel();
  var bootstrapReceived = false;
  var initChannelListener = goog.bind(function(msgEvent) {
    if (msgEvent.data.api == this.name_ &&
        msgEvent.data.version == this.version_) {
      channel.port1.removeEventListener('message', initChannelListener);
      if (bootstrapReceived) {
        return;
      }
      bootstrapReceived = true;
      if (msgEvent.target) {
        this.port_ = msgEvent.target;
        this.port_.addEventListener('message',
            goog.bind(this.processMessage_, this));
        onReadyCallback();
      } else {
        onReadyCallback(new Error('Connection Timeout'));
      }
    }
  }, this);

  channel.port1.addEventListener('message', initChannelListener, false);
  channel.port1.start();
  messageTarget.postMessage({
    api: this.name_,
    version: this.version_
  }, messageTargetOrigin, [channel.port2]);

  // Set a timeout for a function that would simulate an 'api not available'
  // response. If the response was processed before the timeout,
  // initChannelListener will just silently bail out.
  var timeoutEvent = {
    data: {
      api: this.name_,
      version: this.version_
    },
    target: null,
    timeout: true
  };
  setTimeout(goog.bind(initChannelListener, this, timeoutEvent),
      ext.MessageApi.BOOTSTRAP_TIMEOUT);
};


/**
 * Handles the bootstrap message coming from bootstrapServer
 * @param {function(string):boolean} originCheckCallback Callback to validate
 *     against the bootstrap message origin.
 * @param {function((!string|Error))} onReadyCallback Callback to run when a
 *     bootstrap message is received, passing the origin as a parameter
 */
ext.MessageApi.prototype.bootstrapClient = function(
    originCheckCallback, onReadyCallback) {
  var initChannelListener = goog.bind(function(e) {
    if (originCheckCallback(e.origin) &&
        e.data.api == this.name_ &&
        e.data.version == this.version_) {
      window.removeEventListener('message', initChannelListener);

      if (e.ports && e.ports.length == 1) {
        this.port_ = e.ports[0];
        this.port_.addEventListener('message',
            goog.bind(this.processMessage_, this), false);
        this.port_.start();
        this.port_.postMessage({
          api: this.name_,
          version: this.version_
        });
        onReadyCallback(e.origin);
      } else {
        onReadyCallback(new Error(e.timeout ?
            'Connection Timeout' :
            'no HTML5 MessageChannel support'));
      }
    }
  }, this);

  // Set a timeout for a function that would simulate an 'api not available'
  // response. If the response was processed before the timeout,
  // initChannelListener will just silently bail out.
  var timeoutEvent = {
    data: {
      api: this.name_,
      version: this.version_
    },
    timeout: true,
    ports: null
  };

  setTimeout(goog.bind(function() {
    // disable origin check during timeout
    originCheckCallback = function() {return true;};
    goog.bind(initChannelListener, this, timeoutEvent);
  }, this), ext.MessageApi.BOOTSTRAP_TIMEOUT);

  window.addEventListener('message', initChannelListener, false);
};


/**
 * Processes messages.
 * @param  {MessageEvent} event Event sent over MessageChannel
 * @private
 * @return {boolean} True if message was a response matching a request.
 */
ext.MessageApi.prototype.processMessage_ = function(event) {
  if (event.data.requestId) {
    // It's a response to locally-initiated Message API request
    var response =
        /** @type {ext.MessageApi.Response} */ (event.data);
    return this.processResponse_(response);
  } else if (event.data.id) {
    // It's remotely-initiated
    var request =
        /** @type {ext.MessageApi.Request} */ (event.data);
    this.handleRequest_(/** @type {MessagePort} */ (event.target),
        request);
    return false;
  } else {
    return false;
  }
};


/**
 * Processes an incoming response for a locally-initiated Message API request.
 * @param {ext.MessageApi.Response} response API response.
 * @return {boolean} True if message was a response matching a request.
 * @private
 */
ext.MessageApi.prototype.processResponse_ = function(response) {
  try {
    var callbacks = this.pendingCallbacks_.getAndRemove(response.requestId);
    if (goog.object.containsKey(response, 'error')) {
      callbacks.errback(new Error(response.error));
    } else {
      callbacks.callback(response.result);
    }
    return true;
  } catch (e) {
    return false;
  }
};


/**
 * Expose the map for request handler, which maps request call to a callback
 * function that takes args and whatever returned will be passed to
 * sendResponse.
 * @return {!goog.structs.Map<string, function(*):*>} 
 */
ext.MessageApi.prototype.getRequestHandler = function() {
  return this.requestHandler_;
};


/**
 * Handles an incoming API request.
 * @param  {MessagePort} port Port to send the response to.
 * @param  {ext.MessageApi.Request} request Incoming request.
 * @private
 */
ext.MessageApi.prototype.handleRequest_ = function(port, request) {
  if (request.id && request.call) {
    var callback = this.requestHandler_.get(request.call);
    try {
      return this.sendResponse_(request.id,
          callback ? callback(request.args) : new Error('unsupported API call'));
    } catch (ex) {
      return this.sendResponse_(request.id, ex);
    }
  }
};


/**
 * Sends a response to a remotely-initiated request.
 * @param  {string} requestId The request ID.
 * @param  {*} response Response.
 * @private
 */
ext.MessageApi.prototype.sendResponse_ = function(requestId, response) {
  this.port_.postMessage(response instanceof Error ? {
    error: response.message,
    result: null,
    requestId: requestId
  } : {
    result: response,
    requestId: requestId
  });
};


/**
 * Creates and sends the request to the remote API port.
 * @param {string} call Name of the Message API function to call.
 * @param {function(...)} callback The callback where the result should be
 *     passed.
 * @param {function(Error)} errback The function to be called upon error.
 * @param {Object=} opt_args The arguments to pass to the Message API.
 */
ext.MessageApi.prototype.sendRequest = function(call, callback,
    errback, opt_args) {
  var requestId;
  var port = this.port_;
  if (!port) {
    errback(new Error('Port is not available!'));
    return;
  }

  requestId = this.pendingCallbacks_.addCallbacks(callback, errback);
  var request = {
    id: requestId,
    call: call,
    args: opt_args || {}
  };
  var timeoutEvent = {
    data: {
      error: 'Timeout occurred while processing the request.',
      requestId: requestId
    }
  };
  // Set a timeout for a function that would simulate an error response.
  // If the response was processed before the timeout, processMessage_
  // will just silently bail out.
  setTimeout(goog.bind(this.processMessage_, this, timeoutEvent),
      ext.MessageApi.REQUEST_TIMEOUT);
  port.postMessage(request);
};


});  // goog.scope
