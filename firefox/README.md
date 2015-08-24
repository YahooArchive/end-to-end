#End to End
Helps you send encrypted email

## Porting from Chrome

The following API's need to be ported:
* done: chrome.i18n.getMessage -> require("sdk/l10n").get(...)

* chrome.runtime.connect (returns a port object for 2way messaging) ->
  construct a port object.
* chrome.runtime.onConnect.{addListener,removeListener} (takes a callback with
  a Port argument)
* chrome.runtime.onMessage.{addListener,removeListener} (single-message version
  of onConnect)
* chrome.runtime.sendMessage (single-message version of connect)

* done: chrome.runtime.getURL -> require("sdk/self").data.url(...)
* done: chrome.runtime.getManifest (used to set the pgp armor version, optional) ->
  require("sdk/self").version
* chrome.runtime.getBackgroundPage (used to get a reference to the launcher) ->
  ???

* done: chrome.tabs.create -> require("sdk/tabs").open(...)
* chrome.tabs.sendMessage -> tab.attach(/* attach a worker */)
* done: chrome.tabs.query -> iterate through require("sdk/tabs")
* done: chrome.tabs.reload -> tab.reload
* chrome.tabs.executeScript -> tab.attach

* done: chrome.browserAction.{setTitle,setIcon,setBadgeText} ->
  require("sdk/ui/button/action") {label, icon, badge, badgeColor}
* done: chrome.cookies.get (optional, can workaround)


