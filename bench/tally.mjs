// Count, per workspace × variant × model, how often the team skill was followed and how often an
// unrelated request made the agent call OpenWork anyway.
export function tallyCells(runs) {
  const cells = new Map()

  for (const run of runs) {
    const key = `${run.workspace}|${run.variant}|${run.model}`
    const cell = cells.get(key) ?? { workspace: run.workspace, variant: run.variant, model: run.model, followed: 0, targetRuns: 0, unrelatedWithCalls: 0, unrelatedRuns: 0 }

    if (run.skill) {
      cell.targetRuns += 1

      if (run.followed) cell.followed += 1
    } else {
      cell.unrelatedRuns += 1

      if (run.openworkCalls > 0) cell.unrelatedWithCalls += 1
    }

    cells.set(key, cell)
  }

  return [...cells.values()]
}
