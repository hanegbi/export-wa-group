import { renderStatus, renderExportList } from './render.js';
import { buildFilename } from '../shared/format.js';
import { initialState } from '../shared/storageState.js';

const statusArea = document.getElementById('status-area');
const exportList = document.getElementById('export-list');
const rangeFromInput = document.getElementById('range-from');
const rangeToInput = document.getElementById('range-to');

let activeTabId = null;
let disabledReason = null;

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
}

async function init() {
  // chrome.storage.session is off-limits to content scripts by default;
  // this unlocks it so content.js can read/write export progress there.
  await chrome.storage.session.setAccessLevel({
    accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
  });

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
