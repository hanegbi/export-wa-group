import { createAccumulator, addPass } from './accumulate.js';
import { orderRange, isWithinRange } from './timestamp.js';
import { createLoadWatch, recordPass, resetQuiet, msUntilGiveUp, waitNote } from './loadWatch.js';
import {
  findOpenChat,
  findScrollArea,
  findLoadOlderButton,
  createRowReader,
  scrollToTop,
  waitForPaneChange,
  downloadTextFile,
} from './chatPage.js';
import { runningStatus, idleStatus, errorStatus, saveStatus, saveExport } from '../shared/exportStore.js';
import { buildFilename } from '../shared/format.js';

// The longest a single pass waits for the pane to change before scrolling
// again. Whether the export is *done* is not decided here — see loadWatch.js.
const STEP_WAIT_MS = 1500;
const OLDER_CLICK_EVERY_MS = 10 * 1000;
// Safety net only. Long chats legitimately take a long time; the real stop
// condition is the chat going quiet.
const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000;

// Scrolls the open chat upward until its history stops loading and returns
// { text, lineCount, outcome }. `outcome` is null for a complete export, 'cancelled'
// or 'partial' when it stopped early.
async function gatherLines(pane, { newest, oldest }, tabId, isCancelled) {
  const accumulator = createAccumulator();
  const readRows = createRowReader();
  let lastReported = null;
  let lastOlderClickAt = 0;
  let lastTick = Date.now();
  let activeMs = 0;
  let watch = createLoadWatch(lastTick);

  const finish = (outcome) => ({ text: accumulator.lines.join('\n'), lineCount: accumulator.lines.length, outcome });

  while (true) {
    if (isCancelled()) return finish('cancelled');

    const now = Date.now();
    // A hidden tab doesn't render, so WhatsApp can't load anything and
    // timers are throttled. Keep trying, but never let hidden time count
    // toward "the chat has gone quiet" or toward the runtime cap.
    const hidden = document.hidden;
    if (hidden) watch = resetQuiet(watch, now);
    else activeMs += now - lastTick;
    lastTick = now;
    if (activeMs >= MAX_RUNTIME_MS) return finish('partial');

    const area = findScrollArea(pane);
    const rows = readRows(area.root);
    const { olderCount, newerCount } = addPass(accumulator, rows, (row) => isWithinRange(row.date, newest, oldest));
    watch = recordPass(watch, {
      now,
      olderRowCount: olderCount,
      newerRowCount: newerCount,
      scrollHeight: area.scroller.scrollHeight,
    });

    const pastCutoff = Boolean(oldest) && rows.some((row) => row.date && row.date < oldest);
    if (pastCutoff) return finish(null);

    const olderBtn = findLoadOlderButton(area.root);
    // Click again right away after a batch arrives; otherwise leave the
    // phone time to answer before re-clicking.
    if (olderBtn && (olderCount > 0 || now - lastOlderClickAt >= OLDER_CLICK_EVERY_MS)) {
      olderBtn.click();
      lastOlderClickAt = now;
    }

    const waitingOnPhone = Boolean(olderBtn);
    if (msUntilGiveUp(watch, now, { waitingOnPhone }) === 0) return finish(null);

    const count = accumulator.lines.length;
    const note = waitNote({ hidden });
    if (`${count}|${note}` !== lastReported) {
      lastReported = `${count}|${note}`;
      try {
        await saveStatus(runningStatus(tabId, count, note));
      } catch (err) {
        // A stalled live counter isn't worth aborting a long scroll over.
        console.warn('WhatsApp Chat Export: failed to persist progress, continuing', err);
      }
    }

    await scrollToTop(area.scroller);
    await waitForPaneChange(area, STEP_WAIT_MS, isCancelled);
  }
}

async function storeExport(entry) {
  try {
    await saveExport(entry);
    return null;
  } catch (err) {
    // Most likely the ~10MB session-storage quota: a long chat's text
    // doesn't fit in the popup's list. Never throw the scraped history
    // away over that — hand the file straight to the browser instead.
    console.warn('WhatsApp Chat Export: could not store the export, downloading it directly', err);
    const filename = buildFilename(entry);
    downloadTextFile(filename, entry.text);
    return `Too large to keep in this list, so it was saved to your Downloads folder as "${filename}".`;
  }
}

// `from` and `to` are the popup's range inputs (see orderRange). `tabId` is
// this tab's id, which a content script can only learn from the popup; it is
// stored with the progress so any popup knows which tab is exporting.
export async function exportChat({ from, to }, tabId, isCancelled) {
  try {
    const chat = findOpenChat();
    if (!chat) {
      await saveStatus(errorStatus('Open a chat on web.whatsapp.com first.'));
      return;
    }
    await saveStatus(runningStatus(tabId));

    const { text, lineCount, outcome } = await gatherLines(chat.pane, orderRange(from, to), tabId, isCancelled);

    const notice = await storeExport({
      id: `${Date.now()}`,
      groupName: chat.name,
      outcome,
      date: new Date().toISOString(),
      text,
      lineCount,
    });
    await saveStatus(idleStatus(notice));
  } catch (err) {
    // Whatever broke — a full storage quota, an unexpected DOM change,
    // anything — the popup must never see "Exporting…" hang forever.
    await saveStatus(errorStatus(`Export failed: ${err.message || err}`)).catch((persistErr) => {
      console.error('WhatsApp Chat Export: failed to persist the failure state itself', persistErr);
    });
  }
}
