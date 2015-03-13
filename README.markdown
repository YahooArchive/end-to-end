# Yahoo End-To-End

A fork of Google's [End-to-End](https://github.com/google/end-to-end) for Yahoo mail.

## Build instructions

### Install prerequisites

Prerequisites, Homebrew:

    brew install ant git

Or, MacPorts:

    port install apache-ant git

### Build the extension

The extension requires a keyserver implementing [this API](docs/keyserver.md)
to fetch keys for other users.

We do not currently provide a keyserver. So you'll need to run your own for
now. (We will provide a vagrantfile or node package for this soon.)

Once that's done:

1. Edit `src/javascript/crypto/e2e/extension/manifest.json` and replace
   `https://keyshop.paranoids.corp.yahoo.com:25519` with the origin of your
   keyserver.
2. Edit `src/javascript/crypto/extension/config.js` with your keyserver
   parameters. Most likely you will want to set `AUTH_ENABLED` to false, in
   which case you can put anything for `AUTH_COOKIE` and `AUTH_DEFAULT_ORIGIN`.

Then to build the extension:

    ./do.sh build_extension_debug

## Installation instructions

Go to chrome://extensions, check the "developer mode" checkbox, click on "Load
unpacked extension" and selected `file:///path/to/this/repo/build/extension`.


## Development

You can ask questions in the #e2e IRC channel or email yzhu@yahoo-inc.com for
extension-related issues. For keyserver related issues, contact
dgil@yahoo-inc.com.

## Docs

See [docs](docs) for current documentation.

## Acknowledgements

The committers would like to thank the following current and former Yahoo employees for their help with this project:
* Juan Garay
* Marty Garvin
* Jackie Goldberg
* Christopher Harrell
* Jonathan Pierce
* Payman Mohassel
* Binu Ramakrishnan
* Markandey Singh
* Alex Stamos
* Regina Wallace-Jones
* Albert Yu

We would also like to thank the [folks at google](CONTRIBUTORS) for starting
this project.
