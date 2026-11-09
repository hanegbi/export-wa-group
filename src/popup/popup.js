import { renderStatus, renderExportList } from './render.js';
import { buildFilename } from '../shared/format.js';
import { initialState, deleteExport, failExport, persistState } from '../shared/storageState.js';

const statusArea = document.getElementById('status-area');
const exportList = document.getElementById('export-list');
const rangeFromInput = document.getElementById('range-from');
const rangeToInput = document.getElementById('range-to');

let activeTabId = null;
let disabledReason = null;
let chatName = null;

function render(state) {
  statusArea.innerHTML = renderStatus({ ...state, disabledReason, chatName });
  exportList.innerHTML = renderExportList(state.exports);

  const exportBtn = document.getElementById('export-btn');
  if (exportBtn && !exportBtn.disabled) {
    exportBtn.addEventListener('click', () => {
      const from = rangeFromInput.value || null;
      const to = rangeToInput.value || null;
      chrome.tabs.sendMessage(activeTabId, { action: 'startExport', from, to }).catch(() => {
        render({
          ...state,
          status: 'error',
          count: 0,
          error: 'Could not reach the WhatsApp Web tab — reload that tab, then try again.',
        });
      });
    });
  }

  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      chrome.tabs.sendMessage(activeTabId, { action: 'cancelExport' }).catch(() => {
        render({
          ...state,
          status: 'error',
          count: 0,
          error: 'Could not reach the WhatsApp Web tab — reload that tab, then try again.',
        });
      });
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
        filename: buildFilename(entry.groupName, new Date(entry.date)),
        saveAs: false,
      });
    });
  }

  for (const btn of exportList.querySelectorAll('.copy-btn')) {
    btn.addEventListener('click', async () => {
      const entry = state.exports.find((item) => item.id === btn.dataset.exportId);
      if (!entry) return;
      const original = btn.title;
      try {
        await navigator.clipboard.writeText(entry.text);
        btn.title = 'Copied!';
      } catch {
        btn.title = 'Copy failed';
      }
      setTimeout(() => {
        btn.title = original;
      }, 1200);
    });
  }

  for (const btn of exportList.querySelectorAll('.delete-btn')) {
    btn.addEventListener('click', () => {
      persistState(deleteExport(state, btn.dataset.exportId)).catch(() => {
        render({
          ...state,
          status: 'error',
          count: 0,
          error: 'Could not delete that export — try again.',
        });
      });
    });
  }
}

async function init() {
  // chrome.storage.session is off-limits to content scripts by default;
  // this unlocks it so content.js can read/write export progress there.
  await chrome.storage.session.setAccessLevel({
    accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab && tab.id;

  const onWhatsApp = Boolean(tab && tab.url && tab.url.startsWith('https://web.whatsapp.com/'));
  let tabIsExporting = null;
  if (!onWhatsApp) {
    disabledReason = 'Open a chat on web.whatsapp.com first.';
  } else {
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, { action: 'checkChatOpen' });
      disabledReason = response && response.hasChat ? null : 'Open a chat to export.';
      chatName = (response && response.groupName) || null;
      tabIsExporting = Boolean(response && response.running);
    } catch {
      disabledReason = 'Reload the WhatsApp Web tab, then reopen this popup.';
    }
  }

  let { waState } = await chrome.storage.session.get('waState');
  // Reloading the WhatsApp tab mid-export kills the export without anyone
  // updating storage; without this the popup would say "Exporting…" until
  // the browser restarts.
  if (waState && waState.status === 'running' && tabIsExporting === false) {
    waState = failExport(waState, 'The last export was interrupted because the WhatsApp tab was reloaded.');
    await persistState(waState);
  }
  render(waState || initialState());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.waState) {
      render(changes.waState.newValue || initialState());
    }
  });
}

init();
