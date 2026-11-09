import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFilename,
  formatDateISO,
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

test('formatDateISO formats a Date as YYYY-MM-DD', () => {
  assert.equal(formatDateISO(new Date('2026-08-30T12:00:00Z')), '2026-08-30');
});

test('buildFilename combines sanitized name, date, and extension', () => {
  const date = new Date('2026-08-30T12:00:00Z');
  assert.equal(buildFilename('Family <3>', date), 'Family _3__2026-08-30.txt');
});

test('formatDateTimeLabel renders a short date and time, no year', () => {
  const label = formatDateTimeLabel('2026-08-30T14:15:00Z');
  assert.match(label, /^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}\s?[AP]M$/);
});

test('escapeHtml escapes the five reserved HTML characters', () => {
  assert.equal(escapeHtml(`<b>"Danny" & 'crew'</b>`), '&lt;b&gt;&quot;Danny&quot; &amp; &#39;crew&#39;&lt;/b&gt;');
});
