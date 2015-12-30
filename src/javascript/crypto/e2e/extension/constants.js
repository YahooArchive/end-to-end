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
 * @fileoverview Provides constants used throughout the End-To-End extension.
 */

goog.provide('e2e.ext.constants');
goog.provide('e2e.ext.constants.Actions');
goog.provide('e2e.ext.constants.BackupCode');
goog.provide('e2e.ext.constants.CssClass');
goog.provide('e2e.ext.constants.ElementId');
goog.provide('e2e.ext.constants.Keyserver');
goog.provide('e2e.ext.constants.StorageKey');
goog.provide('e2e.ext.constants.e2ebind.requestActions');
goog.provide('e2e.ext.constants.e2ebind.responseActions');

goog.require('e2e.ext.config');

/**
 * The actions that the End-To-End extension can perform.
 * @enum {string}
 */
e2e.ext.constants.Actions = {
  // Encryption/signing related actions.
  ENCRYPT_ONLY: 'encrypt_only',
  SIGN_ONLY: 'sign_only',
  ENCRYPT_SIGN: 'encrypt_sign',

  // Decryption/verification related actions.
  DECRYPT_VERIFY: 'decrypt_verify',

  // Keyring management related actions.
  GET_KEY_DESCRIPTION: 'get_key_description',
  GET_PASSPHRASE: 'get_passphrase',
  GET_KEYRING_BACKUP_DATA: 'get_keyring_backup_data',
  RESTORE_KEYRING_DATA: 'restore_keyring_data',
  IMPORT_KEY: 'import_key',
  SHARE_KEY: 'share_key',
  LIST_KEYS: 'list_keys',
  LIST_ALL_UIDS: 'list_all_uids',
  GET_KEYRING_UNLOCKED: 'get_keyring_unlocked',
  LOCK_KEYRING: 'lock_keyring',

  // Actions needed for the glasses.
  SHOW_NOTIFICATION: 'show_notification',
  GLASS_CLOSED: 'glass_closed',
  SET_DRAFT: 'set_draft',
  SET_AND_SEND_DRAFT: 'set_and_send_draft',
  GET_SELECTED_CONTENT: 'get_selected_content',
  OPEN_OPTIONS: 'open_options',
  CHANGE_PAGEACTION: 'change_pageaction',
  RESET_PAGEACTION: 'reset_pageaction',
  SET_GLASS_SIZE: 'set_glass_size',

  // Intended no-op. Used for closing the prompt UI when other visual elements
  // (e.g. looking glass) would display data.
  NO_OP: 'no_op',

  // Administration related actions.
  CONFIGURE_EXTENSION: 'configure_extension',

  // Default catch-all action.
  USER_SPECIFIED: 'user_specified'
};


/**
 * The element IDs used throughout the extension.
 * @enum {string}
 */
e2e.ext.constants.ElementId = {
  HEADER: 'pgpHead',
  BODY: 'pgpBody',
  TITLE: 'pgpTitle',
  MAIN_FORM: 'pgpMain',
  KEY_SELECT_FORM: 'pgpKeySelect',
  GENERATE_KEY_FORM: 'pgpGenerateKey',
  PREFERENCES: 'pgpPreferences',
  SIGN_MESSAGE_CHECK: 'pgpSignMessage',
  SIGNER_SELECT: 'pgpSignerSelect',
  KEYRING_DIV: 'storedKeys',
  KEYRING_IMPORT_DIV: 'keyringImportDiv',
  FB_IMPORT_DIV: 'fbImportDiv',
  KEYRING_OPTIONS_DIV: 'keyringOptionsDiv',
  KEYRING_PASSPHRASE_CHANGE_DIV: 'keyringPassphraseChangeDiv',
  KEYRING_PASSPHRASE_CONFIRM_DIV: 'keyringPassphraseConfirmDiv',
  ERROR_DIV: 'errorDiv',
  CALLBACK_DIALOG: 'callbackDialog',
  CHIP_HOLDER: 'chipHolder',
  PASSPHRASE_ENCRYPTION_LINK: 'passphraseEncryptionLink',
  FROM_HOLDER: 'fromHolder',
  FROM_LABEL: 'fromLabel',
  TO_LABEL: 'toLabel',
  SUBJECT_HOLDER: 'subjectHolder',

  /* Used to display menus in the UI. */
  MENU_CONTAINER: 'menu-container',

  // Welcome page
  WELCOME_BODY: 'welcome-main',
  WELCOME_MENU: 'welcome-menu',
  WELCOME_MENU_BASICS: 'welcome-menu-basics',
  WELCOME_MENU_NOVICE: 'welcome-menu-novice',
  WELCOME_MENU_ADVANCED: 'welcome-menu-advanced',
  WELCOME_MENU_INTRO: 'welcome-menu-intro',
  WELCOME_CONTENT_TUTORIAL: 'welcome-content-tutorial',
  WELCOME_CONTENT_NOVICE: 'welcome-content-novice',
  WELCOME_CONTENT_ADVANCED: 'welcome-content-advanced',
  WELCOME_CONTENT_INTRO: 'welcome-content-intro',
  WELCOME_CONTENT_BACKUP: 'welcome-content-backup',
  WELCOME_CONTENT_PASSPHRASE: 'welcome-content-passphrase',
  WELCOME_CONTENT_PASSPHRASE_TUTORIAL: 'welcome-content-passphrase-tutorial',
  WELCOME_FOOTER: 'welcome-footer',
  WELCOME_FRAME: 'welcome-frame',
  WELCOME_FRAME_ELEMENT: 'welcome-frame-element',
  WELCOME_FRAME_DUMMY: 'welcome-frame-dummy',

  // Setup page
  SETUP_BUTTON: 'setup-button',
  SETUP_GENERATE_KEY: 'setup-generate-key',
  SETUP_RESTORE_KEY: 'setup-restore-key',
  SETUP_BACKUP_KEY: 'setup-backup-key',
  SETUP_PASSPHRASE: 'setup-passphrase',
  SETUP_INTRO: 'setup-intro',
  SETUP_TUTORIAL: 'setup-tutorial',
  SETUP_PASSPHRASE_TUTORIAL: 'setup-passphrase-tutorial',
  SETUP_TUTORIAL_BUTTON: 'setup-tutorial-button',

  // Chrome notifications
  NOTIFICATION_SUCCESS: 'e2e-success',

  // e2ebind page elements
  E2EBIND_ICON: 'endtoend',
  E2EBIND_TEXT: 'rtetext',
  E2EBIND_SHOW_ENCRYPTED_LINK: 'show-encrypted-link',

  // glass
  LOCK_ICON: 'lock-icon',
  CHECK_ICON: 'check-icon'
};


/**
 * The CSS classes used throughout the extension.
 * @enum {string}
 */
e2e.ext.constants.CssClass = {
  ACTION: 'action',
  CANCEL: 'cancel',
  SAVE: 'save',
  INSERT: 'insert',
  OPTIONS: 'options',
  HIDDEN: 'hidden',
  INVISIBLE: 'invisible',
  TRANSPARENT: 'transparent',
  BACK: 'back',
  UNCLICKABLE: 'unclickable',

  /* Used to display UIDs in the prompt. */
  CHIP: 'uid-chip',
  CHIPS: 'uid-chips',
  BAD_CHIP: 'uid-bad-chip',

  /* Common UI components */
  DIALOG_INPUT: 'dialog-input',
  PREFERENCE_DIV: 'preference-div',
  SELECT_ALL_LINK: 'select-all-link',

  /* Used in the generate PGP keys form. */
  EMAIL: 'email',
  PASSPHRASE: 'passphrase',
  PASSPHRASE_CONFIRM: 'passphrase-confirm',

  /* Used in the keyring management section. */
  EXPORT: 'export',
  REMOVE: 'remove',
  KEY_FINGERPRINT: 'key-fingerprint',
  KEY_META: 'key-meta',
  KEY_TYPE_DESC: 'key-type-description',
  KEY_UID: 'key-uid',
  KEY_SUBKEY: 'key-sub',
  FB_IMPORT: 'fb-import',
  KEYRING_IMPORT: 'keyring-import',
  KEYRING_EXPORT: 'keyring-export',
  KEYRING_BACKUP: 'keyring-backup',
  KEYRING_CANCEL: 'keyring-cancel',
  KEYRING_BACKUP_WINDOW: 'keyring-backup-window',
  KEYRING_RESTORE: 'keyring-restore',
  KEYRING_RESTORE_INPUT: 'keyring-restore-input',
  /* TODO(rcc): Remove when we can use keyserver for lookups. */
  KEYRING_RESTORE_EMAIL: 'keyring-restore-email',
  KEYRING_PASSPHRASE_CHANGE: 'keyring-passphrase-change',

  /** Used in the welcome page */
  WELCOME_MENU_ICON: 'welcome-menu-icon',
  WELCOME_SUBSECTION_HEADER: 'welcome-subsection-header',

  /** Error messages **/
  ERROR: 'error',

  /** e2ebind page classes **/
  COMPOSE_CONTAINER: 'compose',
  COMPOSE_BODY: 'compose-message',

  /* setup page */
  SETUP_PAGE: 'setup-page'
};


/**
 * The keys used to persist data into local storage.
 * If the key exists in localStorage, then the preference is set, regardless
 * of the value.
 * @enum {string}
 */
e2e.ext.constants.StorageKey = {
  ENABLE_WELCOME_SCREEN: 'enable-welcome',
  ENABLE_ACTION_SNIFFING: 'enable-action-sniff',
  ENABLE_AUTO_SAVE: 'enable-auto-save',
  ENABLE_LOOKING_GLASS: 'enable-looking-glass',
  LAST_SAVED_DRAFT: 'last-saved-draft',
  KEYSERVER_SIGNED_RESPONSES: 'keyserver-signed-responses',
  PREFERENCES: 'PREF'
};


/**
 * The number of millis to keep Chrome notifications visible.
 * @const
 */
e2e.ext.constants.NOTIFICATIONS_DELAY = 3 * 1000;


/**
 * The number of millis to wait before saving a draft message.
 * @const
 */
e2e.ext.constants.AUTOSAVE_INTERVAL = 5 * 1000;


/**
 * Regular expression matching a valid email address. This needs to be very
 *    strict and reject uncommon formats to prevent vulnerability when
 *    keyserver would choose a different key than intended.
 * @const
 */
e2e.ext.constants.EMAIL_ADDRESS_REGEXP =
    /^[+a-zA-Z0-9_.!-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9]{2,63}$/;


/**
 * Default options for e2e
 * @type {{keyAlgo: string, keyLength: number,
 *     subkeyAlgo: string, subkeyLength: number}}
 */
e2e.ext.constants.KEY_DEFAULTS = {
  keyAlgo: 'ECDSA',
  keyLength: 256,

  subkeyAlgo: 'ECDH',
  subkeyLength: 256
};


/**
 * The dimensions for displaying the keyring backup code.
 * @enum {number}
 */
e2e.ext.constants.BackupCode = {
  ROWS: 3,
  COLS: 4
};


/**
 * The length of backup codes.
 * @const
 */
e2e.ext.constants.BACKUP_CODE_LENGTH = 24;


/**
 * e2ebind API response actions.
 * @const
 */
e2e.ext.constants.e2ebind.responseActions = {
  HAS_DRAFT: 'has_draft',
  GET_DRAFT: 'get_draft',
  SET_DRAFT: 'set_draft',
  SET_AND_SEND_DRAFT: 'set_and_send_draft',
  GET_CURRENT_MESSAGE: 'get_current_message'
};


/**
 * e2ebind API request actions.
 * @const
 */
e2e.ext.constants.e2ebind.requestActions = {
  START: 'start',
  INSTALL_READ_GLASS: 'install_read_glass',
  INSTALL_COMPOSE_GLASS: 'install_compose_glass',
  VALIDATE_SIGNER: 'validate_signer',
  VALIDATE_RECIPIENTS: 'validate_recipients',
  SET_SIGNER: 'set_signer'
};


/**
 * Keyserver data constants
 * @const
 */
e2e.ext.constants.Keyserver = {
  //TODO(dlg): separate Kauth key from Keyserver response key
  KAUTH_PUB: e2e.ext.config.KAUTH_PUB,
  TESTSERVER_ORIGIN: e2e.ext.config.TESTSERVER_ORIGIN,
  API_V1: 'v1/k',
  DEFAULT_LOCATION: e2e.ext.config.AUTH_DEFAULT_ORIGIN,
  AUTH_COOKIE: e2e.ext.config.AUTH_COOKIE,
  AUTH_ENABLED: e2e.ext.config.AUTH_ENABLED
};
