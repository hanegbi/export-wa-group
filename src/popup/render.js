import { escapeHtml, formatDateTimeLabel } from '../shared/format.js';

export function renderStatus({ status, count, error, disabledReason }) {
  if (disabledReason) {
    return `
      <button class="primary" id="export-btn" disabled>Export this group</button>
      <div class="hint">${escapeHtml(disabledReason)}</div>
    `;
  }
  if (status === 'running') {
    return `
      <button class="primary" id="export-btn" disabled>Exporting…</button>
      <div class="progress">Scanning… ${count} messages found</div>
    `;
  }
  if (status === 'error') {
    return `
      <button class="primary" id="export-btn">Export this group</button>
      <div class="error">${escapeHtml(error)}</div>
    `;
  }
  return `<button class="primary" id="export-btn">Export this group</button>`;
}

export function renderExportList(exports) {
  if (exports.length === 0) {
    return `<div class="empty-state">No exports yet.</div>`;
  }
  return exports
    .map(
      (item) => `
      <div class="export-card">
        <div>
          <div class="name">${escapeHtml(item.groupName)}</div>
          <div class="date">${formatDateTimeLabel(item.date)}</div>
        </div>
        <button data-export-id="${escapeHtml(item.id)}" class="download-btn">Download</button>
      </div>
    `,
    )
    .join('');
}
