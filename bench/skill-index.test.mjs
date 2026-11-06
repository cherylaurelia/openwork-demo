import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { HEADER, rebuildInstructions } from "./skill-index.mjs"

const live = JSON.parse(readFileSync(new URL("./fixtures/live-39.json", import.meta.url), "utf8"))

test("the current variant rebuilds the live server's instructions byte for byte", () => {
  assert.equal(rebuildInstructions(live.instructions, live.skills, "current"), live.instructions)
})

for (const variant of ["hint", "nudge", "task", "broad", "names", "split", "own-first"]) {
  test(`${variant} keeps the rules untouched and stays within 4,096 characters`, () => {
    const rebuilt = rebuildInstructions(live.instructions, live.skills, variant)
    const rules = live.instructions.slice(0, live.instructions.indexOf(HEADER))
    assert.ok(rebuilt.startsWith(rules))
    assert.ok(rebuilt.length <= 4096, `${rebuilt.length}`)
  })
}

test("own-first lists the member's skills before the built-in ones", () => {
  const index = rebuildInstructions(live.instructions, live.skills, "own-first").slice(live.instructions.indexOf(HEADER))
  assert.doesNotMatch(index, /^- add-to-marketplace:/m)
  assert.match(index, /^- blog-post-draft-[a-z0-9]+:/m)
})

test("instructions without a skill index pass through unchanged", () => {
  assert.equal(rebuildInstructions("Just rules.", live.skills, "hint"), "Just rules.")
})

test("names lists every skill the descriptions leave out", () => {
  const index = rebuildInstructions(live.instructions, live.skills, "names").slice(live.instructions.indexOf(HEADER))

  for (const skill of live.skills) assert.ok(index.includes(skill.name), skill.name)
})
