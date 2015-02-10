# End-To-End

## Build instructions

Prerequisites, Homebrew:

    brew install ant git

Or, MacPorts:

    port install apache-ant git

Then:

    ./do.sh build_extension_debug

## Installation instructions

### Install the keyserver self-signed certificate

1. Save the [certificate](keyshop-ca.pem).
2. Go to chrome://settings/ in Chrome >> "Show advanced settings"
3. Click on "Manage certificates" under "HTTPS/SSL"
3. Load the saved certificate. (On OS X Yosemite, go to File >> "Import Items")

Or visit https://keyshop.paranoids.corp.yahoo.com:25519 and click through the
warning to trust the cert temporarily. Note that you have to do this every
time Chrome restarts, or else you won't be able to fetch or send PGP keys.

### Load the extension

Go to chrome://extensions, check the "developer mode" checkbox, click on "Load
unpacked extension" and selected `file:///path/to/this/repo/build/extension`.


## Development

You can ask questions in the #e2e IRC channel or email yzhu@yahoo-inc.com for
extension-related issues. For keyserver related issues, contact
dgil@yahoo-inc.com.

## Docs

See [docs](docs) for current documentation. In addition:
* The keyserver Github repo is [here](https://git.corp.yahoo.com/dgil/keyshop-minimal).
* There are some out-of-date [keyserver API
  docs](https://git.corp.yahoo.com/dgil/e2e-ks-stub).

## Acknowledgements

The committers would like to thank the following current and former Yahoo employees for their help with this project:
* Juan Garay
* Marty Garvin
* Jackie Goldberg
* Christopher Harrell
* Jonathan Pierce
* Payman Mohassel
* Markandey Singh
* Alex Stamos
* Regina Wallace-Jones
* Albert Yu
