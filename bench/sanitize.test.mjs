import { test } from "node:test"
import assert from "node:assert/strict"
import { sanitizeEvents } from "./sanitize.mjs"
import { classifyRun } from "./classify.mjs"

const raw = [
  { type: "system", subtype: "init", model: "claude-sonnet", claude_code_version: "2.1.318", mcp_servers: [{ name: "openwork" }], memory_paths: { auto: "/Users/someone/.claude" }, skills: ["private-skill"] },
  { type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "mcp__openwork__get_skill", input: { name: "weekly-update-x" } }, { type: "tool_use", id: "b", name: "Bash", input: { command: "ls" } }] } },
  { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "# Weekly update" }, { type: "tool_result", tool_use_id: "b", content: "secret.txt" }] } },
  { type: "rate_limit_event", info: {} },
  { type: "result", subtype: "success", is_error: false, num_turns: 2, duration_ms: 10, total_cost_usd: 0.01, result: "WEEKLY UPDATE · x", session_id: "s" },
]

test("local setup and local tool output are dropped, OpenWork results kept", () => {
  const text = JSON.stringify(sanitizeEvents(raw))
  assert.doesNotMatch(text, /memory_paths|private-skill|secret\.txt|session_id|rate_limit/)
  assert.match(text, /# Weekly update/)
  assert.match(text, /local tool output not published/)
})

test("a sanitized log classifies the same as the raw one", () => {
  const prompt = { id: "weekly-1", skill: "weekly-update", marker: "WEEKLY UPDATE ·" }
  const { calls: rawCalls, ...rawVerdict } = classifyRun(raw, prompt)
  const { calls, ...verdict } = classifyRun(sanitizeEvents(raw), prompt)
  assert.deepEqual(verdict, rawVerdict)
  assert.deepEqual(calls, rawCalls)
})
