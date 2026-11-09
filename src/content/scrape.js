const PRE_PLAIN_TEXT_RE = /^\[(.+?)\]\s*(.*):\s*$/s;

export function parsePrePlainText(raw) {
  const match = PRE_PLAIN_TEXT_RE.exec(raw);
  if (!match) return null;
  return { time: match[1], sender: match[2] };
}

export function buildLine({ time, sender, text }) {
  return time ? `[${time}] ${sender}: ${text}` : `${sender}: ${text}`;
}

// English, plus the Hebrew wording ("הודעות ישנות" = "older messages").
const LOAD_OLDER_PROMPT_RE = /older messages|הודעות ישנות/i;

export function looksLikeLoadOlderPrompt(text) {
  return LOAD_OLDER_PROMPT_RE.test(text);
}
