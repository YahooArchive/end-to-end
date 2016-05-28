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
 * @fileoverview Data Types usable in Yahoo Mail
 */

goog.provide('e2e.ext.YmailData');


/**
 * The contacts structure
 * @typedef {!Array.<{
 *   email: !string,
 *   name: (string|undefined),
 *   imageUrl: !string
 * }>}
 */
e2e.ext.YmailData.Contacts;


/**
 * The email user structure
 * @typedef {{name: (string|undefined), email: string}}
 */
e2e.ext.YmailData.EmailUser;


/**
 * The attachment structure
 * @typedef {{downloadUrl: string, type: string, subtype: string}}
 */
e2e.ext.YmailData.Attachment;


/**
 * The draft structure
 * @typedef {{
 *   from: e2e.ext.YmailData.EmailUser,
 *   to: !Array.<e2e.ext.YmailData.EmailUser>,
 *   cc: !Array.<e2e.ext.YmailData.EmailUser>,
 *   bcc: !Array.<e2e.ext.YmailData.EmailUser>,
 *   subject: !string,
 *   body: !string,
 *   attachments: !Array.<e2e.ext.YmailData.Attachment>,
 *   hasQuoted: !boolean,
 *   isInConv: !boolean,
 *   glassClosing: boolean,
 *   stats: e2e.ext.YmailData.SendStats
 * }}
 */
e2e.ext.YmailData.Draft;


/**
 * The detail object defined in the openCompose Event
 * @typedef {{
 *   apiId: !string,
 *   isEncryptedDraft: !boolean
 * }}
 */
e2e.ext.YmailData.OpenComposeDetail;


/**
 * The detail object defined in the openMessage Event
 * @typedef {{
 *   body: !string,
 *   quotedBody: !string,
 *   meta: *
 * }}
 */
e2e.ext.YmailData.OpenMessageDetail;


/**
 * The stats structure for sending an email
 * @typedef {{
 *   encrypted: (undefined|number),
 *   canEncrypt: (undefined|number)
 * }}
 */
e2e.ext.YmailData.SendStats;