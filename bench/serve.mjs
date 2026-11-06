#!/usr/bin/env node
// Serve one variant of the OpenWork agent MCP on localhost, for any MCP client (Codex, Cursor, …).
// Usage: node serve.mjs <workspace.json> <live|current|hint|own-first> [port]
import { startProxy } from "./proxy.mjs"
import { listSkills, tokenSource } from "./workspace.mjs"

const [file, variant = "live", port = "8810"] = process.argv.slice(2)

if (!file) throw new Error("usage: node serve.mjs <workspace.json> <variant> [port]")

const getToken = tokenSource(file)

await startProxy({ variant, port: Number(port), getToken, skills: await listSkills(getToken) })

console.log(`OpenWork MCP (${variant}) at http://127.0.0.1:${port}/mcp/agent`)
