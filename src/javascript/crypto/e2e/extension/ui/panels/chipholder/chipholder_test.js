/**
 * @license
 * Copyright 2013 Google Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Tests for the UI chip holder.
 */

/** @suppress {extraProvide} */
goog.provide('e2e.ext.ui.panels.ChipHolderTest');

goog.require('e2e.ext.constants');
goog.require('e2e.ext.testingstubs');
goog.require('e2e.ext.ui.panels.Chip');
goog.require('e2e.ext.ui.panels.ChipHolder');
goog.require('goog.dom.classlist');
goog.require('goog.events.KeyCodes');
goog.require('goog.style');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.asserts');
goog.require('goog.testing.jsunit');
goog.setTestOnly();

var chipHolder = null;
var constants = e2e.ext.constants;
var stubs = new goog.testing.PropertyReplacer();


function setUp() {
  e2e.ext.testingstubs.initStubs(stubs);

  chipHolder = new e2e.ext.ui.panels.ChipHolder(['1'], ['1', '2', '3']);
  chipHolder.decorate(document.body);
}


function tearDown() {
  stubs.reset();
  chipHolder = null;
}


function testAddChip() {
  var chip1 = chipHolder.addChip('2');
  var chip2 = chipHolder.addChip('6', true);
  var chip3 = chipHolder.addChip(new e2e.ext.ui.panels.Chip('5', true));
  var badChip = constants.CssClass.BAD_CHIP;
  assertEquals('1,2,6', chipHolder.getSelectedUids().join(','));
  assertEquals('5', chipHolder.getProvidedPassphrases().join(','));
  assertFalse(goog.dom.classlist.contains(chip1.getElement(), badChip));
  assertTrue(goog.dom.classlist.contains(chip2.getElement(), badChip));
  assertFalse(goog.dom.classlist.contains(chip3.getElement(), badChip));
}

function testRemoveUids() {
  chipHolder.addChip('2');
  chipHolder.addChip('3');
  chipHolder.removeUids(['1', '3']);
  assertArrayEquals(['2'], chipHolder.getSelectedUids());
}

function testIncreaseInputArea() {
  var originalWidth = goog.style.getSize(chipHolder.shadowInputElem_).width;
  chipHolder.handleKeyEvent_({keyCode: 'a'.charCodeAt(0)});

  assertTrue(originalWidth < goog.style.getSize(
      chipHolder.shadowInputElem_).width);
}


function testRemoveChipOnBackspace() {
  chipHolder.addChip('2');
  chipHolder.handleKeyEvent_({keyCode: goog.events.KeyCodes.BACKSPACE});
  assertEquals('1', chipHolder.getSelectedUids().join(','));

  chipHolder.handleKeyEvent_({keyCode: goog.events.KeyCodes.BACKSPACE});
  assertEquals('', chipHolder.getSelectedUids().join(','));
}


function testAddChipOnTab() {
  chipHolder.shadowInputElem_.value = '2';
  var trappedEvent = false;
  var trappedDefaultAction = false;
  chipHolder.autoComplete_.getSelectionHandler().handleKeyEvent({
    keyCode: goog.events.KeyCodes.TAB,
    preventDefault: function() {
      trappedDefaultAction = true;
    },
    stopPropagation: function() {
      trappedEvent = true;
    },
    target: chipHolder.shadowInputElem_
  });
  assertEquals('1,2', chipHolder.getSelectedUids().join(','));
  assertTrue(trappedDefaultAction);
  assertTrue(trappedEvent);
}


function testHandleNewChipValue() {
  var called = 0;
  chipHolder.shadowInputElem_.value = '2';
  stubs.replace(chipHolder, 'addAndMarkChip_', function(bad) {
    called++;
    assertFalse(bad);
  });
  chipHolder.autoComplete_.getSelectionHandler().handleKeyEvent({
    keyCode: goog.events.KeyCodes.TAB,
    preventDefault: goog.nullFunction,
    stopPropagation: goog.nullFunction,
    target: chipHolder.shadowInputElem_
  });
  chipHolder.shadowInputElem_.value = 'invalid';
  stubs.replace(chipHolder, 'addAndMarkChip_', function(bad) {
    called++;
    assertTrue(bad);
  });
  chipHolder.autoComplete_.getSelectionHandler().handleKeyEvent({
    keyCode: goog.events.KeyCodes.TAB,
    preventDefault: goog.nullFunction,
    stopPropagation: goog.nullFunction,
    target: chipHolder.shadowInputElem_
  });
  assertEquals(2, called);
}


function testMarkChipBad() {
  chipHolder.shadowInputElem_.value = '2';
  chipHolder.autoComplete_ = {
    isOpen: function() {
      return true;
    }
  };
  var trappedEvent = false;
  var trappedDefaultAction = false;
  chipHolder.handleKeyEvent_({
    keyCode: goog.events.KeyCodes.TAB,
    preventDefault: function() {
      trappedDefaultAction = true;
    },
    stopPropagation: function() {
      trappedEvent = true;
    }
  });
  assertEquals('1,2', chipHolder.getSelectedUids().join(','));
  assertTrue(goog.dom.classlist.contains
      (chipHolder.getChildAt(1).getElement(), constants.CssClass.BAD_CHIP));
}


function testEmptyInputDoesNotMarkLastChipBad() {
  chipHolder.shadowInputElem_.value = '';
  chipHolder.autoComplete_ = {
    isOpen: function() {
      return false;
    }
  };
  var trappedEvent = false;
  var trappedDefaultAction = false;
  chipHolder.handleKeyEvent_({
    keyCode: goog.events.KeyCodes.TAB,
    preventDefault: function() {
      trappedDefaultAction = true;
    },
    stopPropagation: function() {
      trappedEvent = true;
    }
  });
  assertEquals('1', chipHolder.getSelectedUids().join(','));
  assertFalse(goog.dom.classlist.contains
      (chipHolder.getChildAt(0).getElement(), constants.CssClass.BAD_CHIP));
}

function testPendingInputMarkChipBad() {
  chipHolder.shadowInputElem_.value = 'bad';
  chipHolder.autoComplete_ = {
    isOpen: function() {
      return false;
    }
  };
  var trappedEvent = false;
  var trappedDefaultAction = false;
  chipHolder.handleKeyEvent_({
    keyCode: goog.events.KeyCodes.TAB,
    preventDefault: function() {
      trappedDefaultAction = true;
    },
    stopPropagation: function() {
      trappedEvent = true;
    }
  });
  assertEquals('1,bad', chipHolder.getSelectedUids().join(','));
  assert(goog.dom.classlist.contains
      (chipHolder.getChildAt(1).getElement(), constants.CssClass.BAD_CHIP));
}

function testLock() {
  chipHolder.lock();
  assertTrue(chipHolder.isLocked());
  assertTrue(chipHolder.getChildAt(0).isLocked());
  chipHolder.handleKeyEvent_({keyCode: goog.events.KeyCodes.BACKSPACE});
  assertEquals('1', chipHolder.getSelectedUids().join(','));
  chipHolder.addChip('2');
  assertEquals('1', chipHolder.getSelectedUids().join(','));
  chipHolder.getChildAt(0).remove();
  assertEquals('1', chipHolder.getSelectedUids().join(','));
}

function testMarkGoodChips() {
  var chip1 = chipHolder.addChip('4', true);
  var chip2 = chipHolder.addChip('5', true);
  var badChip = constants.CssClass.BAD_CHIP;
  chipHolder.markGoodChips(['6', '4']);
  assertFalse(goog.dom.classlist.contains(chip1.getElement(), badChip));
  assertTrue(goog.dom.classlist.contains(chip2.getElement(), badChip));
}
