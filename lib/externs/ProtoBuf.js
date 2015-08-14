/*
 * Copyright 2012 The Closure Compiler Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Externs for dcodeIO.ProtoBuf.js.
 * @see https://github.com/dcodeIO/dcodeIO.ProtoBuf.js
 * @externs
 */

/**
 BEGIN_NODE_INCLUDE
 var dcodeIO.ProtoBuf = require('protobufjs');
 END_NODE_INCLUDE
 */

/**
 * {@type Object}
 */
var dcodeIO = {};

/**
 * {@type Object}
 */
dcodeIO.ProtoBuf = {};

/**
 * @type {string}
 * @const
 */
dcodeIO.ProtoBuf.VERSION;

/**
 * @type {!Object.<string,number>}
 * @const
 */
dcodeIO.ProtoBuf.WIRE_TYPES = {};

/**
 * @type {number}
 * @const
 */
dcodeIO.ProtoBuf.WIRE_TYPES.VARINT;

/**
 * @type {number}
 * @const
 */
dcodeIO.ProtoBuf.WIRE_TYPES.BITS64;

/**
 * @type {number}
 * @const
 */
dcodeIO.ProtoBuf.WIRE_TYPES.LDELIM;

/**
 * @type {number}
 * @const
 */
dcodeIO.ProtoBuf.WIRE_TYPES.STARTGROUP;

/**
 * @type {number}
 * @const
 */
dcodeIO.ProtoBuf.WIRE_TYPES.ENDGROUP;

/**
 * @type {number}
 * @const
 */
dcodeIO.ProtoBuf.WIRE_TYPES.BITS32;

/**
 * @type {!Array.<number>}
 * @const
 */
dcodeIO.ProtoBuf.PACKABLE_WIRE_TYPES;

/**
 * @type {boolean}
 */
dcodeIO.ProtoBuf.convertFieldsToCamelCase;

/**
 * @type {boolean}
 */
dcodeIO.ProtoBuf.populateAccessors;

/**
 * @dict
 * @type {!Object.<string,{name: string, wireType: number}>}
 * @const
 */
dcodeIO.ProtoBuf.TYPES;

/**
 * @type {number}
 */
dcodeIO.ProtoBuf.ID_MIN;

/**
 * @type {number}
 */
dcodeIO.ProtoBuf.ID_MAX;

/**
 * @type {!function(new: ByteBuffer, ...Array)}
 */
dcodeIO.ProtoBuf.ByteBuffer;

/**
 * @type {?function(new: Long, ...Array)}
 */
dcodeIO.ProtoBuf.Long;

/**
 * @type {!Object.<string,string|RegExp>}
 */
dcodeIO.ProtoBuf.Lang;

/**
 * @type {!Object.<string,function()>}
 */
dcodeIO.ProtoBuf.DotProto;

/**
 * @param {string} proto
 * @constructor
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer = function(proto) {};

/**
 * @type {string}
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.source;

/**
 * @type {number}
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.index;

/**
 * @type {number}
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.line;

/**
 * @type {Array.<string>}
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.stack;

/**
 * @type {boolean}
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.readingString;

/**
 * @return {?string}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.next = function() {};

/**
 * @return {?string}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.peek = function() {};

/**
 * @return {string}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.DotProto.Tokenizer.prototype.toString = function() {};

/**
 * @param {string} proto
 * @constructor
 */
dcodeIO.ProtoBuf.DotProto.Parser = function(proto) {};

/**
 * @type {!dcodeIO.ProtoBuf.DotProto.Tokenizer}
 */
dcodeIO.ProtoBuf.DotProto.Parser.prototype.tn;

/**
 * @return {{package: (string|null), messages: Array.<Object>, enums: Array.<Object>, imports: Array.<string>, options: Object.<string,*>}}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.DotProto.Parser.prototype.parse = function() {};

/**
 * @return {string}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.DotProto.Parser.prototype.toString = function() {};

/**
 * @type {Object.<string,function()>}
 */
dcodeIO.ProtoBuf.Reflect.Reflect = {};

/**
 * @constructor
 * @param {dcodeIO.ProtoBuf.Reflect.T} parent
 * @param {string} name Object name
 */
dcodeIO.ProtoBuf.Reflect.T = function(parent, name) {};

/**
 * @type {?dcodeIO.ProtoBuf.Reflect.T}
 */
dcodeIO.ProtoBuf.Reflect.T.prototype.parent;

/**
 * @type {string}
 */
dcodeIO.ProtoBuf.Reflect.T.prototype.name;

/**
 * @returns {string}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.T.prototype.fqn = function() {};

/**
 * @param {boolean=} includeClass
 * @returns {string}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.T.prototype.toString = function(includeClass) {};

/**
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.T.prototype.build = function() {};

/**
 * @param {?dcodeIO.ProtoBuf.Reflect.Namespace} parent
 * @param {string} name
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.T
 */
dcodeIO.ProtoBuf.Reflect.Namespace = function(parent, name) {};

/**
 * @type {Array.<dcodeIO.ProtoBuf.Reflect.T>}
 */
dcodeIO.ProtoBuf.Reflect.Namespace.prototype.children;

/**
 * @param {dcodeIO.ProtoBuf.Reflect.T=} type
 * @return {Array.<dcodeIO.ProtoBuf.Reflect.T>}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.Namespace.prototype.getChildren = function(type) {};

/**
 * @param {dcodeIO.ProtoBuf.Reflect.T} child
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Namespace.prototype.addChild = function(child) {};

/**
 * @param {string|number} nameOrId
 * @returns {boolean}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.Namespace.prototype.hasChild = function(nameOrId) {};

/**
 * @param {string|number} nameOrId
 * @return {?dcodeIO.ProtoBuf.Reflect.T}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.Namespace.prototype.getChild = function(nameOrId) {};

/**
 * @param {string} qn
 * @param {boolean=} excludeFields
 * @return {?dcodeIO.ProtoBuf.Reflect.Namespace}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.Namespace.prototype.resolve = function(qn, excludeFields) {};

/**
 * @return {Object.<string,Function|Object>}
 */
dcodeIO.ProtoBuf.Reflect.Namespace.prototype.build = function() {};

/**
 * @param {!dcodeIO.ProtoBuf.Reflect.Namespace} parent
 * @param {string} name
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.Namespace
 */
dcodeIO.ProtoBuf.Reflect.Message = function(parent, name) {};

/**
 * @type {?Array.<number>}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.extensions;

/**
 * @type {?dcodeIO.ProtoBuf.Builder.Message}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.clazz;

/**
 * @return {!dcodeIO.ProtoBuf.Builder.Message}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.build = function() {};

/**
 * @param {!dcodeIO.ProtoBuf.Builder.Message} message
 * @param {!ByteBuffer} buffer
 * @return {!ByteBuffer}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.encode = function(message, buffer) {};

/**
 * @param {!dcodeIO.ProtoBuf.Builder.Message} message
 * @return {number}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.calculate = function(message) {};

/**
 * @param {!dcodeIO.ProtoBuf.Builder.Message} message
 * @param {!ByteBuffer} buffer
 * @return {!ByteBuffer}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.encodeDelimited = function(message, buffer) {};

/**
 * @param {!ByteBuffer} buffer
 * @param {number=} length
 * @return {!dcodeIO.ProtoBuf.Builder.Message}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.decode = function(buffer, length) {};

/**
 * @param {!ByteBuffer} buffer
 * @param {number=} length
 * @return {!dcodeIO.ProtoBuf.Builder.Message}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.prototype.decodeDelimited = function(buffer, length) {};

/**
 * @param {!dcodeIO.ProtoBuf.Reflect.Message} message
 * @param {string} rule
 * @param {string} type
 * @param {string} name
 * @param {number} id
 * @param {Object.<string,*>=} options
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.T
 */
dcodeIO.ProtoBuf.Reflect.Message.Field = function(message, rule, type, name, id, options) {};

/**
 * @type {boolean}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.required;

/**
 * @type {boolean}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.repeated;

/**
 * @type {string|{name: string, wireType: number}}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.type;

/**
 * @type {number}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.id;

/**
 * @type {!Object.<string,*>}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.options;

/**
 * @type {?dcodeIO.ProtoBuf.Reflect.T}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.resolvedType;

/**
 * @type {string}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.originalName;

/**
 * @param {*} value
 * @param {boolean=} skipRepeated
 * @return {*}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.verifyValue = function(value, skipRepeated) {};

/**
 * @param {*} value
 * @param {!ByteBuffer} buffer
 * @return {!ByteBuffer}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.encode = function(value, buffer) {};

/**
 * @param {*} value
 * @return {number}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.calculate = function(value) {};

/**
 * @param {number} wireType
 * @param {!ByteBuffer} buffer
 * @return {*}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.decode = function(wireType, buffer) {};

/**
 * @param {*} value
 * @param {!ByteBuffer} buffer
 * @return {!ByteBuffer}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Message.Field.prototype.encodeValue = function(value, buffer) {};

/**
 * @param {!dcodeIO.ProtoBuf.Reflect.T} parent
 * @param {string} name
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.Namespace
 */
dcodeIO.ProtoBuf.Reflect.Enum = function(parent, name) {};

/**
 * @return {Object<string,*>}
 */
dcodeIO.ProtoBuf.Reflect.Enum.prototype.build = function() {};

/**
 * @type {?Object.<string,number>}
 */
dcodeIO.ProtoBuf.Reflect.Enum.prototype.Object;

/**
 * @param {!dcodeIO.ProtoBuf.Reflect.Enum} enm
 * @param {string} name
 * @param {number} id 
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.T
 */
dcodeIO.ProtoBuf.Reflect.Enum.Value = function(enm, name, id) {};

/**
 * @type {number}
 */
dcodeIO.ProtoBuf.Reflect.Enum.Value.prototype.id;

/**
 * @param {!dcodeIO.ProtoBuf.Reflect.Namespace} root
 * @param {string} name Service name
 * @param {Object.<string,*>=} options
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.Namespace
 */
dcodeIO.ProtoBuf.Reflect.Service = function(root, name, options) {};

/**
 * @type {dcodeIO.ProtoBuf.Builder.Service}
 */
dcodeIO.ProtoBuf.Reflect.Service.prototype.clazz;

/**
 * @return {!dcodeIO.ProtoBuf.Builder.Service}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Reflect.Service.prototype.build = function() {};

/**
 * @param {!dcodeIO.ProtoBuf.Reflect.Service} svc
 * @param {string} name
 * @param {Object.<string,*>=} options
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.T
 */
dcodeIO.ProtoBuf.Reflect.Service.Method = function(svc, name, options) {};

/**
 * @return {Object.<string,*>}
 */
dcodeIO.ProtoBuf.Reflect.Service.Method.prototype.buildOpt = function() {};

/**
 * @param {!dcodeIO.ProtoBuf.Reflect.Service} svc
 * @param {string} name
 * @param {string} request
 * @param {string} response
 * @param {Object.<string,*>=} options
 * @constructor
 * @extends dcodeIO.ProtoBuf.Reflect.Service.Method
 */
dcodeIO.ProtoBuf.Reflect.Service.RPCMethod = function(svc, name, request, response, options) {};

/**
 * @type {string}
 */
dcodeIO.ProtoBuf.Reflect.Service.RPCMethod.prototype.requestName;

/**
 * @type {string}
 */
dcodeIO.ProtoBuf.Reflect.Service.RPCMethod.prototype.responseName;

/**
 * @type {dcodeIO.ProtoBuf.Reflect.Message}
 */
dcodeIO.ProtoBuf.Reflect.Service.RPCMethod.prototype.resolvedRequestType;

/**
 * @type {dcodeIO.ProtoBuf.Reflect.Message}
 */
dcodeIO.ProtoBuf.Reflect.Service.RPCMethod.prototype.resolvedResponseType;

/**
 * @constructor
 */
dcodeIO.ProtoBuf.Builder = function() {};

/**
 * @type {!dcodeIO.ProtoBuf.Reflect.Namespace}
 */
dcodeIO.ProtoBuf.Builder.prototype.ns;

/**
 * @type {?dcodeIO.ProtoBuf.Reflect.T}
 */
dcodeIO.ProtoBuf.Builder.prototype.ptr;

/**
 * @type {boolean}
 */
dcodeIO.ProtoBuf.Builder.prototype.resolved;

/**
 * @type {Object.<string,dcodeIO.ProtoBuf.Builder.Message|Object>|null}
 */
dcodeIO.ProtoBuf.Builder.prototype.result;

/**
 * @type {Array.<string>}
 */
dcodeIO.ProtoBuf.Builder.prototype.files;

/**
 * @type {?string}
 */
dcodeIO.ProtoBuf.Builder.prototype.importRoot;

/**
 */
dcodeIO.ProtoBuf.Builder.prototype.reset = function() {};

/**
 * @param {string} pkg
 * @return {!dcodeIO.ProtoBuf.Builder}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.prototype.define = function(pkg) {};

/**
 * @param {Object.<string,*>} def
 * @return {boolean}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.isValidMessage = function(def) {};

/**
 * @param {Object.<string,*>} def
 * @return {boolean}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.isValidMessageField = function(def) {};

/**
 * @param {Object.<string,*>} def
 * @return {boolean}
 */
dcodeIO.ProtoBuf.Builder.isValidEnum = function(def) {};

/**
 * @param {Object.<string,*>} def
 * @return {boolean}
 */
dcodeIO.ProtoBuf.Builder.isValidService = function(def) {};

/**
 * @param {Object.<string,*>} def
 * @return {boolean}
 */
dcodeIO.ProtoBuf.Builder.isValidExtend = function(def) {};

/**
 * @param {Array.<Object.<string,*>>} messages
 * @return {dcodeIO.ProtoBuf.Builder}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.prototype.create = function(messages) {};

/**
 * @name dcodeIO.ProtoBuf.Builder.prototype.import
 * @function
 * @param {dcodeIO.ProtoBuf.Builder} builder
 * @param {(string|{root: string, file: string})=} filename
 * @return {!dcodeIO.ProtoBuf.Builder}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.prototype["import"] = function(builder, filename) {};

/**
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.prototype.resolveAll = function() {};

/**
 * @param {string=} path
 * @return {dcodeIO.ProtoBuf.Builder.Message|Object.<string,*>}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.prototype.build = function(path) {};

/**
 * @param {string=} path
 * @return {?dcodeIO.ProtoBuf.Reflect.T}
 */
dcodeIO.ProtoBuf.Builder.prototype.lookup = function(path) {};

/**
 * @return {string}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.prototype.toString = function() {};

/**
 * @param {Object.<string,*>} values
 * @constructor
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message = function(values) {};

/**
 * @param {string} key
 * @param {*} value
 * @param {boolean=} noAssert
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.add = function(key, value, noAssert) {};

/**
 * @param {string} key
 * @param {*} value
 * @param {boolean=} noAssert
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.$add = function(key, value, noAssert) {};

/**
 * @param {string} key
 * @param {*} value
 * @param {boolean=} noAssert
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.set = function(key, value, noAssert) {};

/**
 * @param {string} key
 * @param {*} value
 * @param {boolean=} noAssert
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.$set = function(key, value, noAssert) {};

/**
 * @param {string} key
 * @return {*}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.get = function(key) {};

/**
 * @param {string} key
 * @return {*}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.$get = function(key) {};

/**
 * @param {ByteBuffer=} buffer
 * @return {!ByteBuffer}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.encode = function(buffer) {};

/**
 * @return {number}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.calculate = function() {};

/**
 * @return {!ArrayBuffer}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.encodeAB = function() {};

/**
 * @return {!ArrayBuffer}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.toArrayBuffer = function() {};

/**
 * @return {!buffer.Buffer}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.encodeNB = function() {};

/**
 * @return {!buffer.Buffer}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.toBuffer = function() {};

/**
 * @return {string}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.encode64 = function() {};

/**
 * @return {string}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.toBase64 = function() {};

/**
 * @return {string}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.encodeHex = function() {};

/**
 * @return {string}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.toHex = function() {};

/**
 * @param {boolean=} includeBuffers
 * @return {Object.<string,*>}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.toRaw = function(includeBuffers) {};

/**
 * @param {!ByteBuffer|!ArrayBuffer|!buffer.Buffer|string} buffer
 * @param {string=} enc
 * @return {!dcodeIO.ProtoBuf.Builder.Message}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.decode = function(buffer, enc) {};

/**
 * @param {string} str
 * @return {!dcodeIO.ProtoBuf.Builder.Message}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.decode64 = function(str) {};

/**
 * @param {string} str
 * @return {!dcodeIO.ProtoBuf.Builder.Message}
 * @throws {Error}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.decodeHex = function(str) {};

/**
 * @return {string}
 * @nosideeffects
 */
dcodeIO.ProtoBuf.Builder.Message.prototype.toString = function() {};

/**
 * @param {function(string, dcodeIO.ProtoBuf.Builder.Message, function(Error, dcodeIO.ProtoBuf.Builder.Message=))} rpcImpl
 * @constructor
 */
dcodeIO.ProtoBuf.Builder.Service = function(rpcImpl) {};

/**
 * @type {function(string, dcodeIO.ProtoBuf.Builder.Message, function(Error, dcodeIO.ProtoBuf.Builder.Message=))}
 */
dcodeIO.ProtoBuf.Builder.prototype.rpcImpl;

/**
 * @param {string} proto
 * @param {(dcodeIO.ProtoBuf.Builder|string)=} builder
 * @param {(string|{root: string, file: string})=} filename
 * @return {!dcodeIO.ProtoBuf.Builder}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.loadProto = function(proto, builder, filename) {};

/**
 * @param {string} proto
 * @param {(dcodeIO.ProtoBuf.Builder|string|{root: string, file: string})=} builder
 * @param {(string|{root: string, file: string})=} filename
 * @return {!dcodeIO.ProtoBuf.Builder}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.protoFromString = function(proto, builder, filename) {};

/**
 * @param {string|{root: string, file: string}} filename
 * @param {(function(dcodeIO.ProtoBuf.Builder)|dcodeIO.ProtoBuf.Builder)=} callback
 * @param {dcodeIO.ProtoBuf.Builder=} builder
 * @return {dcodeIO.ProtoBuf.Builder|undefined}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.loadProtoFile = function(filename, callback, builder) {};

/**
 * @param {string|{root: string, file: string}} filename
 * @param {(function(dcodeIO.ProtoBuf.Builder)|dcodeIO.ProtoBuf.Builder)=} callback
 * @param {dcodeIO.ProtoBuf.Builder=} builder
 * @return {dcodeIO.ProtoBuf.Builder|undefined}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.protoFromFile = function(filename, callback, builder) {};

/**
 * @param {!*|string} json
 * @param {(dcodeIO.ProtoBuf.Builder|string|{root: string, file: string})=} builder
 * @param {(string|{root: string, file: string})=} filename
 * @return {!dcodeIO.ProtoBuf.Builder}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.loadJson = function(json, builder, filename) {};

/**
 * @param {string|{root: string, file: string}} filename
 * @param {(function(dcodeIO.ProtoBuf.Builder)|dcodeIO.ProtoBuf.Builder)=} callback
 * @param {dcodeIO.ProtoBuf.Builder=} builder
 * @return {dcodeIO.ProtoBuf.Builder|undefined}
 * @throws {Error}
 */
dcodeIO.ProtoBuf.loadJsonFile = function(filename, callback, builder) {};

/**
 * @param {string=} pkg
 * @return {!dcodeIO.ProtoBuf.Builder}
 */
dcodeIO.ProtoBuf.newBuilder = function(pkg) {};

dcodeIO.ProtoBuf.Util = {};

/**
 * @type {boolean}
 */
dcodeIO.ProtoBuf.Util.IS_NODE;

/**
 * @return {XMLHttpRequest}
 */
dcodeIO.ProtoBuf.Util.XHR = function() {};

/**
 * @param {string} path
 * @param {function(?string)=} callback
 * @return {?string|undefined}
 */
dcodeIO.ProtoBuf.Util.fetch = function(path, callback) {};

/**
 * @param {*} obj
 * @return {boolean}
 */
dcodeIO.ProtoBuf.Util.isArray = function(obj) {};
