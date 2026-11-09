import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccumulator, addPass, getText } from '../src/content/accumulate.js';

test('first pass records all rows in given order', () => {
  const acc = createAccumulator();
  const { accumulator, addedCount } = addPass(acc, [
    { id: 'a', line: 'A: hi' },
    { id: 'b', line: 'B: hey' },
  ]);
  assert.equal(addedCount, 2);
  assert.deepEqual(accumulator.lines, ['A: hi', 'B: hey']);
});

test('a later pass prepends newly-revealed older rows and skips already-seen ones', () => {
  const first = addPass(createAccumulator(), [
    { id: 'b', line: 'B: hey' },
    { id: 'c', line: 'C: yo' },
  ]);
  const second = addPass(first.accumulator, [
    { id: 'a', line: 'A: hi' }, // newly revealed, older
    { id: 'b', line: 'B: hey' }, // already seen
    { id: 'c', line: 'C: yo' }, // already seen
  ]);
  assert.equal(second.addedCount, 1);
  assert.deepEqual(second.accumulator.lines, ['A: hi', 'B: hey', 'C: yo']);
});

test('a pass with nothing new reports zero added and leaves lines unchanged', () => {
  const first = addPass(createAccumulator(), [{ id: 'a', line: 'A: hi' }]);
  const second = addPass(first.accumulator, [{ id: 'a', line: 'A: hi' }]);
  assert.equal(second.addedCount, 0);
  assert.deepEqual(second.accumulator.lines, ['A: hi']);
});

test('getText joins lines with newlines', () => {
  const { accumulator } = addPass(createAccumulator(), [
    { id: 'a', line: 'A: hi' },
    { id: 'b', line: 'B: hey' },
  ]);
  assert.equal(getText(accumulator), 'A: hi\nB: hey');
});

test('rows that show up after already-seen rows are appended, not prepended', () => {
  // A message arriving at the bottom of the chat mid-export is newer, not older.
  const first = addPass(createAccumulator(), [
    { id: 'b', line: 'B: hey' },
    { id: 'c', line: 'C: yo' },
  ]);
  const second = addPass(first.accumulator, [
    { id: 'a', line: 'A: hi' },
    { id: 'b', line: 'B: hey' },
    { id: 'c', line: 'C: yo' },
    { id: 'd', line: 'D: just arrived' },
  ]);
  assert.equal(second.addedCount, 2);
  assert.deepEqual(second.accumulator.lines, ['A: hi', 'B: hey', 'C: yo', 'D: just arrived']);
});

test('a pass that shares no rows with earlier passes is treated as older history', () => {
  const first = addPass(createAccumulator(), [{ id: 'c', line: 'C: yo' }]);
  const second = addPass(first.accumulator, [
    { id: 'a', line: 'A: hi' },
    { id: 'b', line: 'B: hey' },
  ]);
  assert.deepEqual(second.accumulator.lines, ['A: hi', 'B: hey', 'C: yo']);
});

test('a row id repeated within one pass is only recorded once', () => {
  const { accumulator, addedCount } = addPass(createAccumulator(), [
    { id: 'a', line: 'A: hi' },
    { id: 'a', line: 'A: hi' },
  ]);
  assert.equal(addedCount, 1);
  assert.deepEqual(accumulator.lines, ['A: hi']);
});
