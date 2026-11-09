// WhatsApp fetches older history asynchronously — from its servers, or from
// the phone — and a single batch can take many seconds to show up. So "no
// new rows right now" says nothing about whether the top of the chat has
// been reached. The only trustworthy signal is a long stretch in which
// nothing at all arrived, which is what this module tracks.

// How long the chat must stay completely quiet before the export concludes
// it has reached the top of the history.
export const QUIET_LIMIT_MS = 60 * 1000;

// Same, while WhatsApp's "get older messages from your phone" prompt is on
// screen: a phone round-trip is far slower than a server fetch.
export const PHONE_QUIET_LIMIT_MS = 3 * 60 * 1000;

const NOTE_AFTER_QUIET_MS = 5000;
const NOTE_STEP_MS = 5000;

export function createLoadWatch(now) {
  return { lastActivityAt: now, maxHeight: 0 };
}

// Progress is either rows we had never read before, or the pane growing
// taller than it has ever been. A height that merely wobbles (a loading
// spinner coming and going) is deliberately not progress, or it could keep
// the export alive forever.
export function recordPass(watch, { now, newRowCount, scrollHeight }) {
  const grew = scrollHeight > watch.maxHeight;
  const firstMeasurement = watch.maxHeight === 0;
  const active = newRowCount > 0 || (grew && !firstMeasurement);
  return {
    lastActivityAt: active ? now : watch.lastActivityAt,
    maxHeight: Math.max(watch.maxHeight, scrollHeight),
  };
}

export function resetQuiet(watch, now) {
  return { ...watch, lastActivityAt: now };
}

export function msUntilGiveUp(watch, now, { waitingOnPhone = false } = {}) {
  const limit = waitingOnPhone ? PHONE_QUIET_LIMIT_MS : QUIET_LIMIT_MS;
  return Math.max(0, limit - (now - watch.lastActivityAt));
}

// One line for the popup explaining why the counter has stopped moving, or
// null while messages are still flowing.
export function waitNote({ hidden, waitingOnPhone, quietMs, remainingMs }) {
  if (hidden) {
    return 'Keep the WhatsApp tab visible. Older messages only load while it is on screen.';
  }
  if (quietMs < NOTE_AFTER_QUIET_MS) return null;
  const seconds = Math.ceil(remainingMs / NOTE_STEP_MS) * (NOTE_STEP_MS / 1000);
  return waitingOnPhone
    ? `Waiting for older messages from your phone. Finishes in ${seconds}s if none arrive.`
    : `Checking for older messages. Finishes in ${seconds}s if none load.`;
}
