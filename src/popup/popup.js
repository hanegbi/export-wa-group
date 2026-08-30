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
      chrome.tabs.sendMessage(activeTabId, { action: 'startExport' }).catch(() => {
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
