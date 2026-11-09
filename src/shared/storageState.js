// chrome.storage.session has a ~10MB quota shared across everything this
// extension stores, and each export's full text lives in this list — cap
// how many stick around so an active session can't silently exceed it.
const MAX_KEPT_EXPORTS = 15;

// `note` is an optional one-line explanation shown under the live counter
// while an export is running (e.g. why the counter has stopped moving).
export function initialState() {
  return { status: 'idle', count: 0, note: null, error: null, exports: [] };
}

export async function persistState(state) {
  await chrome.storage.session.set({ waState: state });
}

export function startRunning(state) {
  return { ...state, status: 'running', count: 0, note: null, error: null };
}

export function updateProgress(state, count, note = null) {
  return { ...state, count, note };
}

export function completeExport(state, entry) {
  return {
    ...state,
    status: 'done',
    count: 0,
    note: null,
    error: null,
    exports: [entry, ...state.exports].slice(0, MAX_KEPT_EXPORTS),
  };
}

export function failExport(state, message) {
  return { ...state, status: 'error', note: null, error: message };
}

export function deleteExport(state, id) {
  return { ...state, exports: state.exports.filter((item) => item.id !== id) };
}
