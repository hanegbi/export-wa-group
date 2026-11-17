import test from 'node:test';
import assert from 'node:assert/strict';
import { getDateFieldOrder, parseWhatsAppTimestamp, isWithinRange, orderRange } from '../src/content/timestamp.js';

test('getDateFieldOrder detects month-day-year order for en-US', () => {
  assert.deepEqual(getDateFieldOrder('en-US'), ['month', 'day', 'year']);
});

test('getDateFieldOrder detects day-month-year order for en-GB', () => {
  assert.deepEqual(getDateFieldOrder('en-GB'), ['day', 'month', 'year']);
});

test('getDateFieldOrder detects year-month-day order for sv-SE', () => {
  assert.deepEqual(getDateFieldOrder('sv-SE'), ['year', 'month', 'day']);
});

test('parseWhatsAppTimestamp parses a 24-hour time with month/day/year order', () => {
  const date = parseWhatsAppTimestamp('14:32, 8/30/2026', ['month', 'day', 'year']);
  assert.deepEqual(
    [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()],
    [2026, 7, 30, 14, 32],
  );
});

test('parseWhatsAppTimestamp parses a 12-hour PM time with day/month/year order', () => {
  const date = parseWhatsAppTimestamp('2:32 PM, 30/8/2026', ['day', 'month', 'year']);
  assert.deepEqual(
    [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()],
    [2026, 7, 30, 14, 32],
  );
});

test('parseWhatsAppTimestamp treats 12 AM as midnight', () => {
  const date = parseWhatsAppTimestamp('12:15 AM, 8/30/2026', ['month', 'day', 'year']);
  assert.equal(date.getHours(), 0);
  assert.equal(date.getMinutes(), 15);
});

test('parseWhatsAppTimestamp returns null for unparseable input', () => {
  assert.equal(parseWhatsAppTimestamp('not a timestamp', ['month', 'day', 'year']), null);
  assert.equal(parseWhatsAppTimestamp('', ['month', 'day', 'year']), null);
});

test('isWithinRange always includes a null date (unparseable timestamp)', () => {
  assert.equal(isWithinRange(null, new Date('2026-01-01'), new Date('2026-12-31')), true);
});

test('isWithinRange excludes dates newer than the from bound', () => {
  const from = new Date('2026-06-01');
  assert.equal(isWithinRange(new Date('2026-07-01'), from, null), false);
  assert.equal(isWithinRange(new Date('2026-05-01'), from, null), true);
});

test('isWithinRange excludes dates older than the to bound', () => {
  const to = new Date('2026-06-01');
  assert.equal(isWithinRange(new Date('2026-05-01'), null, to), false);
  assert.equal(isWithinRange(new Date('2026-07-01'), null, to), true);
});

test('isWithinRange includes everything when neither bound is set', () => {
  assert.equal(isWithinRange(new Date('2026-07-01'), null, null), true);
});

const march = new Date('2026-03-01T00:00');
const june = new Date('2026-06-01T00:00');

test('orderRange accepts the two dates in either order', () => {
  assert.deepEqual(orderRange('2026-06-01T00:00', '2026-03-01T00:00'), { newest: june, oldest: march });
  assert.deepEqual(orderRange('2026-03-01T00:00', '2026-06-01T00:00'), { newest: june, oldest: march });
});

test('orderRange treats a lone From as the newest bound and a lone To as the oldest', () => {
  assert.deepEqual(orderRange('2026-06-01T00:00', null), { newest: june, oldest: null });
  assert.deepEqual(orderRange(null, '2026-03-01T00:00'), { newest: null, oldest: march });
  assert.deepEqual(orderRange(null, null), { newest: null, oldest: null });
});
