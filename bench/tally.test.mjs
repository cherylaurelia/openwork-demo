import { test } from "node:test"
import assert from "node:assert/strict"
import { tallyCells } from "./tally.mjs"

const run = (overrides) => ({ workspace: "39 skills", variant: "live", model: "sonnet", skill: "weekly-update", followed: false, openworkCalls: 0, ...overrides })

test("target runs count followed, unrelated runs count OpenWork calls, per cell", () => {
  const cells = tallyCells([
    run({ followed: true, openworkCalls: 1 }),
    run({}),
    run({ skill: null, followed: null, openworkCalls: 2 }),
    run({ skill: null, followed: null }),
    run({ variant: "hint", followed: true }),
  ])

  assert.deepEqual(cells, [
    { workspace: "39 skills", variant: "live", model: "sonnet", followed: 1, targetRuns: 2, unrelatedWithCalls: 1, unrelatedRuns: 2 },
    { workspace: "39 skills", variant: "hint", model: "sonnet", followed: 1, targetRuns: 1, unrelatedWithCalls: 0, unrelatedRuns: 0 },
  ])
})

test("no runs, no cells", () => {
  assert.deepEqual(tallyCells([]), [])
})
