import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatus, renderExportList } from '../src/popup/render.js';
import { idleStatus } from '../src/shared/exportStore.js';

const idle = { ...idleStatus(), disabledReason: null, chatName: null };

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
  const html = renderStatus({ ...idle, notice: 'Saved to Downloads as "Work.txt".' });
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

const work = { id: '1', groupName: 'Work', outcome: null, date: '2026-08-29T09:05:00Z', lineCount: 4812 };

test('renderExportList renders one card per export, newest first order preserved, with escaped names', () => {
  const html = renderExportList([{ ...work, id: '2', groupName: '<Family>', date: '2026-08-30T14:15:00Z' }, work]);
  assert.match(html, /&lt;Family&gt;/);
  assert.match(html, /\d{1,2}:\d{2}\s?[AP]M/); // shows a time, not just a date
  assert.ok(html.indexOf('data-export-id="2"') < html.indexOf('data-export-id="1"'));
});

test('renderExportList puts the full name in a title, since long names are truncated', () => {
  const longName = 'A'.repeat(200);
  const html = renderExportList([{ ...work, groupName: longName }]);
  assert.match(html, new RegExp(`title="${longName}"`));
});

test('renderExportList shows the message count', () => {
  assert.match(renderExportList([work]), /4,812 messages/);
});

test('renderExportList tags an export that stopped early and keeps the name clean', () => {
  const html = renderExportList([{ ...work, outcome: 'cancelled' }]);
  assert.match(html, /class="name" title="Work">Work</);
  assert.match(html, /class="tag">cancelled</);
  assert.doesNotMatch(renderExportList([work]), /class="tag"/);
});

test('renderExportList gives each export download, copy, and delete buttons carrying its id', () => {
  const html = renderExportList([work]);
  for (const kind of ['download-btn', 'copy-btn', 'delete-btn']) {
    assert.match(html, new RegExp(`<button data-export-id="1" class="icon-btn ${kind}"`));
  }
});

test('renderStatus shows a running export even when this tab has nothing to export', () => {
  // The export may be running in a different tab from the one the popup was opened on.
  const html = renderStatus({ ...idle, status: 'running', count: 5, disabledReason: 'Open a chat on web.whatsapp.com first.' });
  assert.match(html, /id="cancel-btn"/);
  assert.match(html, /class="count">5</);
});
