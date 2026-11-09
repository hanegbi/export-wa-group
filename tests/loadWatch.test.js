import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUIET_LIMIT_MS,
  PHONE_QUIET_LIMIT_MS,
  createLoadWatch,
  recordPass,
  resetQuiet,
  msUntilGiveUp,
  waitNote,
} from '../src/content/loadWatch.js';

test('a slow load does not end the export: 10 quiet seconds is nowhere near giving up', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, newRowCount: 40, scrollHeight: 5000 });
  for (let now = 700; now <= 10_000; now += 700) {
    watch = recordPass(watch, { now, newRowCount: 0, scrollHeight: 5000 });
    assert.ok(msUntilGiveUp(watch, now) > 0, `gave up after only ${now}ms of quiet`);
  }
});

test('gives up once the chat has been quiet for the full limit', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, newRowCount: 40, scrollHeight: 5000 });
  assert.equal(msUntilGiveUp(watch, QUIET_LIMIT_MS - 1), 1);
  assert.equal(msUntilGiveUp(watch, QUIET_LIMIT_MS), 0);
  assert.equal(msUntilGiveUp(watch, QUIET_LIMIT_MS + 5000), 0);
});

test('newly read rows restart the quiet clock', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 50_000, newRowCount: 3, scrollHeight: 5000 });
  assert.equal(msUntilGiveUp(watch, 50_000), QUIET_LIMIT_MS);
});

test('the pane growing past its tallest-ever height restarts the quiet clock', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, newRowCount: 10, scrollHeight: 5000 });
  watch = recordPass(watch, { now: 30_000, newRowCount: 0, scrollHeight: 5600 });
  assert.equal(msUntilGiveUp(watch, 30_000), QUIET_LIMIT_MS);
});

test('a height that only flickers below the tallest-ever height is not progress', () => {
  // A loading spinner appearing and vanishing must not keep the export alive forever.
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, newRowCount: 10, scrollHeight: 5040 });
  watch = recordPass(watch, { now: 20_000, newRowCount: 0, scrollHeight: 5000 });
  watch = recordPass(watch, { now: 40_000, newRowCount: 0, scrollHeight: 5040 });
  assert.equal(msUntilGiveUp(watch, 40_000), QUIET_LIMIT_MS - 40_000);
});

test('waits longer while WhatsApp is fetching from the phone', () => {
  assert.ok(PHONE_QUIET_LIMIT_MS > QUIET_LIMIT_MS);
  const watch = createLoadWatch(0);
  assert.equal(
    msUntilGiveUp(watch, QUIET_LIMIT_MS, { waitingOnPhone: true }),
    PHONE_QUIET_LIMIT_MS - QUIET_LIMIT_MS,
  );
  assert.equal(msUntilGiveUp(watch, PHONE_QUIET_LIMIT_MS, { waitingOnPhone: true }), 0);
});

test('resetQuiet restarts the clock without touching the height record', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, newRowCount: 1, scrollHeight: 5000 });
  watch = resetQuiet(watch, 55_000);
  assert.equal(msUntilGiveUp(watch, 55_000), QUIET_LIMIT_MS);
  watch = recordPass(watch, { now: 56_000, newRowCount: 0, scrollHeight: 5000 });
  assert.equal(msUntilGiveUp(watch, 56_000), QUIET_LIMIT_MS - 1000);
});

test('waitNote is silent while messages are flowing', () => {
  assert.equal(waitNote({ hidden: false, waitingOnPhone: false, quietMs: 1200, remainingMs: 58_800 }), null);
});

test('waitNote explains a hidden tab', () => {
  assert.match(
    waitNote({ hidden: true, waitingOnPhone: false, quietMs: 0, remainingMs: 60_000 }),
    /keep the WhatsApp tab visible/i,
  );
});

test('waitNote counts down in 5-second steps once the chat goes quiet', () => {
  const note = waitNote({ hidden: false, waitingOnPhone: false, quietMs: 18_000, remainingMs: 42_000 });
  assert.match(note, /45s/);
});

test('waitNote mentions the phone while waiting on a phone sync', () => {
  assert.match(
    waitNote({ hidden: false, waitingOnPhone: true, quietMs: 18_000, remainingMs: 100_000 }),
    /phone/i,
  );
});
