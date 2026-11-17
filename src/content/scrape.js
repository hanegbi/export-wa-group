import { parseWhatsAppTimestamp } from './timestamp.js';

const PRE_PLAIN_TEXT_RE = /^\[(.+?)\]\s*(.*):\s*$/s;

// `raw` is a row's data-pre-plain-text, e.g. "[14:32, 8/30/2026] Danny: ".
// `time` is the bracketed text as WhatsApp wrote it; `date` is the same
// moment as a Date, or null if it could not be understood.
export function parsePrePlainText(raw, fieldOrder) {
  const match = PRE_PLAIN_TEXT_RE.exec(raw);
  if (!match) return null;
  return { time: match[1], sender: match[2], date: parseWhatsAppTimestamp(match[1], fieldOrder) };
}

export function buildLine({ time, sender, text }) {
  return time ? `[${time}] ${sender}: ${text}` : `${sender}: ${text}`;
}

// English, plus the Hebrew wording ("הודעות ישנות" = "older messages").
const LOAD_OLDER_PROMPT_RE = /older messages|הודעות ישנות/i;

export function looksLikeLoadOlderPrompt(text) {
  return LOAD_OLDER_PROMPT_RE.test(text);
}
