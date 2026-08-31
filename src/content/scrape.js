const PRE_PLAIN_TEXT_RE = /^\[(.+?)\]\s*(.*):\s*$/s;

export function parsePrePlainText(raw) {
  const match = PRE_PLAIN_TEXT_RE.exec(raw);
  if (!match) return null;
  return { time: match[1], sender: match[2] };
}

export function buildLine({ time, sender, text }) {
  return time ? `[${time}] ${sender}: ${text}` : `${sender}: ${text}`;
}

export function looksLikeLoadOlderPrompt(text) {
  return /older messages/i.test(text);
}
