// How often to look for newly rendered rows after scrolling, and the longest
// a single pass waits before scrolling again. Whether the export is *done*
// is not decided here — see loadWatch.js.
const POLL_MS = 250;
const STEP_WAIT_MS = 1500;
// After a change is spotted, give WhatsApp a moment to finish rendering the
// rest of the batch before reading it.
const SETTLE_MS = 150;
const NUDGE_PX = 300;
const NUDGE_SETTLE_MS = 120;
const OLDER_CLICK_EVERY_MS = 10 * 1000;
// Safety net only. Long chats legitimately take a long time; the real stop
// condition is the chat going quiet.
const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000;

let cancelRequested = false;
let running = false;

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

// The element matched by findMessagePane is not guaranteed to be the one
// that actually scrolls (WhatsApp's markup shifts between releases), and
// setting scrollTop on a non-scrolling element silently does nothing. Walk
// up from a message row to the nearest ancestor that really scrolls.
function findScroller(pane) {
  const main = document.querySelector('#main');
  const start = pane.querySelector('div[data-id]') || pane;
  for (let el = start; el && el !== main && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return pane;
}

function findGroupName() {
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

function findMessageRows(root) {
  return Array.from(root.querySelectorAll('div[data-id]'));
}

// WhatsApp only keeps a limited local history and shows a clickable
// "Click here to get your older messages from your phone" prompt once
// that runs out; scrolling alone won't fetch past it, it must be clicked.
function findLoadOlderMessagesButton(root, looksLikeLoadOlderPrompt) {
  const candidates = root.querySelectorAll('[role="button"], button');
  for (const el of candidates) {
    if (!el.closest('[data-id]') && looksLikeLoadOlderPrompt(el.innerText || '')) {
      return el;
    }
  }
  return null;
}

function readRow(row, { parsePrePlainText, buildLine, parseWhatsAppTimestamp, fieldOrder }) {
  const id = row.getAttribute('data-id');
  if (!id) return null;

  const isSystem = row.className.includes('system') || Boolean(row.querySelector('[data-testid="msg-system"]'));
  if (isSystem) {
    const text = row.innerText.trim();
    if (!text) return null;
    return { id, line: buildLine({ time: null, sender: 'System', text }), date: null };
  }

  const textEl = row.querySelector('.copyable-text[data-pre-plain-text]');
  if (textEl) {
    const rawPrePlainText = textEl.getAttribute('data-pre-plain-text');
    const parsed = parsePrePlainText(rawPrePlainText);
    const bodyEl = textEl.querySelector('span.selectable-text') || textEl;
    const text = bodyEl.innerText.trim() || '[media]';
    if (!parsed) return { id, line: buildLine({ time: null, sender: 'Unknown', text }), date: null };
    const date = parseWhatsAppTimestamp(rawPrePlainText, fieldOrder);
    return { id, line: buildLine({ time: parsed.time, sender: parsed.sender, text }), date };
  }

  // Media with no caption: no copyable-text element at all.
  const fallbackText = row.innerText.trim() || '[media]';
  return { id, line: buildLine({ time: null, sender: 'Unknown', text: fallbackText }), date: null };
}

// Reads every row in the DOM, oldest first. Rows parsed on an earlier pass
// come from the cache: re-reading innerText for the whole (ever-growing)
// DOM on every pass forces layout each time and makes long chats crawl.
function harvestRows(root, rowCache, readOpts) {
  const rows = [];
  let newRowCount = 0;
  for (const el of findMessageRows(root)) {
    const id = el.getAttribute('data-id');
    if (!id) continue;
    let entry = rowCache.get(id);
    if (!entry) {
      entry = readRow(el, readOpts);
      // Not cached when unreadable, so a row that hasn't finished rendering
      // gets another chance on the next pass.
      if (!entry) continue;
      rowCache.set(id, entry);
      newRowCount += 1;
    }
    rows.push(entry);
  }
  return { rows, newRowCount };
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
async function scrollToTop(scroller) {
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

// Returns as soon as the pane changes (new rows, new height), or after
// maxMs if nothing does.
async function waitForPaneChange(root, scroller, maxMs) {
  const before = paneSignature(root, scroller);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline && !cancelRequested) {
    await sleep(POLL_MS);
    if (paneSignature(root, scroller) !== before) {
      await sleep(SETTLE_MS);
      return;
    }
  }
}

function downloadTextFile(filename, text) {
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

async function getState(initialState) {
  const { waState } = await chrome.storage.session.get('waState');
  return waState || initialState();
}

async function exportChat({ from, to }) {
  const base = chrome.runtime.getURL('src/content');
  const { parsePrePlainText, buildLine, looksLikeLoadOlderPrompt } = await import(`${base}/scrape.js`);
  const { createAccumulator, addPass, getText } = await import(`${base}/accumulate.js`);
  const { getDateFieldOrder, parseWhatsAppTimestamp, isWithinRange } = await import(`${base}/timestamp.js`);
  const { createLoadWatch, recordPass, resetQuiet, msUntilGiveUp, waitNote } = await import(`${base}/loadWatch.js`);
  const { initialState, startRunning, updateProgress, completeExport, finishWithNotice, failExport, persistState } = await import(
    chrome.runtime.getURL('src/shared/storageState.js')
  );
  const { buildFilename } = await import(chrome.runtime.getURL('src/shared/format.js'));

  let state = await getState(initialState);

  // The popup can delete exports while this runs; pick up its list before
  // each write so a stale copy held here doesn't resurrect them.
  async function withCurrentExports(current) {
    const { waState } = await chrome.storage.session.get('waState');
    return waState ? { ...current, exports: waState.exports } : current;
  }

  const pane = findMessagePane();
  const groupName = findGroupName();
  if (!pane || !groupName) {
    state = failExport(state, 'Open a chat on web.whatsapp.com first.');
    await persistState(state);
    return;
  }

  state = startRunning(state);
  await persistState(state);

  try {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const fieldOrder = getDateFieldOrder(navigator.language);
    const readOpts = { parsePrePlainText, buildLine, parseWhatsAppTimestamp, fieldOrder };

    let accumulator = createAccumulator();
    const rowCache = new Map();
    let stopReason = null;
    let lastReported = null;
    let lastOlderClickAt = 0;
    let lastTick = Date.now();
    let activeMs = 0;
    let watch = createLoadWatch(lastTick);

    while (true) {
      if (cancelRequested) {
        stopReason = 'cancelled';
        break;
      }

      const now = Date.now();
      // A hidden tab doesn't render, so WhatsApp can't load anything and
      // timers are throttled. Keep trying, but never let hidden time count
      // toward "the chat has gone quiet" or toward the runtime cap.
      const hidden = document.hidden;
      if (hidden) watch = resetQuiet(watch, now);
      else activeMs += now - lastTick;
      lastTick = now;
      if (activeMs >= MAX_RUNTIME_MS) {
        stopReason = 'timeout';
        break;
      }

      const scroller = findScroller(pane);
      const root = pane.contains(scroller) ? pane : scroller;

      const { rows, newRowCount } = harvestRows(root, rowCache, readOpts);
      const result = addPass(
        accumulator,
        rows.filter((row) => isWithinRange(row.date, fromDate, toDate)),
      );
      accumulator = result.accumulator;
      watch = recordPass(watch, { now, newRowCount, scrollHeight: scroller.scrollHeight });

      const pastCutoff = Boolean(toDate) && rows.some((row) => row.date && row.date < toDate);
      if (pastCutoff) break;

      const olderBtn = findLoadOlderMessagesButton(root, looksLikeLoadOlderPrompt);
      // Click again right away after a batch arrives; otherwise leave the
      // phone time to answer before re-clicking.
      if (olderBtn && (newRowCount > 0 || now - lastOlderClickAt >= OLDER_CLICK_EVERY_MS)) {
        olderBtn.click();
        lastOlderClickAt = now;
      }

      const waitingOnPhone = Boolean(olderBtn);
      const remainingMs = msUntilGiveUp(watch, now, { waitingOnPhone });
      if (!hidden && remainingMs === 0) break;

      const count = accumulator.lines.length;
      const note = waitNote({ hidden, waitingOnPhone, quietMs: now - watch.lastActivityAt, remainingMs });
      if (`${count}|${note}` !== lastReported) {
        lastReported = `${count}|${note}`;
        try {
          state = updateProgress(await withCurrentExports(state), count, note);
          await persistState(state);
        } catch (err) {
          // Non-fatal: a stalled live counter isn't worth aborting a long
          // scroll over. The final save below is what actually matters.
          console.warn('WhatsApp Group Export: failed to persist progress, continuing', err);
        }
      }

      await scrollToTop(scroller);
      await waitForPaneChange(root, scroller, STEP_WAIT_MS);
    }

    const suffix = stopReason === 'timeout' ? ' (partial)' : stopReason === 'cancelled' ? ' (cancelled)' : '';
    const entry = {
      id: `${Date.now()}`,
      groupName: `${groupName}${suffix}`,
      date: new Date().toISOString(),
      text: getText(accumulator),
      lineCount: accumulator.lines.length,
    };

    state = await withCurrentExports(state);
    try {
      await persistState(completeExport(state, entry));
    } catch (err) {
      // Most likely the ~10MB session-storage quota: a long chat's text
      // doesn't fit in the popup's list. Never throw the scraped history
      // away over that — hand the file straight to the browser instead.
      console.warn('WhatsApp Group Export: could not store the export, downloading it directly', err);
      const filename = buildFilename(entry.groupName, new Date(entry.date));
      downloadTextFile(filename, entry.text);
      await persistState(
        finishWithNotice(state, `Too large to keep in this list, so it was saved to your Downloads folder as "${filename}".`),
      );
    }
  } catch (err) {
    // Whatever broke — a full storage quota, an unexpected DOM change,
    // anything — the popup must never see "Exporting…" hang forever.
    state = failExport(state, `Export failed: ${err.message || err}`);
    await persistState(state).catch((persistErr) => {
      console.error('WhatsApp Group Export: failed to persist the failure state itself', persistErr);
    });
  }
}

async function runExport(range = {}) {
  if (running) return;
  running = true;
  cancelRequested = false;
  try {
    await exportChat(range);
  } finally {
    running = false;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.action === 'startExport') {
    runExport({ from: message.from, to: message.to });
    sendResponse({ started: true });
  } else if (message && message.action === 'cancelExport') {
    cancelRequested = true;
    sendResponse({ cancelled: true });
  } else if (message && message.action === 'checkChatOpen') {
    const groupName = findGroupName();
    sendResponse({ hasChat: Boolean(findMessagePane() && groupName), groupName, running });
  }
  return false;
});
