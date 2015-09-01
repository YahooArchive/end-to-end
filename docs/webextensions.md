# Porting from Chrome

The following Chrome API's need to be ported:

* done: chrome.i18n.getMessage

* done (i think): chrome.runtime.connect (returns a port object for 2way messaging) ->
  construct a port object.
* done: chrome.runtime.onConnect.{addListener,removeListener} (takes a callback with
  a Port argument)
* done: chrome.runtime.onMessage.{addListener,removeListener} (single-message version
  of onConnect)
* done: chrome.runtime.sendMessage (single-message version of connect)

* done (not in Mozilla wiki): chrome.runtime.getURL
* done: chrome.runtime.getManifest (used to set the pgp armor version, optional)

* done (i think): chrome.runtime.getBackgroundPage (used to get a reference to the launcher) -> chrome.extension.getBackgroundPage

* done: chrome.tabs.create
* done: chrome.tabs.sendMessage
* done: chrome.tabs.query
* done: chrome.tabs.reload
* done: chrome.tabs.executeScript

* done: chrome.browserAction.{setTitle,setIcon,setBadgeText}

* not supported or needed: chrome.cookies.get (optional, can workaround)

* done: notifications.create
* done: notifications.clear


Reference: https://wiki.mozilla.org/WebExtensions#List_of_supported_APIs
