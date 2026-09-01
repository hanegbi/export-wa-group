import { renderStatus, renderExportList } from './render.js';
import { buildFilename } from '../shared/format.js';
import { initialState, deleteExport, persistState } from '../shared/storageState.js';

const statusArea = document.getElementById('status-area');
const exportList = document.getElementById('export-list');
const rangeRow = document.getElementById('range-row');
const rangeToggle = document.getElementById('range-toggle');
const rangeFromInput = document.getElementById('range-from');
const rangeToInput = document.getElementById('range-to');

let activeTabId = null;
let disabledReason = null;

rangeToggle.addEventListener('click', () => {
  const willShow = rangeRow.hidden;
  rangeRow.hidden = !willShow;
  rangeToggle.textContent = willShow ? 'Done' : 'Change Date';
});

function render(state) {
  statusArea.innerHTML = renderStatus({ ...state, disabledReason });
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
      await navigator.clipboard.writeText(entry.text);
      const original = btn.title;
      btn.title = 'Copied!';
      setTimeout(() => {
        btn.title = original;
      }, 1200);
    });
  }

  for (const btn of exportList.querySelectorAll('.delete-btn')) {
    btn.addEventListener('click', () => {
      persistState(deleteExport(state, btn.dataset.exportId));
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
  if (!onWhatsApp) {
    disabledReason = 'Open a chat on web.whatsapp.com first.';
  } else {
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, { action: 'checkChatOpen' });
      disabledReason = response && response.hasChat ? null : 'Open a chat to export.';
    } catch {
      disabledReason = 'Reload the WhatsApp Web tab, then reopen this popup.';
    }
  }

  const { waState } = await chrome.storage.session.get('waState');
  render(waState || initialState());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.waState) {
      render(changes.waState.newValue || initialState());
    }
  });
}

init();
