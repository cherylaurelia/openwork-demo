#!/usr/bin/env node
// Make a run log safe to publish: keep what the model said and called, OpenWork's answers and the
// final result; drop the local setup in the init event and any local tool output.
// Usage: node sanitize.mjs <raw.jsonl> > <published.jsonl>
import { readFileSync } from "node:fs"
import { homedir } from "node:os"

const home = homedir()
const scrub = (text) => text.split(home).join("~")

export function sanitizeEvents(events) {
  const openworkCalls = new Set()
  const out = []

  for (const event of events) {
    if (event.type === "system" && event.subtype === "init") {
      out.push({ type: "system", subtype: "init", model: event.model, claude_code_version: event.claude_code_version, mcp_servers: event.mcp_servers })
    } else if (event.type === "assistant") {
      const content = (event.message?.content ?? []).flatMap((part) => {
        if (part.type === "text") return [{ type: "text", text: part.text }]

        if (part.type !== "tool_use") return []

        if (part.name.startsWith("mcp__openwork__")) openworkCalls.add(part.id)

        return [{ type: "tool_use", id: part.id, name: part.name, input: part.input }]
      })

      if (content.length > 0) out.push({ type: "assistant", message: { content } })
    } else if (event.type === "user") {
      const content = (event.message?.content ?? []).flatMap((part) => {
        if (part.type !== "tool_result") return []
        const kept = openworkCalls.has(part.tool_use_id)

        return [{ type: "tool_result", tool_use_id: part.tool_use_id, content: kept ? part.content : "[local tool output not published]" }]
      })

      if (content.length > 0) out.push({ type: "user", message: { content } })
    } else if (event.type === "result") {
      out.push({ type: "result", subtype: event.subtype, is_error: event.is_error, num_turns: event.num_turns, duration_ms: event.duration_ms, total_cost_usd: event.total_cost_usd, result: event.result })
    }
  }

  return out
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const events = readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)] } catch { return [] }
  })

  process.stdout.write(sanitizeEvents(events).map((event) => scrub(JSON.stringify(event))).join("\n") + "\n")
}
