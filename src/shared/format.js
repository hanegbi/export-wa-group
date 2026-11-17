export function sanitizeFilename(name) {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return /^_*$/.test(cleaned) ? 'chat' : cleaned;
}

// Takes an export entry; `date` is an ISO string, `outcome` is null unless
// the export stopped early.
export function buildFilename({ groupName, outcome, date }) {
  const name = outcome ? `${groupName} (${outcome})` : groupName;
  return `${sanitizeFilename(name)}_${date.slice(0, 10)}.txt`;
}

// Exports only live until the browser restarts, so the year is noise.
export function formatDateTimeLabel(isoDateTime) {
  const date = new Date(isoDateTime);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
