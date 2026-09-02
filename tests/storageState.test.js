import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  startRunning,
  updateProgress,
  completeExport,
  failExport,
  deleteExport,
} from '../src/shared/storageState.js';

test('initialState starts idle with no exports', () => {
  assert.deepEqual(initialState(), { status: 'idle', count: 0, error: null, exports: [] });
});

test('startRunning resets count and error, keeps existing exports', () => {
  const state = { status: 'error', count: 12, error: 'boom', exports: [{ id: '1' }] };
  assert.deepEqual(startRunning(state), {
    status: 'running',
    count: 0,
    error: null,
    exports: [{ id: '1' }],
  });
});

test('updateProgress only touches count', () => {
  const state = { status: 'running', count: 0, error: null, exports: [] };
  assert.deepEqual(updateProgress(state, 47), { status: 'running', count: 47, error: null, exports: [] });
});

test('completeExport prepends the new export and resets to idle-ready done state', () => {
  const state = { status: 'running', count: 200, error: null, exports: [{ id: 'old' }] };
  const entry = { id: 'new', groupName: 'Family', date: '2026-08-30', text: 'line1\nline2' };
  assert.deepEqual(completeExport(state, entry), {
    status: 'done',
    count: 0,
    error: null,
    exports: [entry, { id: 'old' }],
  });
});

test('completeExport keeps only the 15 most recent exports', () => {
  const exports = Array.from({ length: 15 }, (_, i) => ({ id: `old-${i}` }));
  const state = { status: 'running', count: 0, error: null, exports };
  const result = completeExport(state, { id: 'new' });
  assert.equal(result.exports.length, 15);
  assert.equal(result.exports[0].id, 'new');
  assert.equal(result.exports.at(-1).id, 'old-13');
});

test('failExport records the error and keeps existing exports', () => {
  const state = { status: 'running', count: 5, error: null, exports: [{ id: 'old' }] };
  assert.deepEqual(failExport(state, 'no chat open'), {
    status: 'error',
    count: 5,
    error: 'no chat open',
    exports: [{ id: 'old' }],
  });
});

test('deleteExport removes the export with the matching id', () => {
  const state = { status: 'idle', count: 0, error: null, exports: [{ id: 'a' }, { id: 'b' }] };
  assert.deepEqual(deleteExport(state, 'a'), {
    status: 'idle',
    count: 0,
    error: null,
    exports: [{ id: 'b' }],
  });
});

test('deleteExport is a no-op when the id is not found', () => {
  const state = { status: 'idle', count: 0, error: null, exports: [{ id: 'a' }] };
  assert.deepEqual(deleteExport(state, 'missing'), state);
});
