const SCROLL_WAIT_MS = 700;
const MAX_STALE_PASSES = 4;
const MAX_RUNTIME_MS = 20 * 60 * 1000;

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

function findMessageRows(pane) {
  return Array.from(pane.querySelectorAll('div[data-id]'));
}

function readRow(row, parsePrePlainText, buildLine) {
  const id = row.getAttribute('data-id');
  if (!id) return null;

  const isSystem = row.className.includes('system') || Boolean(row.querySelector('[data-testid="msg-system"]'));
  if (isSystem) {
    const text = row.innerText.trim();
    if (!text) return null;
    return { id, line: buildLine({ time: null, sender: 'System', text }) };
  }

  const textEl = row.querySelector('.copyable-text[data-pre-plain-text]');
  if (textEl) {
    const parsed = parsePrePlainText(textEl.getAttribute('data-pre-plain-text'));
    const bodyEl = textEl.querySelector('span.selectable-text') || textEl;
    const text = bodyEl.innerText.trim() || '[media]';
    if (!parsed) return { id, line: buildLine({ time: null, sender: 'Unknown', text }) };
    return { id, line: buildLine({ time: parsed.time, sender: parsed.sender, text }) };
  }

  // Media with no caption: no copyable-text element at all.
  const fallbackText = row.innerText.trim() || '[media]';
  return { id, line: buildLine({ time: null, sender: 'Unknown', text: fallbackText }) };
}

async function setState(state) {
  await chrome.storage.session.set({ waState: state });
}

async function getState(initialState) {
  const { waState } = await chrome.storage.session.get('waState');
  return waState || initialState();
}

async function runExport() {
  const base = chrome.runtime.getURL('src/content');
  const { parsePrePlainText, buildLine } = await import(`${base}/scrape.js`);
  const { createAccumulator, addPass, getText } = await import(`${base}/accumulate.js`);
  const { initialState, startRunning, updateProgress, completeExport, failExport } = await import(
    chrome.runtime.getURL('src/shared/storageState.js')
  );

  let state = await getState(initialState);

  const pane = findMessagePane();
  const groupName = findGroupName();
  if (!pane || !groupName) {
    state = failExport(state, 'Open a chat on web.whatsapp.com first.');
    await setState(state);
    return;
  }

  state = startRunning(state);
  await setState(state);

  let accumulator = createAccumulator();
  let stalePasses = 0;
  let lastScrollHeight = -1;
  const startTime = Date.now();

  while (stalePasses < MAX_STALE_PASSES && Date.now() - startTime < MAX_RUNTIME_MS) {
    const rows = findMessageRows(pane)
      .map((row) => readRow(row, parsePrePlainText, buildLine))
      .filter(Boolean);

    const result = addPass(accumulator, rows);
    accumulator = result.accumulator;

    state = updateProgress(state, accumulator.lines.length);
    await setState(state);

    const heightUnchanged = pane.scrollHeight === lastScrollHeight;
    stalePasses = result.addedCount === 0 && heightUnchanged ? stalePasses + 1 : 0;
    lastScrollHeight = pane.scrollHeight;

    pane.scrollTop = 0;
    await sleep(SCROLL_WAIT_MS);
  }

  const reachedTop = stalePasses >= MAX_STALE_PASSES;
  const entry = {
    id: `${Date.now()}`,
    groupName: reachedTop ? groupName : `${groupName} (partial)`,
    date: new Date().toISOString(),
    text: getText(accumulator),
  };
  state = completeExport(state, entry);
  await setState(state);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.action === 'startExport') {
    runExport();
    sendResponse({ started: true });
  }
  return false;
});
