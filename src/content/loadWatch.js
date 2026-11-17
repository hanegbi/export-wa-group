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

export function createLoadWatch(now) {
  return { lastActivityAt: now, maxHeight: 0 };
}

// Progress is either older rows we had never read before, or the pane growing
// taller than it has ever been. A height that merely wobbles (a loading
// spinner coming and going) is deliberately not progress, or it could keep
// the export alive forever.
//
// Messages that arrive at the bottom while the export runs are not progress
// either, and neither is the height they add: a busy group would otherwise
// never look quiet.
export function recordPass(watch, { now, olderRowCount, newerRowCount = 0, scrollHeight }) {
  const grewFromHistory = scrollHeight > watch.maxHeight && newerRowCount === 0;
  const active = olderRowCount > 0 || grewFromHistory;
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

// One line for the popup while the export cannot make progress, or null.
export function waitNote({ hidden }) {
  return hidden ? 'Keep the WhatsApp tab visible. Older messages only load while it is on screen.' : null;
}
