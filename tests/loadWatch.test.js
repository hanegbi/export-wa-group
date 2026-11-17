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
  watch = recordPass(watch, { now: 0, olderRowCount: 40, scrollHeight: 5000 });
  for (let now = 700; now <= 10_000; now += 700) {
    watch = recordPass(watch, { now, olderRowCount: 0, scrollHeight: 5000 });
    assert.ok(msUntilGiveUp(watch, now) > 0, `gave up after only ${now}ms of quiet`);
  }
});

test('gives up once the chat has been quiet for the full limit', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, olderRowCount: 40, scrollHeight: 5000 });
  assert.equal(msUntilGiveUp(watch, QUIET_LIMIT_MS - 1), 1);
  assert.equal(msUntilGiveUp(watch, QUIET_LIMIT_MS), 0);
  assert.equal(msUntilGiveUp(watch, QUIET_LIMIT_MS + 5000), 0);
});

test('newly read rows restart the quiet clock', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 50_000, olderRowCount: 3, scrollHeight: 5000 });
  assert.equal(msUntilGiveUp(watch, 50_000), QUIET_LIMIT_MS);
});

test('the pane growing past its tallest-ever height restarts the quiet clock', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, olderRowCount: 10, scrollHeight: 5000 });
  watch = recordPass(watch, { now: 30_000, olderRowCount: 0, scrollHeight: 5600 });
  assert.equal(msUntilGiveUp(watch, 30_000), QUIET_LIMIT_MS);
});

test('a height that only flickers below the tallest-ever height is not progress', () => {
  // A loading spinner appearing and vanishing must not keep the export alive forever.
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, olderRowCount: 10, scrollHeight: 5040 });
  watch = recordPass(watch, { now: 20_000, olderRowCount: 0, scrollHeight: 5000 });
  watch = recordPass(watch, { now: 40_000, olderRowCount: 0, scrollHeight: 5040 });
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
  watch = recordPass(watch, { now: 0, olderRowCount: 1, scrollHeight: 5000 });
  watch = resetQuiet(watch, 55_000);
  assert.equal(msUntilGiveUp(watch, 55_000), QUIET_LIMIT_MS);
  watch = recordPass(watch, { now: 56_000, olderRowCount: 0, scrollHeight: 5000 });
  assert.equal(msUntilGiveUp(watch, 56_000), QUIET_LIMIT_MS - 1000);
});

test('waitNote explains a hidden tab', () => {
  assert.match(waitNote({ hidden: true }), /keep the WhatsApp tab visible/i);
});

test('waitNote says nothing while the tab is visible, however long the chat has been quiet', () => {
  assert.equal(waitNote({ hidden: false }), null);
});

test('messages arriving at the bottom of a busy chat do not restart the quiet clock', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, olderRowCount: 10, scrollHeight: 5000 });
  watch = recordPass(watch, { now: 30_000, olderRowCount: 0, newerRowCount: 1, scrollHeight: 5060 });
  assert.equal(msUntilGiveUp(watch, 30_000), QUIET_LIMIT_MS - 30_000);
});

test('the height a new message added is not mistaken for older history on the next pass', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, olderRowCount: 10, scrollHeight: 5000 });
  watch = recordPass(watch, { now: 30_000, olderRowCount: 0, newerRowCount: 1, scrollHeight: 5060 });
  watch = recordPass(watch, { now: 31_000, olderRowCount: 0, newerRowCount: 0, scrollHeight: 5060 });
  assert.equal(msUntilGiveUp(watch, 31_000), QUIET_LIMIT_MS - 31_000);
});

test('older history arriving together with a new message still restarts the quiet clock', () => {
  let watch = createLoadWatch(0);
  watch = recordPass(watch, { now: 0, olderRowCount: 10, scrollHeight: 5000 });
  watch = recordPass(watch, { now: 30_000, olderRowCount: 5, newerRowCount: 1, scrollHeight: 5400 });
  assert.equal(msUntilGiveUp(watch, 30_000), QUIET_LIMIT_MS);
});
