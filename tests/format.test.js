import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFilename,
  buildFilename,
  formatDateTimeLabel,
  escapeHtml,
} from '../src/shared/format.js';

test('sanitizeFilename replaces filesystem-invalid characters', () => {
  assert.equal(sanitizeFilename('Family <3> "Trip"?'), 'Family _3_ _Trip__');
});

test('sanitizeFilename collapses whitespace and trims', () => {
  assert.equal(sanitizeFilename('  Work   Chat  '), 'Work Chat');
});

test('sanitizeFilename falls back to "chat" when nothing is left', () => {
  assert.equal(sanitizeFilename('???'), 'chat');
});

test('buildFilename combines sanitized name, date, and extension', () => {
  const entry = { groupName: 'Family <3>', outcome: null, date: '2026-08-30T12:00:00.000Z' };
  assert.equal(buildFilename(entry), 'Family _3__2026-08-30.txt');
});

test('buildFilename marks an export that stopped early', () => {
  const entry = { groupName: 'Work', outcome: 'cancelled', date: '2026-08-30T12:00:00.000Z' };
  assert.equal(buildFilename(entry), 'Work (cancelled)_2026-08-30.txt');
});

test('formatDateTimeLabel renders a short date and time, no year', () => {
  const label = formatDateTimeLabel('2026-08-30T14:15:00Z');
  assert.match(label, /^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}\s?[AP]M$/);
});

test('escapeHtml escapes the five reserved HTML characters', () => {
  assert.equal(escapeHtml(`<b>"Danny" & 'crew'</b>`), '&lt;b&gt;&quot;Danny&quot; &amp; &#39;crew&#39;&lt;/b&gt;');
});
