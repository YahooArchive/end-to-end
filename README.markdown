# Yahoo Mail Encrypted

Send and read user-to-user encrypted messages in Yahoo Mail. This is forked from Google's [End-to-End](https://github.com/google/end-to-end).

![Travis Build](https://api.travis-ci.org/yahoo/end-to-end.svg "End to End Travis Build")

## Build instructions

### Build the extension

The extension requires a keyserver implementing [CONAME API](https://github.com/yahoo/coname)
to update public keys and fetch those for other users.

We do not currently provide a publicly-exposed keyserver, so for now the recommended way is to build and run your own CONAME keyserver.

Once that's done, update the hostnames of the keyserver if you're not using the default host of `localhost:4443`.

Then to build the extension:

    ./do.sh clean
    ./do.sh clean_deps
    ./do.sh install_deps
    ./do.sh build_extension debug

## Installation instructions

Go to `https://localhost:4443` in Chrome and click through the self-signed certificate
warning so that the extension can talk to the keyserver.

To load the extension, go to chrome://extensions, check the "developer mode" checkbox, click on "Load
unpacked extension" and selected `file:///path/to/this/repo/build/extension`.


## Development

We use Github's built-in issue tracker for tracking issues. The general mailing list is
[e2e-discuss](https://groups.google.com/forum/#!forum/e2e-discuss). Please put
[YAHOO] at the start of the subject line if your email is specifically about
this project.

We generally ask that you follow Google's [End-to-End Contributing
Guidelines](docs/CONTRIBUTING.md) for submitting to this repo.

## Docs

Here is a simplified diagram of the current E2E architecture:
![e2e diagram](docs/e2e-diagram.png)

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
