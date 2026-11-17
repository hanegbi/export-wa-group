// Everything that knows what WhatsApp Web's page looks like and how it
// behaves when scrolled. WhatsApp's markup shifts between releases; when it
// does, this is the file to fix.
import { parsePrePlainText, buildLine, looksLikeLoadOlderPrompt } from './scrape.js';
import { getDateFieldOrder } from './timestamp.js';

const POLL_MS = 250;
// After a change is spotted, give WhatsApp a moment to finish rendering the
// rest of the batch before reading it.
const SETTLE_MS = 150;
const NUDGE_PX = 300;
const NUDGE_SETTLE_MS = 120;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findMessagePane() {
  const candidates = [
    'div[data-testid="conversation-panel-messages"]',
    '#main div.copyable-area [role="application"]',
    '#main div.copyable-area',
  ];
  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function findChatName() {
  const header = document.querySelector('#main header');
  if (!header) return null;
  // The header's clickable wrapper carries an accessibility title like
  // "Click here for group info" on a span too, so a bare span[title]
  // match grabs that instead of the name. dir="auto" reliably marks
  // actual user-generated text (names, messages) in WhatsApp Web, so
  // scope to that first and only fall back to any titled span.
  const nameEl = header.querySelector('span[dir="auto"][title]') || header.querySelector('span[dir="auto"]');
  if (nameEl) return (nameEl.getAttribute('title') || nameEl.innerText).trim();
  const titleEl = header.querySelector('span[title]');
  return titleEl ? titleEl.getAttribute('title') : null;
}

// Returns { pane, name } for the chat on screen, or null if none is open.
export function findOpenChat() {
  const pane = findMessagePane();
  const name = findChatName();
  return pane && name ? { pane, name } : null;
}

// The message pane is not guaranteed to be the element that actually scrolls,
// and setting scrollTop on a non-scrolling element silently does nothing.
// Walk up from a message row to the nearest ancestor that really scrolls.
// `root` is the element to search for rows and buttons: the pane, or the
// scroller when that turned out to be outside the pane.
export function findScrollArea(pane) {
  const main = document.querySelector('#main');
  const start = pane.querySelector('div[data-id]') || pane;
  for (let el = start; el && el !== main && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return { scroller: el, root: pane.contains(el) ? pane : el };
    }
  }
  return { scroller: pane, root: pane };
}

function findMessageRows(root) {
  return Array.from(root.querySelectorAll('div[data-id]'));
}

// WhatsApp only keeps a limited local history and shows a clickable
// "Click here to get your older messages from your phone" prompt once
// that runs out; scrolling alone won't fetch past it, it must be clicked.
export function findLoadOlderButton(root) {
  const candidates = root.querySelectorAll('[role="button"], button');
  for (const el of candidates) {
    if (!el.closest('[data-id]') && looksLikeLoadOlderPrompt(el.innerText || '')) {
      return el;
    }
  }
  return null;
}

function readRow(row, id, fieldOrder) {
  const isSystem = row.className.includes('system') || Boolean(row.querySelector('[data-testid="msg-system"]'));
  if (isSystem) {
    const text = row.innerText.trim();
    if (!text) return null;
    return { id, line: buildLine({ time: null, sender: 'System', text }), date: null };
  }

  const textEl = row.querySelector('.copyable-text[data-pre-plain-text]');
  if (textEl) {
    const parsed = parsePrePlainText(textEl.getAttribute('data-pre-plain-text'), fieldOrder);
    const bodyEl = textEl.querySelector('span.selectable-text') || textEl;
    const text = bodyEl.innerText.trim() || '[media]';
    if (!parsed) return { id, line: buildLine({ time: null, sender: 'Unknown', text }), date: null };
    return { id, line: buildLine({ time: parsed.time, sender: parsed.sender, text }), date: parsed.date };
  }

  // Media with no caption: no copyable-text element at all.
  const fallbackText = row.innerText.trim() || '[media]';
  return { id, line: buildLine({ time: null, sender: 'Unknown', text: fallbackText }), date: null };
}

// Returns a function that reads every row under `root`, oldest first, as
// { id, line, date }. It
// remembers rows between calls: re-reading innerText for the whole
// (ever-growing) DOM on every pass forces layout each time and makes long
// chats crawl.
export function createRowReader() {
  const fieldOrder = getDateFieldOrder(navigator.language);
  const cache = new Map();

  return function readRows(root) {
    const rows = [];
    for (const el of findMessageRows(root)) {
      const id = el.getAttribute('data-id');
      if (!id) continue;
      let entry = cache.get(id);
      if (!entry) {
        entry = readRow(el, id, fieldOrder);
        // Not cached when unreadable, so a row that hasn't finished rendering
        // gets another chance on the next pass.
        if (!entry) continue;
        cache.set(id, entry);
      }
      rows.push(entry);
    }
    return rows;
  };
}

// Works for both a normal scroller (top is scrollTop 0) and a
// column-reverse one (top is the most negative scrollTop): the browser
// clamps this to whichever end is the top.
function jumpToTop(scroller) {
  scroller.scrollTop = -scroller.scrollHeight;
}

// WhatsApp loads older history in response to scroll events near the top.
// If the pane is already at the top, jumping there again moves nothing and
// fires no event, so a load that stalled never gets retried. Do what a
// person does: scroll down a little, then back up.
export async function scrollToTop(scroller) {
  const before = scroller.scrollTop;
  jumpToTop(scroller);
  if (scroller.scrollTop !== before) return;
  scroller.scrollTop = before + NUDGE_PX;
  await sleep(NUDGE_SETTLE_MS);
  jumpToTop(scroller);
}

function paneSignature(root, scroller) {
  const rows = findMessageRows(root);
  const firstId = rows.length > 0 ? rows[0].getAttribute('data-id') : '';
  return `${scroller.scrollHeight}|${rows.length}|${firstId}`;
}

// Resolves as soon as the pane changes (new rows, new height), after maxMs
// if nothing does, or when shouldStop() turns true.
export async function waitForPaneChange({ root, scroller }, maxMs, shouldStop) {
  const before = paneSignature(root, scroller);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline && !shouldStop()) {
    await sleep(POLL_MS);
    if (paneSignature(root, scroller) !== before) {
      await sleep(SETTLE_MS);
      return;
    }
  }
}

// The popup's chrome.downloads API is not available to content scripts.
export function downloadTextFile(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
}
