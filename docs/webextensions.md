# Porting from Chrome

The following Chrome API's need to be ported:

* done: chrome.i18n.getMessage

* NEEDED: chrome.runtime.connect (returns a port object for 2way messaging) ->
  construct a port object. Opened
  https://bugzilla.mozilla.org/show_bug.cgi?id=1202900.
* done: chrome.runtime.onConnect.{addListener,removeListener} (takes a callback with
  a Port argument)
* done: chrome.runtime.onMessage.{addListener,removeListener} (single-message version
  of onConnect)
* done: chrome.runtime.sendMessage (single-message version of connect)
* done (not in Mozilla wiki): chrome.runtime.getURL
* done: chrome.runtime.getManifest (used to set the pgp armor version, optional)
* done: chrome.runtime.getBackgroundPage (used to get a reference to the launcher) -> chrome.extension.getBackgroundPage
* done: chrome.tabs.create
* done: chrome.tabs.sendMessage
* done: chrome.tabs.query
* done: chrome.tabs.reload
* done: chrome.tabs.executeScript
* done: chrome.browserAction.{setTitle,setIcon,setBadgeText}
* not supported or needed: chrome.cookies.get (optional, can workaround)
* done: chrome.notifications.create
* done: chrome.notifications.clear


Reference: https://wiki.mozilla.org/WebExtensions#List_of_supported_APIs
Open bugs:
https://bugzilla.mozilla.org/buglist.cgi?component=WebExtensions&product=Toolkit&bug_status=__open__&list_id=12536403
