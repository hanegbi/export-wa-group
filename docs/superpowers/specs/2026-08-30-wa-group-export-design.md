# WhatsApp Group Export — Design

## Purpose
A Chrome extension (Manifest V3) that exports the full message history of
whichever WhatsApp Web chat is currently open, as a plain-text file the user
can download from the extension's popup.

## User flow
1. User opens a chat on `web.whatsapp.com`, clicks the extension icon.
2. Popup shows a list of previous exports (name, date, Download button) plus
   an "Export this group" button.
3. Clicking the button starts extraction in the open tab. Popup shows live
   progress ("Scanning… N messages found"). Closing the popup does not stop
   extraction — it continues in the tab.
4. When done, a new entry appears at the top of the list. User clicks
   Download to save the `.txt` file.
5. The list persists across popup open/close, and clears when Chrome is
   restarted (no explicit "reset" action needed).

## Architecture
No background service worker. Three pieces:
- `content.js` — content script matched on `https://web.whatsapp.com/*`.
  Idle until messaged; performs the scroll-and-scrape; writes progress and
  results to `chrome.storage.session`.
- `popup.html` / `popup.js` / `popup.css` — renders state from
  `chrome.storage.session`, listens to `chrome.storage.onChanged` for live
  updates, sends the start message, handles downloads.
- `chrome.storage.session` — source of truth for `waExports` (array of
  `{id, groupName, date, text}`) and `waExportStatus`
  (`idle | running | done | error`, plus a live message count). Session
  storage is wiped on browser restart by design, which satisfies the
  "reset every restart" requirement with no extra code.

Permissions: `storage`, `downloads`, `activeTab`. Content script `matches`
covers `web.whatsapp.com` for injection; `activeTab` is what lets the
popup read the active tab's URL (to know whether to enable the export
button) when the user invokes the extension. No custom icon (default
puzzle icon) — can be added later if wanted.

## Extraction algorithm
WhatsApp Web virtualizes the message list: messages scrolled out of view are
removed from the DOM. So the script harvests while scrolling, rather than
scrolling first and reading after:

1. Locate the chat header to read the group/contact name, and the scrollable
   message pane.
2. Loop:
   a. Read every message row currently in the DOM. Each row has a unique
      `data-id` attribute — used to dedupe against previously-seen rows.
   b. For each newly-seen row, parse it immediately (see below) and prepend
      the parsed line to the accumulated result array — new rows found while
      scrolling up are always older than what's already accumulated, so
      prepending keeps the final file in oldest→newest order.
   c. Update `waExportStatus` message count for live popup progress.
   d. Scroll the real scrolling ancestor to its top to trigger WhatsApp's
      lazy-load of older history. If it was already at the top, scroll
      down a little first and back up, since assigning the same scrollTop
      fires no scroll event and a stalled load would never be retried.
      Then poll until the pane changes (new rows or a taller scrollHeight)
      or a short step timeout passes.
   e. Stop only when the chat has been quiet — no never-seen rows, no new
      record scrollHeight — for a full minute (three while the
      "get older messages from your phone" prompt is showing). A single
      batch from WhatsApp can take tens of seconds, so a few quiet passes
      prove nothing. Time while the tab is hidden never counts as quiet:
      a hidden tab doesn't render, so WhatsApp can't load. A hard time cap
      (hours) remains as a safety net; the export is still saved and
      flagged as partial if it hits.
3. Row parsing:
   - Regular messages: the `data-pre-plain-text` attribute (e.g.
     `[14:32, 8/30/2026] Danny: `) gives timestamp + sender in one read —
     more reliable than inferring the sender from visual grouping. Message
     text comes from the row's text span.
   - System messages ("X joined", "X changed the subject"): no
     `data-pre-plain-text`; text is taken directly, sender rendered as
     `System`, no timestamp.
   - Media without a caption: no text span; rendered as
     `[time] Sender: [media]` using whatever sender/time info is available,
     falling back to `Unknown` if not.
4. Output line format: `[time] Sender: message`, one message per line.

## Popup UI
~340px wide, WhatsApp-green accent, system font, light/dark aware via
`prefers-color-scheme`.
- Primary button "Export this group", replaced by a live counter while
  running.
- If the active tab isn't `web.whatsapp.com` or no chat is open, button is
  disabled with a one-line hint instead.
- Below: list of past exports, newest first, each a card with group name,
  export date, Download button. Empty state: "No exports yet."

## Download
On Download click, popup builds a `Blob` from the stored text and calls
`chrome.downloads.download`. Filename: `GroupName_YYYY-MM-DD.txt`
(sanitized to remove characters invalid in filenames).

## Out of scope
- Reading WhatsApp's internal webpack `Store` objects directly (faster, no
  scrolling needed, but fragile against WhatsApp's frequent internal
  changes and more complex) — rejected in favor of the simpler DOM-scroll
  approach.
- Media file export (images/audio/video) — text and placeholders only.
- Custom extension icon.
