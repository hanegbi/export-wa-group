import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrePlainText, buildLine } from '../src/content/scrape.js';

test('parsePrePlainText extracts the bracketed timestamp and sender', () => {
  assert.deepEqual(parsePrePlainText('[14:32, 8/30/2026] Danny: '), {
    time: '14:32, 8/30/2026',
    sender: 'Danny',
  });
});

test('parsePrePlainText handles a sender name containing a colon', () => {
  assert.deepEqual(parsePrePlainText('[9:01 AM, 1/2/2024] Acme: Support: '), {
    time: '9:01 AM, 1/2/2024',
    sender: 'Acme: Support',
  });
});

test('parsePrePlainText returns null when the string does not match', () => {
  assert.equal(parsePrePlainText('not a timestamp'), null);
  assert.equal(parsePrePlainText(''), null);
});

test('buildLine includes the bracketed time when present', () => {
  assert.equal(
    buildLine({ time: '14:32, 8/30/2026', sender: 'Danny', text: 'see you at 8' }),
    '[14:32, 8/30/2026] Danny: see you at 8',
  );
});

test('buildLine omits brackets when time is null (system messages)', () => {
  assert.equal(
    buildLine({ time: null, sender: 'System', text: 'Danny joined using this group\'s invite link' }),
    "System: Danny joined using this group's invite link",
  );
});
