import { test } from "node:test";
import assert from "node:assert/strict";
import { findCell, followedShare } from "./bench-logic.ts";

const cell = (workspace: string, variant: string, model: string, followed: number, targetRuns: number) => ({
  workspace,
  variant,
  model,
  followed,
  targetRuns,
  unrelatedWithCalls: 0,
  unrelatedRuns: 12,
});

const cells = [cell("control", "live", "sonnet", 10, 10), cell("39 skills", "live", "sonnet", 0, 10), cell("39 skills", "live", "haiku", 1, 10)];

test("findCell matches workspace, variant and model together", () => {
  assert.equal(findCell(cells, "39 skills", "live", "haiku")?.followed, 1);
  assert.equal(findCell(cells, "control", "live", "haiku"), undefined);
});

test("followedShare adds across cells and skips missing ones", () => {
  assert.deepEqual(followedShare([findCell(cells, "39 skills", "live", "sonnet"), findCell(cells, "39 skills", "live", "haiku"), undefined]), {
    followed: 1,
    runs: 20,
  });
  assert.deepEqual(followedShare([]), { followed: 0, runs: 0 });
});
