type CellCounts = {
  workspace: string;
  variant: string;
  model: string;
  followed: number;
  targetRuns: number;
  unrelatedWithCalls: number;
  unrelatedRuns: number;
};

/** The tally for one workspace × index text × model, if that combination was run. */
export function findCell<T extends CellCounts>(cells: readonly T[], workspace: string, variant: string, model: string): T | undefined {
  return cells.find((cell) => cell.workspace === workspace && cell.variant === variant && cell.model === model);
}

/** Followed runs over target runs across the given cells, e.g. both models of one row. */
export function followedShare(cells: readonly (CellCounts | undefined)[]) {
  let followed = 0;
  let runs = 0;

  for (const cell of cells) {
    if (!cell) continue;
    followed += cell.followed;
    runs += cell.targetRuns;
  }

  return { followed, runs };
}
