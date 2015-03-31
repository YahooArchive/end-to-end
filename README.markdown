# Yahoo End-To-End

A fork of Google's [End-to-End](https://github.com/google/end-to-end) for Yahoo mail.

## Build instructions

### Install prerequisites

End-to-End depends on the following:
* bash
* git
* curl
* unzip
* ant
* JDK 1.7
* Python

On OSX with Homebrew:

    brew install ant git

Or, MacPorts:

    port install apache-ant git

### Build the extension

The extension requires a keyserver implementing [this API](docs/keyserver.md)
to fetch keys for other users.

We do not currently provide a publicly-exposed keyserver, so for now the recommended way is to [follow these instructions](https://example.com) to run a local keyserver.

Once that's done:

1. Replace `KAUTH_PUB` in `src/javascript/crypto/e2e/extension/config.js` with
   the contents of `/path/to/keyshop/data/kauth/kauth.pub.js`.
2. [OPTIONAL] If you're running the keyshop at a non-default origin, replace
   `https://localhost:25519` with the keyserver origin in
   `src/javascript/crypto/e2e/extension/config.js` and
   `src/javascript/crypto/e2e/extension/manifest.json`.

Then to build the extension:

    ./do.sh build_extension_debug

## Installation instructions

Go to `https://localhost:25519` in Chrome and click through the self-signed certificate
warning so that the extension can talk to the keyserver.

To load the extension, go to chrome://extensions, check the "developer mode" checkbox, click on "Load
unpacked extension" and selected `file:///path/to/this/repo/build/extension`.


## Development

We use Github's built-in issue tracker for tracking issues. The general
End-to-End mailing list is
[e2e-discuss](https://groups.google.com/forum/#!forum/e2e-discuss). Please put
[YAHOO] at the start of the subject line if your email is specifically about
this project.

We generally ask that you follow Google's [End-to-End Contributing
Guidelines](docs/CONTRIBUTING.md) for submitting to this repo.

## Docs

See [docs](docs) for current documentation.

## Acknowledgements

The committers would like to thank the following current and former Yahoo employees for their help with this project:
* Doug DePerry
* Juan Garay
* Marty Garvin
* Jackie Goldberg
* Christopher Harrell
* Stuart Larsen
* Jonathan Pierce
* Payman Mohassel
* Binu Ramakrishnan
* Chris Rolhf
* Markandey Singh
* Alex Stamos
* Regina Wallace-Jones
* Gil Yehuda
* Albert Yu

We would also like to thank the [folks at google](CONTRIBUTORS) for starting this project.

## Licensing

Code licensed under the Apache Version 2.0 license. See LICENSE file for terms.
