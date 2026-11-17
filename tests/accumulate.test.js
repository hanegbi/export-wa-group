import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccumulator, addPass } from '../src/content/accumulate.js';

function accumulate(...passes) {
  const accumulator = createAccumulator();
  for (const rows of passes) addPass(accumulator, rows);
  return accumulator;
}

const a = { id: 'a', line: 'A: hi' };
const b = { id: 'b', line: 'B: hey' };
const c = { id: 'c', line: 'C: yo' };
const d = { id: 'd', line: 'D: just arrived' };

test('first pass records all rows in given order', () => {
  assert.deepEqual(accumulate([a, b]).lines, ['A: hi', 'B: hey']);
});

test('a later pass prepends newly-revealed older rows and skips already-seen ones', () => {
  assert.deepEqual(accumulate([b, c], [a, b, c]).lines, ['A: hi', 'B: hey', 'C: yo']);
});

test('a pass with nothing new leaves lines unchanged', () => {
  assert.deepEqual(accumulate([a], [a]).lines, ['A: hi']);
});

test('rows that show up after already-seen rows are appended, not prepended', () => {
  // A message arriving at the bottom of the chat mid-export is newer, not older.
  assert.deepEqual(accumulate([b, c], [a, b, c, d]).lines, ['A: hi', 'B: hey', 'C: yo', 'D: just arrived']);
});

test('a pass that shares no rows with earlier passes is treated as older history', () => {
  assert.deepEqual(accumulate([c], [a, b]).lines, ['A: hi', 'B: hey', 'C: yo']);
});

test('a row id repeated within one pass is only recorded once', () => {
  assert.deepEqual(accumulate([a, a]).lines, ['A: hi']);
});

test('a repeated new row does not make the rows after it count as newer', () => {
  assert.deepEqual(accumulate([c], [a, a, b]).lines, ['A: hi', 'B: hey', 'C: yo']);
});

test('addPass reports how many rows were older history and how many arrived at the bottom', () => {
  const accumulator = createAccumulator();
  assert.deepEqual(addPass(accumulator, [b, c]), { olderCount: 2, newerCount: 0 });
  assert.deepEqual(addPass(accumulator, [a, b, c, d]), { olderCount: 1, newerCount: 1 });
  assert.deepEqual(addPass(accumulator, [a, b, c, d]), { olderCount: 0, newerCount: 0 });
});

test('rows the caller does not want are counted but not recorded', () => {
  // Older history outside the chosen date range is still proof the chat is loading.
  const accumulator = accumulate([c]);
  const counts = addPass(accumulator, [a, b, c, d], (row) => row.id === 'b');
  assert.deepEqual(counts, { olderCount: 2, newerCount: 1 });
  assert.deepEqual(accumulator.lines, ['B: hey', 'C: yo']);
});

test('a row that was not wanted is not reconsidered on a later pass', () => {
  const accumulator = accumulate([c]);
  addPass(accumulator, [a, c], () => false);
  assert.deepEqual(addPass(accumulator, [a, c]), { olderCount: 0, newerCount: 0 });
  assert.deepEqual(accumulator.lines, ['C: yo']);
});
