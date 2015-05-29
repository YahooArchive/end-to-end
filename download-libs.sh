#!/usr/bin/env sh
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

if [ ! -d lib ]; then
  mkdir lib
fi
cd lib

# checkout closure library
if [ ! -d closure-library/.git ]; then
  git clone https://github.com/google/closure-library closure-library
  cd closure-library
  git checkout eb26f425dbd99a70d2955d8fcc892f2fd0178acb
  cd ..
fi

# checkout zlib.js
if [ ! -d zlib.js/.git ]; then
  git clone https://github.com/imaya/zlib.js zlib.js
  cd zlib.js
  git checkout b99bd33d485d63e93310b911a1f8dbf9ceb265d5
  cd ..
  mkdir typedarray
  ln -s ../zlib.js/define/typedarray/use.js typedarray/use.js
fi

# checkout closure compiler
if [ ! -d closure-compiler/.git ]; then
  if [ -d closure-compiler ]; then # remove binary release directory
    rm -rf closure-compiler 
  fi
  git clone --depth 1 https://github.com/google/closure-compiler closure-compiler
  cd closure-compiler
  git checkout e7dc2720838d0c8fb14dbd31729b665c0b8735f4
  ant jar
  cd ..
fi

# checkout closure templates compiler
if [ ! -d closure-templates-compiler ]; then
  curl https://dl.google.com/closure-templates/closure-templates-for-javascript-latest.zip -O # -k --ssl-added-and-removed-here-;-)
  unzip closure-templates-for-javascript-latest.zip -d closure-templates-compiler
  rm closure-templates-for-javascript-latest.zip
fi

# checkout css compiler
if [ ! -d closure-stylesheets/.git ]; then
  if [ -d closure-stylesheets ]; then # remove binary release directory
    rm -rf closure-stylesheets
  fi
  git clone https://code.google.com/p/closure-stylesheets/
  cd closure-stylesheets
  git checkout 3eb80f827270e73abd882ba69dbc3f3182a55889
  ant
  cp build/closure-stylesheets.jar ../
  cd ..
fi

if [ ! -f chrome_extensions.js ]; then
  curl https://raw.githubusercontent.com/google/closure-compiler/master/contrib/externs/chrome_extensions.js -O
fi

# Temporary fix
# Soy file bundled with the compiler does not compile with strict settings:
# lib/closure-templates-compiler/soyutils_usegoog.js:1762: ERROR - element JS_STR_CHARS does not exist on this enum
cd closure-templates-compiler
curl https://raw.githubusercontent.com/google/closure-templates/master/javascript/soyutils_usegoog.js -O
cd ..

cd ..
