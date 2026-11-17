import { renderStatus, renderExportList } from './render.js';
import { buildFilename } from '../shared/format.js';
import { requestStart, requestCancel, requestChatInfo } from '../shared/messages.js';
import {
  allowContentScriptAccess,
  loadState,
  saveStatus,
  deleteExport,
  onStateChange,
  errorStatus,
} from '../shared/exportStore.js';

const TAB_UNREACHABLE = 'Could not reach the WhatsApp Web tab — reload that tab, then try again.';

const statusArea = document.getElementById('status-area');
const exportList = document.getElementById('export-list');
const rangeFromInput = document.getElementById('range-from');
const rangeToInput = document.getElementById('range-to');

let activeTabId = null;
let disabledReason = null;
let chatName = null;
let state = null;

function render(newState) {
  state = newState;
  statusArea.innerHTML = renderStatus({ ...state, disabledReason, chatName });
  exportList.innerHTML = renderExportList(state.exports);
}

// Shown in this popup only; the stored status is left alone.
function showError(message) {
  render({ ...state, ...errorStatus(message) });
}

function downloadExport(entry) {
  const url = URL.createObjectURL(new Blob([entry.text], { type: 'text/plain' }));
  chrome.downloads.download({ url, filename: buildFilename(entry), saveAs: false });
}

async function copyExport(entry, btn) {
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
}

statusArea.addEventListener('click', (event) => {
  if (event.target.closest('#export-btn:not(:disabled)')) {
    const range = { from: rangeFromInput.value || null, to: rangeToInput.value || null };
    requestStart(activeTabId, range).catch(() => showError(TAB_UNREACHABLE));
  } else if (event.target.closest('#cancel-btn')) {
    requestCancel(state.tabId).catch(() => showError(TAB_UNREACHABLE));
  }
});

exportList.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-export-id]');
  const entry = btn && state.exports.find((item) => item.id === btn.dataset.exportId);
  if (!entry) return;
  if (btn.classList.contains('download-btn')) {
    downloadExport(entry);
  } else if (btn.classList.contains('copy-btn')) {
    copyExport(entry, btn);
  } else if (btn.classList.contains('delete-btn')) {
    deleteExport(entry.id).catch(() => showError('Could not delete that export — try again.'));
  }
});

// Sets activeTabId, disabledReason and chatName.
async function inspectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab && tab.id;

  if (!(tab && tab.url && tab.url.startsWith('https://web.whatsapp.com/'))) {
    disabledReason = 'Open a chat on web.whatsapp.com first.';
    return;
  }
  try {
    chatName = (await requestChatInfo(activeTabId)).chatName;
    disabledReason = chatName ? null : 'Open a chat to export.';
  } catch {
    disabledReason = 'Reload the WhatsApp Web tab, then reopen this popup.';
  }
}

// The exporting tab need not be the active one. A tab that cannot be reached
// was closed or reloaded, which ends its export just the same.
async function isStillExporting(tabId) {
  try {
    return (await requestChatInfo(tabId)).running;
  } catch {
    return false;
  }
}

async function init() {
  await allowContentScriptAccess();
  await inspectActiveTab();

  let stored = await loadState();
  // Reloading or closing the WhatsApp tab mid-export kills the export
  // without anyone updating storage; without this the popup would say
  // "Exporting…" until the browser restarts.
  if (stored.status === 'running' && !(await isStillExporting(stored.tabId))) {
    const interrupted = errorStatus('The last export was interrupted because the WhatsApp tab was reloaded or closed.');
    await saveStatus(interrupted);
    stored = { ...stored, ...interrupted };
  }
  render(stored);
  onStateChange(render);
}

init();
