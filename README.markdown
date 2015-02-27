# End-To-End

## Build instructions

Prerequisites, Homebrew:

    brew install ant git

Or, MacPorts:

    port install apache-ant git

Then:

    ./do.sh build_extension_debug

## Installation instructions

Go to chrome://extensions, check the "developer mode" checkbox, click on "Load
unpacked extension" and selected `file:///path/to/this/repo/build/extension`.


## Development

You can ask questions in the #e2e IRC channel or email yzhu@yahoo-inc.com for
extension-related issues. For keyserver related issues, contact
dgil@yahoo-inc.com.

## Docs

See [docs](docs) for current documentation. In addition:
* The keyserver Github repo is [here](https://git.corp.yahoo.com/dgil/keyshop-minimal).
* There are some slightly out-of-date mail frontend integration docs at [yo/maile2e](http://yo/maile2e).

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
