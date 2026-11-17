// Everything the extension keeps lives in chrome.storage.session, which the
// browser clears on restart. The live status and the list of finished exports
// are separate keys because they have separate writers: the content script
// rewrites the status several times a second during an export, while the
// popup can delete from the list at any moment.
const STATUS_KEY = 'exportStatus';
const EXPORTS_KEY = 'exports';

// chrome.storage.session has a ~10MB quota shared across everything this
// extension stores, and each export's full text lives in the list.
const MAX_KEPT_EXPORTS = 15;

function status(fields) {
  return { status: 'idle', tabId: null, count: 0, note: null, error: null, notice: null, ...fields };
}

// `notice` says how the last export ended when that is not an error (e.g. it
// was saved to Downloads instead of the list).
export function idleStatus(notice = null) {
  return status({ notice });
}

// `tabId` is the tab doing the export, which need not be the one a popup is
// opened on. `note` explains why the live counter has stopped moving, if it
// has.
export function runningStatus(tabId, count = 0, note = null) {
  return status({ status: 'running', tabId, count, note });
}

export function errorStatus(message) {
  return status({ status: 'error', error: message });
}

// chrome.storage.session is off-limits to content scripts until an extension
// page unlocks it. The popup is the only way to start an export, so it does
// this every time it opens.
export async function allowContentScriptAccess() {
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
}

async function loadExports() {
  const stored = await chrome.storage.session.get(EXPORTS_KEY);
  return stored[EXPORTS_KEY] || [];
}

export async function loadState() {
  const stored = await chrome.storage.session.get([STATUS_KEY, EXPORTS_KEY]);
  return { ...(stored[STATUS_KEY] || idleStatus()), exports: stored[EXPORTS_KEY] || [] };
}

export async function saveStatus(newStatus) {
  await chrome.storage.session.set({ [STATUS_KEY]: newStatus });
}

export async function saveExport(entry) {
  const exports = [entry, ...(await loadExports())].slice(0, MAX_KEPT_EXPORTS);
  await chrome.storage.session.set({ [EXPORTS_KEY]: exports });
}

export async function deleteExport(id) {
  const exports = (await loadExports()).filter((item) => item.id !== id);
  await chrome.storage.session.set({ [EXPORTS_KEY]: exports });
}

export function onStateChange(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && (STATUS_KEY in changes || EXPORTS_KEY in changes)) {
      loadState().then(callback);
    }
  });
}
