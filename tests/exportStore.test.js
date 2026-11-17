import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  idleStatus,
  runningStatus,
  errorStatus,
  loadState,
  saveStatus,
  saveExport,
  deleteExport,
  onStateChange,
} from '../src/shared/exportStore.js';

let listeners;

// An in-memory stand-in for chrome.storage.session.
beforeEach(() => {
  const data = {};
  listeners = [];
  globalThis.chrome = {
    storage: {
      session: {
        async get(keys) {
          const wanted = [].concat(keys);
          return structuredClone(Object.fromEntries(wanted.filter((key) => key in data).map((key) => [key, data[key]])));
        },
        async set(items) {
          Object.assign(data, structuredClone(items));
          const changes = Object.fromEntries(Object.keys(items).map((key) => [key, { newValue: items[key] }]));
          for (const listener of listeners) listener(changes, 'session');
        },
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
  };
});

test('an empty store loads as idle with no exports', async () => {
  const state = await loadState();
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.exports, []);
});

test('each status clears what the previous one showed', async () => {
  await saveStatus(errorStatus('boom'));
  await saveStatus(runningStatus(7, 12, 'Waiting…'));
  let state = await loadState();
  assert.deepEqual(
    [state.status, state.count, state.note, state.error],
    ['running', 12, 'Waiting…', null],
  );

  await saveStatus(idleStatus('Saved to Downloads.'));
  state = await loadState();
  assert.deepEqual(
    [state.status, state.count, state.note, state.notice],
    ['idle', 0, null, 'Saved to Downloads.'],
  );

  await saveStatus(errorStatus('no chat open'));
  state = await loadState();
  assert.deepEqual([state.status, state.error, state.notice], ['error', 'no chat open', null]);
});

test('saveExport puts the newest export first', async () => {
  await saveExport({ id: 'old' });
  await saveExport({ id: 'new' });
  assert.deepEqual((await loadState()).exports, [{ id: 'new' }, { id: 'old' }]);
});

test('saveExport keeps only the 15 most recent exports', async () => {
  for (let i = 0; i < 16; i += 1) await saveExport({ id: `e${i}` });
  const { exports } = await loadState();
  assert.equal(exports.length, 15);
  assert.equal(exports[0].id, 'e15');
  assert.equal(exports.at(-1).id, 'e1');
});

test('deleteExport removes only the export with the matching id', async () => {
  await saveExport({ id: 'a' });
  await saveExport({ id: 'b' });
  await deleteExport('a');
  await deleteExport('missing');
  assert.deepEqual((await loadState()).exports, [{ id: 'b' }]);
});

test('an export deleted mid-run stays deleted when the run reports progress and finishes', async () => {
  await saveExport({ id: 'old' });
  await saveStatus(runningStatus(7));
  await deleteExport('old');
  await saveStatus(runningStatus(7, 40));
  await saveExport({ id: 'new' });
  await saveStatus(idleStatus());
  assert.deepEqual((await loadState()).exports, [{ id: 'new' }]);
});

test('onStateChange delivers the whole state after either part changes', async () => {
  const seen = [];
  onStateChange((state) => seen.push(state));
  await saveStatus(runningStatus(7, 3));
  await saveExport({ id: 'a' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(seen.length, 2);
  assert.equal(seen.at(-1).count, 3);
  assert.deepEqual(seen.at(-1).exports, [{ id: 'a' }]);
});

test('onStateChange ignores other storage areas and unrelated keys', async () => {
  const seen = [];
  onStateChange((state) => seen.push(state));
  for (const listener of listeners) {
    listener({ exportStatus: { newValue: {} } }, 'local');
    listener({ somethingElse: { newValue: 1 } }, 'session');
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(seen.length, 0);
});

test('a running status remembers which tab is exporting, and the next status forgets it', async () => {
  await saveStatus(runningStatus(7, 40));
  assert.equal((await loadState()).tabId, 7);
  await saveStatus(idleStatus());
  assert.equal((await loadState()).tabId, null);
});
