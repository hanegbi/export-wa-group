import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatus, renderExportList } from '../src/popup/render.js';

test('renderStatus shows a disabled button with a hint when disabledReason is set', () => {
  const html = renderStatus({ status: 'idle', count: 0, error: null, disabledReason: 'Open a chat on web.whatsapp.com first.' });
  assert.match(html, /<button class="primary" id="export-btn" disabled>/);
  assert.match(html, /Open a chat on web\.whatsapp\.com first\./);
});

test('renderStatus shows an enabled button when idle and not disabled', () => {
  const html = renderStatus({ status: 'idle', count: 0, error: null, disabledReason: null });
  assert.match(html, /<button class="primary" id="export-btn">Export this group<\/button>/);
});

test('renderStatus shows a live progress message while running', () => {
  const html = renderStatus({ status: 'running', count: 812, error: null, disabledReason: null });
  assert.match(html, /class="progress"/);
  assert.match(html, /Scanning… 812 messages found/);
});

test('renderStatus shows the error message when status is error', () => {
  const html = renderStatus({ status: 'error', count: 0, error: 'No chat is open.', disabledReason: null });
  assert.match(html, /class="error"/);
  assert.match(html, /No chat is open\./);
});

test('renderStatus includes a cancel button while running', () => {
  const html = renderStatus({ status: 'running', count: 5, error: null, disabledReason: null });
  assert.match(html, /id="cancel-btn"/);
  assert.match(html, /title="Cancel export"/);
});

test('renderStatus omits the cancel button when idle', () => {
  const html = renderStatus({ status: 'idle', count: 0, error: null, disabledReason: null });
  assert.doesNotMatch(html, /id="cancel-btn"/);
});

test('renderExportList shows an empty state with no exports', () => {
  assert.match(renderExportList([]), /class="empty-state"/);
});

test('renderExportList renders one card per export, newest first order preserved, with escaped names', () => {
  const html = renderExportList([
    { id: '2', groupName: '<Family>', date: '2026-08-30T14:15:00Z' },
    { id: '1', groupName: 'Work', date: '2026-08-29T09:05:00Z' },
  ]);
  assert.match(html, /&lt;Family&gt;/);
  assert.match(html, /\d{1,2}:\d{2}\s?[AP]M/); // shows a time, not just a date
  assert.match(html, /data-export-id="2"/);
  assert.match(html, /data-export-id="1"/);
  assert.ok(html.indexOf('data-export-id="2"') < html.indexOf('data-export-id="1"'));
});

test('renderExportList includes download, copy, and delete icon buttons for each export', () => {
  const html = renderExportList([{ id: '1', groupName: 'Work', date: '2026-08-29T09:05:00Z' }]);
  assert.match(html, /class="icon-btn download-btn"/);
  assert.match(html, /title="Download"/);
  assert.match(html, /class="icon-btn copy-btn"/);
  assert.match(html, /title="Copy to clipboard"/);
  assert.match(html, /class="icon-btn delete-btn"/);
  assert.match(html, /title="Delete"/);
});
