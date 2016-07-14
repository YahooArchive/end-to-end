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
 * @fileoverview Provides a message API using HTML5 Message Channel
 */

goog.provide('e2e.ext.MessageApi');
goog.provide('e2e.ext.MessageApi.Request');
goog.provide('e2e.ext.MessageApi.Response');

goog.require('e2e.ext.utils.CallbacksMap');
goog.require('goog.async.Deferred');
goog.require('goog.disposable.IDisposable');
goog.require('goog.structs.Map');

goog.scope(function() {
var ext = e2e.ext;



/**
 * The message API that makes use of Message Channel
 * @param {string} id The id for bootstraping the message channel.
 * @constructor
 * @implements {goog.disposable.IDisposable}
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
 * Constructor for a timeout error.
 * @param {string} message The error message.
 * @constructor
 * @extends {Error}
 */
ext.MessageApi.TimeoutError = function(message) {
  goog.base(this, message);
  this.message = message;
};
goog.inherits(ext.MessageApi.TimeoutError, Error);


/**
 * Message API request.
 * @typedef {{id:string,call:string,args}}
 */
ext.MessageApi.Request;


/**
 * Message API response.
 * @typedef {{result:*,error:string,requestId:string}}
 */
ext.MessageApi.Response;


/**
 * Timeout for requests sent to Message API connectors (in ms).
 * @type {number}
 * @const
 */
ext.MessageApi.REQUEST_TIMEOUT = 30000;


/**
 * Timeout for the bootstrap handler in the client to respond (in ms).
 * @type {number}
 * @const
 */
ext.MessageApi.BOOTSTRAP_TIMEOUT = 5000;


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
      this.timeoutHandler_ && window.clearTimeout(this.timeoutHandler_);
      if (msgEvent.target) {
        this.port_ = msgEvent.target;
        this.port_.addEventListener('message',
            goog.bind(this.processMessage_, this));
        onReadyCallback();
      } else {
        onReadyCallback(
            new ext.MessageApi.TimeoutError('MessageAPI Connection Timeout'));
      }
    }
  }, this);

  channel.port1.addEventListener('message', initChannelListener, false);
  channel.port1.start();
  try {
    messageTarget.postMessage({
      api: this.name_,
      version: this.version_
    }, messageTargetOrigin, [channel.port2]);
  } catch (err) {
    // postMessage fails if messageTarget is missing, or origin is mismatched
    onReadyCallback(err);
  }

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
  this.timeoutHandler_ = setTimeout(
      goog.bind(initChannelListener, this, timeoutEvent),
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
      this.timeoutHandler_ && window.clearTimeout(this.timeoutHandler_);

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
        onReadyCallback(e.timeout ?
            new ext.MessageApi.TimeoutError('MessageAPI Connection Timeout') :
            new Error('no HTML5 MessageChannel support'));
      }
    }
  }, this);

  // Set a timeout for a function that would simulate an 'api not available'
  // response. If the response was processed before the timeout,
  // initChannelListener will just silently bail out.
  this.timeoutHandler_ = setTimeout(goog.bind(function() {
    // disable origin check during timeout
    originCheckCallback = function() {return true;};
    initChannelListener({
      data: {
        api: this.name_,
        version: this.version_
      },
      timeout: true,
      ports: null
    });

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
  var callbacks;
  try {
    callbacks = this.pendingCallbacks_.getAndRemove(response.requestId);
    if (response.hasOwnProperty('timeout')) {
      !this.isDisposed() &&
          callbacks.errback(new ext.MessageApi.TimeoutError(response.error));
    } else if (response.hasOwnProperty('error')) {
      callbacks.errback(new Error(response.error));
    } else {
      callbacks.callback(response.result);
    }
    return true;
  } catch (e) {
    callbacks && callbacks.errback(e);
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
 * A shorthand to set a handler for a particular call. Note that each call can
 * take only one handler
 * @param {string} call Name of the Message API function to listen on.
 * @param {function(?):*} callback
 * @return {ext.MessageApi} this
 */
ext.MessageApi.prototype.setRequestHandler = function(call, callback) {
  this.requestHandler_.set(call, callback);
  return this;
};


/**
 * Handles an incoming API request.
 * @param  {MessagePort} port Port to send the response to.
 * @param  {ext.MessageApi.Request} request Incoming request.
 * @private
 */
ext.MessageApi.prototype.handleRequest_ = function(port, request) {
  if (request.id && request.call) {
    var result, callback = this.requestHandler_.get(request.call),
        sendResponse_ = goog.bind(this.sendResponse_, this, request.id);
    try {
      if (!callback) {
        throw new Error('MessageAPI Unsupported call: ' + request.call);
      }

      result = callback(request.args);
      result instanceof goog.async.Deferred ?
          result.addCallbacks(sendResponse_, sendResponse_) :
          sendResponse_(result);

    } catch (error) {
      sendResponse_(error);
    }
  }
};


/**
 * Sends a response to a remotely-initiated request.
 * @param {string} requestId The request ID.
 * @param {*} response Response.
 * @private
 */
ext.MessageApi.prototype.sendResponse_ = function(requestId, response) {
  var message = {requestId: requestId};
  if (response instanceof Error) {
    message.error = response.message;
    // print the error and stack before it is sent as response
    console.error(response);
  } else {
    message.result = response;
  }
  this.port_.postMessage(message);
};


/**
 * Creates and sends the request to the remote API port.
 * @param {string} call Name of the Message API function to call.
 * @param {function(...)} callback The callback where the result should be
 *     passed.
 * @param {function(Error)} errback The function to be called upon error.
 * @param {*=} opt_args The arguments to pass to the Message API.
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
      error: 'Timeout occurred while processing the request: ' + call,
      requestId: requestId,
      timeout: true
    }
  };
  // Set a timeout for a function that would simulate an error response.
  // If the response was processed before the timeout, processMessage_
  // will just silently bail out.
  setTimeout(goog.bind(this.processMessage_, this, timeoutEvent),
      ext.MessageApi.REQUEST_TIMEOUT);
  port.postMessage(request);
};


/**
 * A shorthand to {@link #sendRequest} that uses {@link goog.async.Deferred}
 * @param {string} call Name of the Message API function to call.
 * @param {*=} opt_args The arguments to pass to the Message API.
 * @return {!goog.async.Deferred} The deferred result
 */
ext.MessageApi.prototype.req = function(call, opt_args) {
  var result = new goog.async.Deferred;
  this.sendRequest(call,
      goog.bind(result.callback, result),
      goog.bind(result.errback, result),
      opt_args);
  return result;
};


/**
 * Disposes of the object and its resources.
 * @return {void} Nothing.
 * @override
 */
ext.MessageApi.prototype.dispose = function() {
  this.port_ && this.port_.close();
  this.disposed_ = true;
};


/**
 * @return {boolean} Whether the object has been disposed of.
 * @override
 */
ext.MessageApi.prototype.isDisposed = function() {
  return Boolean(this.disposed_);
};

});  // goog.scope
