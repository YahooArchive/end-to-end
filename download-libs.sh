#!/usr/bin/env bash
# // Copyright 2014 Google Inc. All rights reserved.
# //
# // Licensed under the Apache License, Version 2.0 (the "License");
# // you may not use this file except in compliance with the License.
# // You may obtain a copy of the License at
# //
# //   http://www.apache.org/licenses/LICENSE-2.0
# //
# // Unless required by applicable law or agreed to in writing, software
# // distributed under the License is distributed on an "AS IS" BASIS,
# // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# // See the License for the specific language governing permissions and
# // limitations under the License.
# /**
#  * @fileoverview Shell script to download End-To-End build dependencies
#  *
#  * @author koto@google.com (Krzysztof Kotowicz)
#  */

export JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF8

# symlink function with fallback on cp in case of failure.
symlink() {
  ln -s "$@" || cp -R "$@"
}

type ant >/dev/null 2>&1 || {
  echo >&2 "Ant is required to build End-To-End dependencies."
  exit 1
}
type javac >/dev/null 2>&1 || {
  echo >&2 "Java compiler is required to build End-To-End dependencies."
  exit 1
}
jversion=$(java -version 2>&1 | grep version | awk -F '"' '{print $2}')
if [[ $jversion < "1.7" ]]; then
  echo "Java 1.7 or higher is required to build End-To-End."
  exit 1
fi
type node >/dev/null 2>&1 || {
  echo >&2 "NodeJS is required to build End-To-End dependencies."
  exit 1
}
type npm >/dev/null 2>&1 || {
  echo >&2 "NPM is required to build End-To-End dependencies."
  exit 1
}

if [ ! -d lib ]; then
  mkdir lib
fi

git submodule init
git submodule update

cd lib

# symlink typedarray
if [ ! -d typedarray ]; then
  mkdir typedarray
  symlink ../zlib.js/define/typedarray/use.js typedarray/use.js
fi

# build closure compiler
if [ ! -f closure-compiler/build/compiler.jar ]; then
  cd closure-compiler
  ant clean
  ant jar
  cd ..
fi

# checkout closure templates compiler
if [ ! -d closure-templates-compiler ]; then
  curl https://dl.google.com/closure-templates/closure-templates-for-javascript-latest.zip -O # -k --ssl-added-and-removed-here-;-)
  unzip closure-templates-for-javascript-latest.zip -d closure-templates-compiler
  rm closure-templates-for-javascript-latest.zip
fi

# build css compiler
if [ ! -f closure-stylesheets/build/closure-stylesheets.jar ]; then
  cd closure-stylesheets
  ant
  cd ..
fi

# use protobuf js to generate the json proto
if [ ! -d protobufjs ]; then
  mkdir protobufjs
  mkdir protobufjs/externs

  cd protobufjs
  curl https://raw.githubusercontent.com/dcodeIO/long.js/2.3.0/dist/Long.min.js -O
  curl https://raw.githubusercontent.com/dcodeIO/bytebuffer.js/5.0.0/dist/bytebuffer.min.js -O
  curl https://raw.githubusercontent.com/dcodeIO/protobuf.js/5.0.0/dist/protobuf-light.min.js -O

  # create a single protobuf JS file
  cat *.js > protobuf-light.alldeps.js

  # prepare the proto file
  curl https://raw.githubusercontent.com/yahoo/coname/master/proto/timestamp.proto -O
  curl https://raw.githubusercontent.com/yahoo/coname/master/proto/client.proto -O

  # remove gogoproto import
  sed 's/import "gogoproto\/gogo.proto";//' client.proto > client-js.proto

  # generate coname-client.proto.json
  npm install protobufjs
  ../../node_modules/.bin/pbjs client-js.proto timestamp.proto -m > coname-client.proto.json

  # download the externs
  cd externs
  curl https://raw.githubusercontent.com/dcodeIO/long.js/2.3.0/externs/Long.js -O
  curl https://raw.githubusercontent.com/dcodeIO/bytebuffer.js/5.0.0/externs/bytebuffer.js -O
  curl https://raw.githubusercontent.com/dcodeIO/protobuf.js/5.0.0/externs/protobuf.js -O

  cd ../..
fi

if [ -f chrome_extensions.js ]; then
  rm -f chrome_extensions.js
fi

# Temporary fix
# Soy file bundled with the compiler does not compile with strict settings:
# lib/closure-templates-compiler/soyutils_usegoog.js:1762: ERROR - element JS_STR_CHARS does not exist on this enum
cd closure-templates-compiler

# Temporary fix
# Lock the version to Sep 16, 2015, in which the compiler can build without the follwing error
# curl https://raw.githubusercontent.com/google/closure-templates/master/javascript/soyutils_usegoog.js -O
curl https://raw.githubusercontent.com/google/closure-templates/0cbc8543c34d3f7727dd83a2d1938672f16d5c20/javascript/soyutils_usegoog.js -O
cd ..

cd ..
