import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatus, renderExportList } from '../src/popup/render.js';

const idle = { status: 'idle', count: 0, note: null, error: null, notice: null, disabledReason: null, chatName: null };

test('renderStatus shows a disabled button with a hint when disabledReason is set', () => {
  const html = renderStatus({ ...idle, disabledReason: 'Open a chat on web.whatsapp.com first.' });
  assert.match(html, /<button class="primary" id="export-btn" disabled>/);
  assert.match(html, /Open a chat on web\.whatsapp\.com first\./);
});

test('renderStatus shows an enabled button when idle and not disabled', () => {
  const html = renderStatus(idle);
  assert.match(html, /<button class="primary" id="export-btn">Export this group<\/button>/);
});

test('renderStatus names the open chat on the button, escaped', () => {
  const html = renderStatus({ ...idle, chatName: 'Hiking <Club>' });
  assert.match(html, /<button class="primary" id="export-btn">Export <span class="chat-name">Hiking &lt;Club&gt;<\/span><\/button>/);
});

test('renderStatus shows a live counter and progress bar while running', () => {
  const html = renderStatus({ ...idle, status: 'running', count: 4812 });
  assert.match(html, /class="progress-bar"/);
  assert.match(html, /class="count">4,812</);
  assert.match(html, /messages found/);
});

test('renderStatus shows an escaped wait note under the counter while running', () => {
  const html = renderStatus({ ...idle, status: 'running', count: 812, note: 'No new messages <yet>' });
  assert.match(html, /class="wait-note">No new messages &lt;yet&gt;</);
});

test('renderStatus shows no note line when there is no note', () => {
  const html = renderStatus({ ...idle, status: 'running', count: 812 });
  assert.doesNotMatch(html, /class="wait-note"/);
});

test('renderStatus shows the error message in an error callout', () => {
  const html = renderStatus({ ...idle, status: 'error', error: 'No chat is <open>.' });
  assert.match(html, /class="callout error"/);
  assert.match(html, /No chat is &lt;open&gt;\./);
});

test('renderStatus shows a notice in a neutral callout with the export button enabled', () => {
  const html = renderStatus({ ...idle, status: 'done', notice: 'Saved to Downloads as "Work.txt".' });
  assert.match(html, /<button class="primary" id="export-btn">/);
  assert.match(html, /class="callout notice"/);
  assert.match(html, /Saved to Downloads as &quot;Work\.txt&quot;\./);
  assert.doesNotMatch(html, /callout error/);
});

test('renderStatus includes a cancel button while running', () => {
  const html = renderStatus({ ...idle, status: 'running', count: 5 });
  assert.match(html, /id="cancel-btn"/);
  assert.match(html, /title="Stop and save what was found"/);
});

test('renderStatus omits the cancel button when idle', () => {
  assert.doesNotMatch(renderStatus(idle), /id="cancel-btn"/);
});

test('renderExportList shows an empty state with no exports', () => {
  const html = renderExportList([]);
  assert.match(html, /class="empty-state"/);
  assert.match(html, /No exports yet/);
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

test('renderExportList wraps name+date in a shrinkable container and puts the full name in a title', () => {
  const longName = 'A'.repeat(200);
  const html = renderExportList([{ id: '1', groupName: longName, date: '2026-08-29T09:05:00Z' }]);
  assert.match(html, /class="export-card-info"/);
  assert.match(html, new RegExp(`class="name" title="${longName}"`));
});

test('renderExportList shows the message count when the export recorded one', () => {
  const html = renderExportList([{ id: '1', groupName: 'Work', date: '2026-08-29T09:05:00Z', lineCount: 4812 }]);
  assert.match(html, /4,812 messages/);
  const legacy = renderExportList([{ id: '1', groupName: 'Work', date: '2026-08-29T09:05:00Z' }]);
  assert.doesNotMatch(legacy, /messages/);
});

test('renderExportList turns a cancelled/partial suffix into a tag and keeps the clean name', () => {
  const html = renderExportList([{ id: '1', groupName: 'Work (cancelled)', date: '2026-08-29T09:05:00Z' }]);
  assert.match(html, /class="name" title="Work">Work</);
  assert.match(html, /class="tag">cancelled</);
  assert.match(renderExportList([{ id: '1', groupName: 'Work (partial)', date: '2026-08-29T09:05:00Z' }]), /class="tag">partial</);
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
