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

export function deleteExport(state, id) {
  return { ...state, exports: state.exports.filter((item) => item.id !== id) };
}
