import { escapeHtml, formatDateTimeLabel } from '../shared/format.js';

const ICON_ATTRS = 'viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const DOWNLOAD_ICON = `<svg ${ICON_ATTRS}><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`;
const COPY_ICON = `<svg ${ICON_ATTRS}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`;
const TRASH_ICON = `<svg ${ICON_ATTRS}><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>`;
const STOP_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
const ALERT_ICON = `<svg ${ICON_ATTRS} class="callout-icon"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
const CHECK_ICON = `<svg ${ICON_ATTRS} class="callout-icon"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`;
const EMPTY_ICON = '<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 7c-9.4 0-17 6.5-17 14.5 0 3.6 1.5 6.9 4.1 9.4L9 40l9.6-3.3c1.7.5 3.5.8 5.4.8 9.4 0 17-6.5 17-14.5S33.4 7 24 7z"/><path d="M16 20h16"/><path d="M16 26h10"/></svg>';

const numberFormat = new Intl.NumberFormat('en-US');

function exportButton({ chatName, disabled }) {
  const label = chatName ? `Export <span class="chat-name">${escapeHtml(chatName)}</span>` : 'Export this group';
  return `<button class="primary" id="export-btn"${disabled ? ' disabled' : ''}>${label}</button>`;
}

export function renderStatus({ status, count, note, error, notice, disabledReason, chatName }) {
  if (status === 'running') {
    return `
      <div class="running">
        <div class="running-row">
          <div class="counter"><span class="count">${numberFormat.format(count)}</span> messages found</div>
          <button class="icon-btn stop-btn" id="cancel-btn" title="Stop and save what was found">${STOP_ICON}</button>
        </div>
        <div class="progress-bar"><span></span></div>
        ${note ? `<div class="wait-note">${escapeHtml(note)}</div>` : ''}
      </div>
    `;
  }
  if (disabledReason) {
    return `
      ${exportButton({ chatName: null, disabled: true })}
      <div class="hint">${escapeHtml(disabledReason)}</div>
    `;
  }
  if (status === 'error') {
    return `
      ${exportButton({ chatName, disabled: false })}
      <div class="callout error">${ALERT_ICON}<span>${escapeHtml(error)}</span></div>
    `;
  }
  if (notice) {
    return `
      ${exportButton({ chatName, disabled: false })}
      <div class="callout notice">${CHECK_ICON}<span>${escapeHtml(notice)}</span></div>
    `;
  }
  return exportButton({ chatName, disabled: false });
}

export function renderExportList(exports) {
  if (exports.length === 0) {
    return `
      <div class="empty-state">
        ${EMPTY_ICON}
        <p>No exports yet.<br />Open a chat and press Export.</p>
      </div>
    `;
  }
  return exports
    .map((item) => {
      const name = escapeHtml(item.groupName);
      return `
      <div class="export-card">
        <div class="export-card-info">
          <div class="name-row">
            <div class="name" title="${name}">${name}</div>
            ${item.outcome ? `<span class="tag">${escapeHtml(item.outcome)}</span>` : ''}
          </div>
          <div class="meta"><span>${numberFormat.format(item.lineCount)} messages</span><span>${formatDateTimeLabel(item.date)}</span></div>
        </div>
        <div class="card-actions">
          <button data-export-id="${escapeHtml(item.id)}" class="icon-btn download-btn" title="Download">${DOWNLOAD_ICON}</button>
          <button data-export-id="${escapeHtml(item.id)}" class="icon-btn copy-btn" title="Copy to clipboard">${COPY_ICON}</button>
          <button data-export-id="${escapeHtml(item.id)}" class="icon-btn delete-btn" title="Delete">${TRASH_ICON}</button>
        </div>
      </div>
    `;
    })
    .join('');
}
