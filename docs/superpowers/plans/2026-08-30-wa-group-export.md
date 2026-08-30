# WhatsApp Group Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Manifest V3 Chrome extension that exports a WhatsApp Web chat's full message history to a downloadable `.txt` file, driven from the extension popup.

**Architecture:** A content script (`src/content/content.js`) scrolls the open chat to the top while harvesting messages into `chrome.storage.session`; a popup (`src/popup/`) starts the export and renders stored exports with download buttons. All non-trivial logic (parsing, ordering/dedup, filename/date formatting, HTML rendering, storage-state transitions) lives in small pure functions with Node-based unit tests; the two "glue" files (`content.js`, `popup.js`) wire those pure functions to the DOM and `chrome.*` APIs and are verified manually since they require a live WhatsApp Web session.

**Tech Stack:** Vanilla JS, Manifest V3 (`storage`, `downloads` permissions), no build step, no npm dependencies — tests run on Node's built-in `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-30-wa-group-export-design.md`

## Global Constraints

- Line format: `[time] Sender: message` — `time` is WhatsApp's own bracket text (e.g. `14:32, 8/30/2026`, may include the date), verbatim. Lines with no time (system messages) omit the brackets entirely: `Sender: message`.
- Keep everything: system messages ("X joined", etc.) and captionless media are included, never dropped.
- Exports and in-progress status live only in `chrome.storage.session` (clears on browser restart by design — this is the entire "reset every restart" mechanism, no other code needed for it).
- No npm dependencies. No build step. No custom icon.
- No `host_permissions`/`activeTab` beyond the content script's own `matches`.

---

## File Structure

```
manifest.json
package.json                    # "test" script only, zero dependencies
src/
  shared/
    format.js                   # pure: filenames, dates, HTML escaping
    storageState.js              # pure: chrome.storage.session shape + transitions
  content/
    scrape.js                   # pure: parse WhatsApp's data-pre-plain-text, build a line
    accumulate.js                # pure: dedup + chronological ordering across scroll passes
    content.js                   # glue: DOM queries, scroll loop, chrome.storage/messaging
  popup/
    popup.html
    popup.css
    render.js                   # pure: HTML string builders
    popup.js                    # glue: chrome.storage/messaging/downloads, wires render.js
tests/
  format.test.js
  storageState.test.js
  scrape.test.js
  accumulate.test.js
  render.test.js
```

---

### Task 1: Project scaffold, manifest, static popup shell

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`

**Interfaces:**
- Produces: the extension's manifest wiring (permissions, content script registration, web-accessible resources) that every later task relies on; the popup's static DOM structure (element ids) that `popup.js` (Task 8) will query.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "wa-group-export",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "WhatsApp Group Export",
  "version": "1.0.0",
  "description": "Export the full message history of a WhatsApp Web chat to a text file.",
  "permissions": ["storage", "downloads"],
  "action": {
    "default_popup": "src/popup/popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://web.whatsapp.com/*"],
      "js": ["src/content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "src/content/scrape.js",
        "src/content/accumulate.js",
        "src/shared/storageState.js"
      ],
      "matches": ["https://web.whatsapp.com/*"]
    }
  ]
}
```

- [ ] **Step 3: Create `src/popup/popup.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <h1>WhatsApp Group Export</h1>
  <div id="status-area"></div>
  <h2>Exports</h2>
  <div id="export-list"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `src/popup/popup.css`**

```css
:root {
  color-scheme: light dark;
  --accent: #25d366;
  --bg: #ffffff;
  --fg: #1b1b1b;
  --muted: #6b7280;
  --card-bg: #f4f4f5;
  --border: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #202124;
    --fg: #f1f1f1;
    --muted: #9aa0a6;
    --card-bg: #2a2b2e;
    --border: #3c3d40;
  }
}

* { box-sizing: border-box; }

body {
  width: 340px;
  margin: 0;
  padding: 16px;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
}

h1 {
  font-size: 16px;
  margin: 0 0 12px;
}

h2 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin: 16px 0 8px;
}

button.primary {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #06331d;
  font-weight: 600;
  cursor: pointer;
}

button.primary:disabled {
  background: var(--border);
  color: var(--muted);
  cursor: default;
}

.hint {
  color: var(--muted);
  font-size: 12px;
  margin-top: 6px;
}

.progress {
  font-size: 13px;
  color: var(--muted);
}

.error {
  color: #d33;
  font-size: 13px;
}

.empty-state {
  color: var(--muted);
  font-size: 13px;
}

.export-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  margin-bottom: 8px;
}

.export-card .name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-card .date {
  color: var(--muted);
  font-size: 12px;
}

.export-card button {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
```

- [ ] **Step 5: Manual check**

Open `src/popup/popup.html` directly in a browser tab (`file://` path). Confirm the layout renders: title, empty status area, "Exports" heading, empty list area, no console errors (module import errors for the not-yet-created `popup.js` are expected and fine at this point).

- [ ] **Step 6: Commit**

```bash
git add manifest.json package.json src/popup/popup.html src/popup/popup.css
git commit -m "Scaffold extension manifest and static popup shell"
```

---

### Task 2: `src/shared/format.js` — filenames, dates, HTML escaping

**Files:**
- Create: `src/shared/format.js`
- Test: `tests/format.test.js`

**Interfaces:**
- Produces: `sanitizeFilename(name: string): string`, `formatDateISO(date: Date): string`, `buildFilename(groupName: string, date: Date): string`, `formatDateLabel(isoDate: string): string`, `escapeHtml(str: string): string` — used by `popup.js` (Task 8) and `render.js` (Task 6).

- [ ] **Step 1: Write the failing tests**

Create `tests/format.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFilename,
  formatDateISO,
  buildFilename,
  formatDateLabel,
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

test('formatDateLabel renders a readable label from an ISO date', () => {
  assert.equal(formatDateLabel('2026-08-30'), 'Aug 30, 2026');
});

test('escapeHtml escapes the five reserved HTML characters', () => {
  assert.equal(escapeHtml(`<b>"Danny" & 'crew'</b>`), '&lt;b&gt;&quot;Danny&quot; &amp; &#39;crew&#39;&lt;/b&gt;');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/shared/format.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/shared/format.js`:

```js
export function sanitizeFilename(name) {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return /^_*$/.test(cleaned) ? 'chat' : cleaned;
}

export function formatDateISO(date) {
  return date.toISOString().slice(0, 10);
}

export function buildFilename(groupName, date) {
  return `${sanitizeFilename(groupName)}_${formatDateISO(date)}.txt`;
}

export function formatDateLabel(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 7 tests in `format.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add src/shared/format.js tests/format.test.js
git commit -m "Add pure formatting helpers: filenames, dates, HTML escaping"
```

---

### Task 3: `src/shared/storageState.js` — storage-session state transitions

**Files:**
- Create: `src/shared/storageState.js`
- Test: `tests/storageState.test.js`

**Interfaces:**
- Consumes: nothing (pure, operates on plain objects).
- Produces: `initialState(): State`, `startRunning(state: State): State`, `updateProgress(state: State, count: number): State`, `completeExport(state: State, entry: {id: string, groupName: string, date: string, text: string}): State`, `failExport(state: State, message: string): State`, where `State = { status: 'idle'|'running'|'done'|'error', count: number, error: string|null, exports: Array<{id, groupName, date, text}> }`. Consumed by `content.js` (Task 7) and `popup.js` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `tests/storageState.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  startRunning,
  updateProgress,
  completeExport,
  failExport,
} from '../src/shared/storageState.js';

test('initialState starts idle with no exports', () => {
  assert.deepEqual(initialState(), { status: 'idle', count: 0, error: null, exports: [] });
});

test('startRunning resets count and error, keeps existing exports', () => {
  const state = { status: 'error', count: 12, error: 'boom', exports: [{ id: '1' }] };
  assert.deepEqual(startRunning(state), {
    status: 'running',
    count: 0,
    error: null,
    exports: [{ id: '1' }],
  });
});

test('updateProgress only touches count', () => {
  const state = { status: 'running', count: 0, error: null, exports: [] };
  assert.deepEqual(updateProgress(state, 47), { status: 'running', count: 47, error: null, exports: [] });
});

test('completeExport prepends the new export and resets to idle-ready done state', () => {
  const state = { status: 'running', count: 200, error: null, exports: [{ id: 'old' }] };
  const entry = { id: 'new', groupName: 'Family', date: '2026-08-30', text: 'line1\nline2' };
  assert.deepEqual(completeExport(state, entry), {
    status: 'done',
    count: 0,
    error: null,
    exports: [entry, { id: 'old' }],
  });
});

test('failExport records the error and keeps existing exports', () => {
  const state = { status: 'running', count: 5, error: null, exports: [{ id: 'old' }] };
  assert.deepEqual(failExport(state, 'no chat open'), {
    status: 'error',
    count: 5,
    error: 'no chat open',
    exports: [{ id: 'old' }],
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/shared/storageState.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/shared/storageState.js`:

```js
export function initialState() {
  return { status: 'idle', count: 0, error: null, exports: [] };
}

export function startRunning(state) {
  return { ...state, status: 'running', count: 0, error: null };
}

export function updateProgress(state, count) {
  return { ...state, count };
}

export function completeExport(state, entry) {
  return {
    ...state,
    status: 'done',
    count: 0,
    error: null,
    exports: [entry, ...state.exports],
  };
}

export function failExport(state, message) {
  return { ...state, status: 'error', error: message };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 5 tests in `storageState.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add src/shared/storageState.js tests/storageState.test.js
git commit -m "Add pure storage-session state transitions"
```

---

### Task 4: `src/content/scrape.js` — parse WhatsApp's timestamp attribute, build a line

**Files:**
- Create: `src/content/scrape.js`
- Test: `tests/scrape.test.js`

**Interfaces:**
- Produces: `parsePrePlainText(raw: string): {time: string, sender: string} | null`, `buildLine({time: string|null, sender: string, text: string}): string`. Consumed by `content.js` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `tests/scrape.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/content/scrape.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/content/scrape.js`:

```js
const PRE_PLAIN_TEXT_RE = /^\[(.+?)\]\s*(.*):\s*$/s;

export function parsePrePlainText(raw) {
  const match = PRE_PLAIN_TEXT_RE.exec(raw);
  if (!match) return null;
  return { time: match[1], sender: match[2] };
}

export function buildLine({ time, sender, text }) {
  return time ? `[${time}] ${sender}: ${text}` : `${sender}: ${text}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 5 tests in `scrape.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add src/content/scrape.js tests/scrape.test.js
git commit -m "Add pure WhatsApp timestamp parsing and line formatting"
```

---

### Task 5: `src/content/accumulate.js` — dedup and chronological ordering across scroll passes

**Files:**
- Create: `src/content/accumulate.js`
- Test: `tests/accumulate.test.js`

**Interfaces:**
- Produces: `createAccumulator(): Accumulator`, `addPass(accumulator: Accumulator, rows: Array<{id: string, line: string}>): {accumulator: Accumulator, addedCount: number}`, `getText(accumulator: Accumulator): string`, where `Accumulator = { seenIds: Set<string>, lines: string[] }`. Consumed by `content.js` (Task 7). `rows` must be given in top-to-bottom DOM order (oldest-to-newest within that pass).

- [ ] **Step 1: Write the failing tests**

Create `tests/accumulate.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccumulator, addPass, getText } from '../src/content/accumulate.js';

test('first pass records all rows in given order', () => {
  const acc = createAccumulator();
  const { accumulator, addedCount } = addPass(acc, [
    { id: 'a', line: 'A: hi' },
    { id: 'b', line: 'B: hey' },
  ]);
  assert.equal(addedCount, 2);
  assert.deepEqual(accumulator.lines, ['A: hi', 'B: hey']);
});

test('a later pass prepends newly-revealed older rows and skips already-seen ones', () => {
  const first = addPass(createAccumulator(), [
    { id: 'b', line: 'B: hey' },
    { id: 'c', line: 'C: yo' },
  ]);
  const second = addPass(first.accumulator, [
    { id: 'a', line: 'A: hi' }, // newly revealed, older
    { id: 'b', line: 'B: hey' }, // already seen
    { id: 'c', line: 'C: yo' }, // already seen
  ]);
  assert.equal(second.addedCount, 1);
  assert.deepEqual(second.accumulator.lines, ['A: hi', 'B: hey', 'C: yo']);
});

test('a pass with nothing new reports zero added and leaves lines unchanged', () => {
  const first = addPass(createAccumulator(), [{ id: 'a', line: 'A: hi' }]);
  const second = addPass(first.accumulator, [{ id: 'a', line: 'A: hi' }]);
  assert.equal(second.addedCount, 0);
  assert.deepEqual(second.accumulator.lines, ['A: hi']);
});

test('getText joins lines with newlines', () => {
  const { accumulator } = addPass(createAccumulator(), [
    { id: 'a', line: 'A: hi' },
    { id: 'b', line: 'B: hey' },
  ]);
  assert.equal(getText(accumulator), 'A: hi\nB: hey');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/content/accumulate.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/content/accumulate.js`:

```js
export function createAccumulator() {
  return { seenIds: new Set(), lines: [] };
}

export function addPass(accumulator, rows) {
  const newRows = rows.filter((row) => !accumulator.seenIds.has(row.id));
  const seenIds = new Set(accumulator.seenIds);
  for (const row of newRows) seenIds.add(row.id);
  const lines = [...newRows.map((row) => row.line), ...accumulator.lines];
  return { accumulator: { seenIds, lines }, addedCount: newRows.length };
}

export function getText(accumulator) {
  return accumulator.lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 4 tests in `accumulate.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add src/content/accumulate.js tests/accumulate.test.js
git commit -m "Add pure dedup/ordering accumulator for scroll passes"
```

---

### Task 6: `src/popup/render.js` — HTML string builders

**Files:**
- Create: `src/popup/render.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `escapeHtml` from `../shared/format.js` (Task 2), `formatDateLabel` from `../shared/format.js` (Task 2).
- Produces: `renderStatus({status, count, error, disabledReason}): string`, `renderExportList(exports: Array<{id, groupName, date}>): string`. Consumed by `popup.js` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `tests/render.test.js`:

```js
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

test('renderExportList shows an empty state with no exports', () => {
  assert.match(renderExportList([]), /class="empty-state"/);
});

test('renderExportList renders one card per export, newest first order preserved, with escaped names', () => {
  const html = renderExportList([
    { id: '2', groupName: '<Family>', date: '2026-08-30' },
    { id: '1', groupName: 'Work', date: '2026-08-29' },
  ]);
  assert.match(html, /&lt;Family&gt;/);
  assert.match(html, /Aug 30, 2026/);
  assert.match(html, /data-export-id="2"/);
  assert.match(html, /Aug 29, 2026/);
  assert.match(html, /data-export-id="1"/);
  assert.ok(html.indexOf('data-export-id="2"') < html.indexOf('data-export-id="1"'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/popup/render.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/popup/render.js`:

```js
import { escapeHtml, formatDateLabel } from '../shared/format.js';

export function renderStatus({ status, count, error, disabledReason }) {
  if (disabledReason) {
    return `
      <button class="primary" id="export-btn" disabled>Export this group</button>
      <div class="hint">${escapeHtml(disabledReason)}</div>
    `;
  }
  if (status === 'running') {
    return `
      <button class="primary" id="export-btn" disabled>Exporting…</button>
      <div class="progress">Scanning… ${count} messages found</div>
    `;
  }
  if (status === 'error') {
    return `
      <button class="primary" id="export-btn">Export this group</button>
      <div class="error">${escapeHtml(error)}</div>
    `;
  }
  return `<button class="primary" id="export-btn">Export this group</button>`;
}

export function renderExportList(exports) {
  if (exports.length === 0) {
    return `<div class="empty-state">No exports yet.</div>`;
  }
  return exports
    .map(
      (item) => `
      <div class="export-card">
        <div>
          <div class="name">${escapeHtml(item.groupName)}</div>
          <div class="date">${formatDateLabel(item.date)}</div>
        </div>
        <button data-export-id="${escapeHtml(item.id)}" class="download-btn">Download</button>
      </div>
    `,
    )
    .join('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 6 tests in `render.test.js` green.

- [ ] **Step 5: Commit**

```bash
git add src/popup/render.js tests/render.test.js
git commit -m "Add pure popup HTML rendering functions"
```

---

### Task 7: `src/content/content.js` — scroll loop, DOM scraping, storage wiring

**Files:**
- Create: `src/content/content.js`

**Interfaces:**
- Consumes (via dynamic `import(chrome.runtime.getURL(...))`, since content scripts are classic scripts): `parsePrePlainText`, `buildLine` from `./scrape.js` (Task 4); `createAccumulator`, `addPass`, `getText` from `./accumulate.js` (Task 5); `initialState`, `startRunning`, `updateProgress`, `completeExport`, `failExport` from `../shared/storageState.js` (Task 3).
- Produces: a `chrome.runtime.onMessage` listener responding to `{ action: 'startExport' }`; writes `{ waState: State }` to `chrome.storage.session` (same `State` shape as Task 3).

This task has no automated test — it requires a live WhatsApp Web DOM and `chrome.*` runtime, neither of which exist under Node. It ends with a manual verification checklist instead.

- [ ] **Step 1: Write the implementation**

Create `src/content/content.js`:

```js
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
    date: new Date().toISOString().slice(0, 10),
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
```

- [ ] **Step 2: Manual verification**

This step cannot be automated in this environment (no access to your logged-in WhatsApp Web session). After the whole extension is built (end of Task 8), you will load it as an unpacked extension and test it live — see the "End-to-end verification" checklist at the end of this plan. Come back and adjust the selectors in `findMessagePane`/`findGroupName`/`readRow` if that checklist finds WhatsApp's DOM doesn't match (WhatsApp changes internal class names periodically; `data-id`, `data-pre-plain-text`, and `data-testid` attributes are the most stable anchors and are what this code relies on).

- [ ] **Step 3: Commit**

```bash
git add src/content/content.js
git commit -m "Add content script: scroll loop, DOM scraping, storage wiring"
```

---

### Task 8: `src/popup/popup.js` — wire the popup to storage, messaging, and downloads

**Files:**
- Create: `src/popup/popup.js`

**Interfaces:**
- Consumes: `renderStatus`, `renderExportList` from `./render.js` (Task 6); `buildFilename` from `../shared/format.js` (Task 2); `initialState` from `../shared/storageState.js` (Task 3).
- Produces: the wired popup — clicking "Export this group" messages the active tab's content script; clicking a card's Download button saves that export's text as a `.txt` file.

No automated test (requires the real `chrome.*` popup runtime). Verified manually as part of the end-to-end checklist below.

- [ ] **Step 1: Write the implementation**

Create `src/popup/popup.js`:

```js
import { renderStatus, renderExportList } from './render.js';
import { buildFilename } from '../shared/format.js';
import { initialState } from '../shared/storageState.js';

const statusArea = document.getElementById('status-area');
const exportList = document.getElementById('export-list');

let activeTabId = null;
let disabledReason = null;

function render(state) {
  statusArea.innerHTML = renderStatus({ ...state, disabledReason });
  exportList.innerHTML = renderExportList(state.exports);

  const exportBtn = document.getElementById('export-btn');
  if (exportBtn && !exportBtn.disabled) {
    exportBtn.addEventListener('click', () => {
      chrome.tabs.sendMessage(activeTabId, { action: 'startExport' });
    });
  }

  for (const btn of exportList.querySelectorAll('.download-btn')) {
    btn.addEventListener('click', () => {
      const entry = state.exports.find((item) => item.id === btn.dataset.exportId);
      if (!entry) return;
      const blob = new Blob([entry.text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        filename: buildFilename(entry.groupName, new Date(`${entry.date}T00:00:00`)),
        saveAs: false,
      });
    });
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab && tab.id;
  disabledReason = tab && tab.url && tab.url.startsWith('https://web.whatsapp.com/')
    ? null
    : 'Open a chat on web.whatsapp.com first.';

  const { waState } = await chrome.storage.session.get('waState');
  render(waState || initialState());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.waState) {
      render(changes.waState.newValue || initialState());
    }
  });
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.js
git commit -m "Wire popup to storage, messaging, and downloads"
```

---

## End-to-end verification (manual, run after Task 8)

Automated tests cover every pure function (parsing, ordering, formatting, rendering, state transitions) — 27 tests across 5 files. The two glue files (`content.js`, `popup.js`) touch a live WhatsApp Web session and the real `chrome.*` extension runtime, which can't be exercised under Node, so verify them by hand:

- [ ] Run `npm test` one final time — all tests pass.
- [ ] Open `chrome://extensions`, enable Developer mode, "Load unpacked", select this project folder. Confirm it loads with no errors.
- [ ] Open `web.whatsapp.com`, open any chat with some history.
- [ ] Click the extension icon. Confirm the button reads "Export this group" (enabled).
- [ ] Click it. Confirm the button switches to "Exporting…" and the message count climbs.
- [ ] Wait for it to finish (count stops climbing, a card appears under "Exports" with the chat's name and today's date).
- [ ] Click Download. Confirm a `.txt` file downloads named `<ChatName>_<date>.txt`, and its contents look right: one `[time] Sender: message` line per message, oldest at the top, newest at the bottom, system/media lines present.
- [ ] Repeat for a second, different chat. Confirm both exports are now listed, newest first.
- [ ] Close and reopen the popup mid-export on a large chat (if you have one) — confirm progress is still shown correctly on reopen.
- [ ] Restart Chrome. Open the popup again — confirm the export list is empty again.
- [ ] If message counts come back as 0 or the group name is missing, WhatsApp's DOM has likely drifted — open DevTools on a message element, find its nearest ancestor with a `data-id` attribute, and update the selectors in `findMessagePane`/`findGroupName`/`readRow` in `src/content/content.js` accordingly.
