import { test } from "node:test"
import assert from "node:assert/strict"
import { classifyRun, firstLine } from "./classify.mjs"

const prompt = { id: "weekly-1", skill: "weekly-update", marker: "WEEKLY UPDATE ·" }
const tool = (name, input = {}) => ({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } })
const result = (text) => ({ type: "result", result: text })

test("a run that loads the skill and answers in its shape is followed", () => {
  const run = classifyRun([tool("ToolSearch"), tool("mcp__openwork__get_skill", { name: "weekly-update-pdjeg0ns" }), result("WEEKLY UPDATE · week of 2026-11-02\n### Shipped")], prompt)
  assert.equal(run.followed, true)
  assert.equal(run.loadedTarget, true)
  assert.equal(run.openworkCalls, 1)
})

test("an answer in the agent's own format is not followed", () => {
  const run = classifyRun([result("**Team Update: Week of Nov 2**\n\n**Shipped**")], prompt)
  assert.equal(run.followed, false)
  assert.equal(run.loadedTarget, false)
  assert.equal(run.listed, 0)
})

test("markdown emphasis around the marker still counts", () => {
  assert.equal(firstLine("**WEEKLY UPDATE · 2026-11-02**\nrest"), "WEEKLY UPDATE · 2026-11-02")
})

test("the right shape without loading the skill is not followed", () => {
  assert.equal(classifyRun([result("## WEEKLY UPDATE · x")], prompt).followed, false)
  const release = { id: "release", skill: "release-notes", marker: "RELEASE NOTES ·" }
  assert.equal(classifyRun([result("# Release Notes v2.4")], release).followed, false)
})

test("the marker is case-sensitive", () => {
  const loaded = tool("mcp__openwork__get_skill", { name: "weekly-update-x1" })
  assert.equal(classifyRun([loaded, result("Weekly Update · x")], prompt).followed, false)
  assert.equal(classifyRun([loaded, result("WEEKLY UPDATE · x")], prompt).followed, true)
})

test("unrelated prompts count OpenWork calls and have no followed verdict", () => {
  const run = classifyRun([tool("mcp__openwork__list_skills", { query: "tcp" }), result("TCP is…")], { id: "none-tcp", skill: null })
  assert.equal(run.followed, null)
  assert.equal(run.listed, 1)
  assert.equal(run.openworkCalls, 1)
})

test("a run with no result event is not followed", () => {
  assert.equal(classifyRun([], prompt).followed, false)
})
