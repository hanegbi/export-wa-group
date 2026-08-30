export function createAccumulator() {
  return { seenIds: new Set(), lines: [] };
}

export function addPass(accumulator, rows) {
  const newRows = rows.filter((row) => !accumulator.seenIds.has(row.id));
  const seenIds = new Set(accumulator.seenIds);
  for (const row of newRows) seenIds.add(row.id);
  const lines = [...newRows.map((row) => row.line), ...accumulator.lines];
  return { accumulator: { seenIds, lines }, addedCount: newRows.length };
}

export function getText(accumulator) {
  return accumulator.lines.join('\n');
}
