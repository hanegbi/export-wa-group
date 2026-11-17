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
// Rows that fail `isWanted` (outside the chosen date range) are classified
// and counted like any other but leave no line behind. Returns how many
// never-seen rows were older history and how many arrived at the bottom.
export function addPass(accumulator, rows, isWanted = () => true) {
  const { seenIds } = accumulator;
  const older = [];
  const newer = [];
  const counts = { olderCount: 0, newerCount: 0 };
  const addedThisPass = new Set();
  let passedAnchor = false;

  for (const row of rows) {
    if (seenIds.has(row.id)) {
      if (!addedThisPass.has(row.id)) passedAnchor = true;
      continue;
    }
    seenIds.add(row.id);
    addedThisPass.add(row.id);
    counts[passedAnchor ? 'newerCount' : 'olderCount'] += 1;
    if (isWanted(row)) (passedAnchor ? newer : older).push(row.line);
  }

  if (older.length + newer.length > 0) {
    accumulator.lines = [...older, ...accumulator.lines, ...newer];
  }
  return counts;
}
