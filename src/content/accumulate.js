export function createAccumulator() {
  return { seenIds: new Set(), lines: [] };
}

// `rows` is everything currently in the DOM, oldest first, including rows
// recorded by earlier passes: those act as anchors. New rows above the first
// anchor are older history revealed by scrolling up; new rows below an
// anchor are messages that arrived (or rendered late) during the export and
// belong at the end. A pass with no anchor at all is older history, since
// the export only ever scrolls upward.
//
// seenIds is shared with the accumulator passed in rather than copied:
// copying it every pass would cost O(history) per pass on a long chat.
export function addPass(accumulator, rows) {
  const { seenIds } = accumulator;
  const older = [];
  const newer = [];
  let passedAnchor = false;
  let pending = null;

  for (const row of rows) {
    if (seenIds.has(row.id)) {
      if (!pending || !pending.has(row.id)) passedAnchor = true;
      continue;
    }
    seenIds.add(row.id);
    (pending ||= new Set()).add(row.id);
    (passedAnchor ? newer : older).push(row.line);
  }

  const addedCount = older.length + newer.length;
  if (addedCount === 0) return { accumulator, addedCount };
  return {
    accumulator: { seenIds, lines: [...older, ...accumulator.lines, ...newer] },
    addedCount,
  };
}

export function getText(accumulator) {
  return accumulator.lines.join('\n');
}
