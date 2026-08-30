export function sanitizeFilename(name) {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return /^_*$/.test(cleaned) ? 'chat' : cleaned;
}

export function formatDateISO(date) {
  return date.toISOString().slice(0, 10);
}

export function buildFilename(groupName, date) {
  return `${sanitizeFilename(groupName)}_${formatDateISO(date)}.txt`;
}

export function formatDateTimeLabel(isoDateTime) {
  const date = new Date(isoDateTime);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
