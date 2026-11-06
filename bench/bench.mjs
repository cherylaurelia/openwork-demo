#!/usr/bin/env node
// Does Claude Code use a team's OpenWork skill on a plain request? Runs `claude -p` against the live
// OpenWork agent MCP through a local proxy that can swap the skill index text (see skill-index.mjs).
// Usage: node bench.mjs --workspace <workspace.json> [--variants live,hint] [--models sonnet,haiku]
//                       [--reps 2] [--only id,id] [--jobs 4] [--label name]
import { spawn } from "node:child_process"
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { classifyRun } from "./classify.mjs"
import { startProxy } from "./proxy.mjs"
import { listSkills, tokenSource } from "./workspace.mjs"

const here = dirname(fileURLToPath(import.meta.url))

const { values: opts } = parseArgs({
  options: {
    workspace: { type: "string" },
    variants: { type: "string", default: "live" },
    models: { type: "string", default: "sonnet,haiku" },
    reps: { type: "string", default: "2" },
    only: { type: "string", default: "" },
    jobs: { type: "string", default: "4" },
    label: { type: "string", default: "" },
    workdir: { type: "string", default: "/tmp/owbench-runs" },
    port: { type: "string", default: "8790" },
  },
})

if (!opts.workspace) throw new Error("--workspace <workspace.json> is required (make one with seed.mjs)")

// Claude Code reads CLAUDE.md, AGENTS.md and .claude/rules from parent folders, so one above the runs would leak in.
for (let dir = resolve(opts.workdir); ; dir = dirname(dir)) {
  for (const file of ["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md", ".claude/CLAUDE.md", ".claude/rules"]) {
    if (existsSync(join(dir, file))) throw new Error(`${join(dir, file)} would be loaded into every run; pick another --workdir`)
  }

  if (dirname(dir) === dir) break
}

mkdirSync(opts.workdir, { recursive: true })

const getToken = tokenSource(opts.workspace)
const skills = await listSkills(getToken)
const prompts = JSON.parse(readFileSync(join(here, "prompts.json"), "utf8")).filter((p) => !opts.only || opts.only.split(",").includes(p.id))
const variants = opts.variants.split(",")
const models = opts.models.split(",")

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const outDir = join(here, "results", `${stamp}${opts.label ? `-${opts.label}` : ""}`)

mkdirSync(join(outDir, "logs"), { recursive: true })

const servers = []
const configs = {}

for (const [i, variant] of variants.entries()) {
  const port = Number(opts.port) + i
  servers.push(await startProxy({ variant, port, getToken, skills }))
  configs[variant] = join(opts.workdir, `mcp-${variant}-${port}.json`)
  writeFileSync(configs[variant], JSON.stringify({ mcpServers: { openwork: { type: "http", url: `http://127.0.0.1:${port}/mcp/agent` } } }))
}

function runOne(variant, model, prompt, log) {
  const args = ["-p", prompt.text, "--setting-sources", "project", "--strict-mcp-config", "--mcp-config", configs[variant],
    "--output-format", "stream-json", "--verbose", "--max-turns", "8", "--permission-mode", "bypassPermissions",
    "--model", model, "--no-session-persistence"]

  return new Promise((done) => {
    const out = createWriteStream(log)
    const child = spawn("claude", args, { cwd: opts.workdir, stdio: ["ignore", "pipe", "pipe"] })
    const timer = setTimeout(() => child.kill("SIGTERM"), 5 * 60_000)
    child.stdout.pipe(out)
    child.on("close", (code) => {
      clearTimeout(timer)
      out.end(() => {
        const events = readFileSync(log, "utf8").split("\n").filter(Boolean).flatMap((line) => {
          try { return [JSON.parse(line)] } catch { return [] }
        })

        const result = events.findLast((event) => event.type === "result")
        done({ ...classifyRun(events, prompt), exitCode: code, turns: result?.num_turns ?? null, costUsd: result?.total_cost_usd ?? null, ms: result?.duration_ms ?? null })
      })
    })
  })
}

const tasks = []

for (let rep = 1; rep <= Number(opts.reps); rep++) {
  for (const variant of variants) for (const model of models) for (const prompt of prompts) {
    tasks.push(async () => {
      const r = await runOne(variant, model, prompt, join(outDir, "logs", `${variant}-${model}-${prompt.id}-${rep}.jsonl`))
      const row = { variant, model, prompt: prompt.id, skill: prompt.skill, rep, ...r }
      appendFileSync(join(outDir, "runs.jsonl"), `${JSON.stringify(row)}\n`)
      console.log(`${variant.padEnd(9)} ${model.padEnd(6)} ${prompt.id.padEnd(12)} rep${rep} ${r.followed === null ? `calls ${r.openworkCalls}` : r.followed ? "FOLLOWED" : "missed"}  ${r.calls.join(" ")}`)

      return row
    })
  }
}

let next = 0
const runs = []

await Promise.all(Array.from({ length: Number(opts.jobs) }, async () => {
  while (next < tasks.length) runs.push(await tasks[next++]())
}))

for (const server of servers) server.close()

const meta = {
  startedAt: stamp, skillsInWorkspace: skills.length, indexed: null, variants, models, reps: Number(opts.reps),
  claudeCode: await new Promise((done) => { const c = spawn("claude", ["--version"]); let s = ""; c.stdout.on("data", (d) => { s += d }); c.on("close", () => done(s.trim())) }),
}

writeFileSync(join(outDir, "results.json"), JSON.stringify({ meta, runs }, null, 2))

for (const variant of variants) for (const model of models) {
  const rows = runs.filter((r) => r.variant === variant && r.model === model)
  const target = rows.filter((r) => r.skill)
  const unrelated = rows.filter((r) => !r.skill)
  console.log(`${variant} ${model}: followed ${target.filter((r) => r.followed).length}/${target.length}; unrelated asks with OpenWork calls ${unrelated.filter((r) => r.openworkCalls > 0).length}/${unrelated.length}`)
}

console.log(`wrote ${outDir}`)
