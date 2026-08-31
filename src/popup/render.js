import { escapeHtml, formatDateTimeLabel } from '../shared/format.js';

const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';
const COPY_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const TRASH_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>';
const STOP_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

export function renderStatus({ status, count, error, disabledReason }) {
  if (disabledReason) {
    return `
      <button class="primary" id="export-btn" disabled>Export this group</button>
      <div class="hint">${escapeHtml(disabledReason)}</div>
    `;
  }
  if (status === 'running') {
    return `
      <div class="running-row">
        <button class="primary" id="export-btn" disabled>Exporting…</button>
        <button class="icon-btn" id="cancel-btn" title="Cancel export">${STOP_ICON}</button>
      </div>
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
        <div class="export-card-info">
          <div class="name" title="${escapeHtml(item.groupName)}">${escapeHtml(item.groupName)}</div>
          <div class="date">${formatDateTimeLabel(item.date)}</div>
        </div>
        <div class="card-actions">
          <button data-export-id="${escapeHtml(item.id)}" class="icon-btn download-btn" title="Download">${DOWNLOAD_ICON}</button>
          <button data-export-id="${escapeHtml(item.id)}" class="icon-btn copy-btn" title="Copy to clipboard">${COPY_ICON}</button>
          <button data-export-id="${escapeHtml(item.id)}" class="icon-btn delete-btn" title="Delete">${TRASH_ICON}</button>
        </div>
      </div>
    `,
    )
    .join('');
}
