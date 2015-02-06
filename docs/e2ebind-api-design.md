# e2ebind API design:


## Overview

e2ebind is a custom API designed for two-way interaction between Yahoo mail and the End-to-End Chrome extension. It consists of a module in End to End (aka the extension) and a module in Yahoo mail frontend (aka the provider). The two modules communicate via one-off window.postMessage messages. To keep track of the callback associated with each message and enforce that each side only responds to requests that it initiated, e2ebind inserts a unique hash into each message and uses these as keys in a hash table.

e2ebind was intended to be compatible with any webmail provider that implements an e2ebind module in their frontend. It is currently only used on Yahoo mail.


## Message structure

Messages are JSON-encoded strings (although in the future, they should just be unstringified JSON). There are two types of message formats:

* Requests
  * api (string): Always the literal 'e2ebind'. Distinguishes from other APIs that may be used for message passing (like gmonkey).
  * action (string): Indicates which action the other side should perform.
  * hash (string): unique identifier for the request.
  * args (object): dictionary of action arguments
  * source (string): indicates who sent the request. may be 'E2E', 'provider', or 'glass'.

* Responses
  * api - same as above.
  * action (string): indicates which action was performed.
  * hash - same as above
  * source - same as above.
  * success (boolean): whether the action was completed successfully.
  * result (object): the result of the action


## API actions

These are the possible API actions that may be initiated by a request from either the extension or the provider.


* Provider-initiated

  * start - tells the extension to start listening for requests from the provider.
    * action: 'start'
    * args: signer (string) - email address of current logged-in user, read_glass_enabled (boolean) - whether looking glasses are enabled for the page, compose_glass_enabled (boolean) - whether compose glasses are enabled for the page, version (string) - version of the API supported, currently '1.0'.
    * response: valid (boolean) - whether the signer was verified (has a private key)

  * install_read_glass - tells extension to install read (looking) glasses for all the encrypted messages in the current thread.
    * action: 'install_read_glass'
    * args: Array.<{elem: string (unique selector for message), text: string (optional alternative to element's innerText)}>

  * install_compose_glass  - tells extension to install a compose glass for the current active compose window. compose glasses allow secure composition inline via iframes. if this feature is not supported, the provider shows a popup instructing user to click on the end-to-end broserAction.
    * action: 'install_compose_glass'
    * args: elem (string) - unique selector of the element to install the glass in, draft (object) - the current draft content.

  * validate_recipients - tells extension to validate mail recipients so they can be marked secure/insecure in the yahoo mail UI.
    * action: 'validate_recipients'
    * args: Array.<string> (email addresses to check for public keys)
    * response: Array.<{valid: boolean, recipient: string}>

  * set_signer - most mail providers support sending from multiple email addresses. this is sent when the email address changes.
    * action: 'set_signer',
    * args: {signer: string} (email address of the new signer)
    * response: valid (boolean) whether the signer has a private key


* Extension-initiated (most of these are analagous to gmonkey)

  * has_draft - checks if a draft exists
    * action: 'has_draft'
    * response: has_draft (boolean) - Whether there is an active draft in the provider window.

  * get_draft - gets the draft content
    * action: 'get_draft'
    * response: ?{to: Array.<string>, cc: Array.<string>, bcc: Array.<string>, body: string, subject: string}

  * set_draft - sets a draft. note: if no compose window is open, the provider opens a new one. The 'cc' and 'bcc' fields are not yet supported.
    * action: 'set_draft'
    * args: {to: Array.<string>, cc: Array.<string>, bcc: Array.<string>, body: string, subject: string}

  * get_current_message - Dumps the current message content into the extension. Only used if the provider does not support looking glasses, or looking glasses are disabled.
    * action: 'get_current_message'
    * response: ?{elem: string (unique selector of element containing the message), text: string (optional alternative to the element innerText)}



## TODO:
* install_compose_glass in the provider does not send the 'elem' parameter yet. Currently I am using a hack to get the compose textarea associated with the lock icon that was clicked by the user.
* Why are all messages posted as stringified JSON instead of just JSON? Should fix.
* Use message channels instead of one-off message passing to get rid of the hash table.