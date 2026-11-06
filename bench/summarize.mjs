#!/usr/bin/env node
// Collapse bench result folders into ../data/summary.json for the page.
// Usage: node summarize.mjs <workspace label>=<results dir> ...   e.g. control=results/…-control "39 skills"=results/…-big39
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { tallyCells } from "./tally.mjs"
import { classifyRun } from "./classify.mjs"
import { HEADER, VARIANTS, rebuildInstructions } from "./skill-index.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const prompts = JSON.parse(readFileSync(join(here, "prompts.json"), "utf8"))
const runs = []
const metas = []

for (const arg of process.argv.slice(2)) {
  const [workspace, dir] = arg.split("=")

  // A bench that stopped early has runs.jsonl but no results.json; its finished runs still count.
  const { meta, runs: rows } = existsSync(join(dir, "results.json"))
    ? JSON.parse(readFileSync(join(dir, "results.json"), "utf8"))
    : { meta: { stoppedEarly: true }, runs: readFileSync(join(dir, "runs.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) }

  metas.push({ workspace, ...meta, dir: basename(dir) })

  for (const row of rows) {
    // Classify again from the raw log, so every run is judged by the current classify.mjs.
    const log = join(dir, "logs", `${row.variant}-${row.model}-${row.prompt}-${row.rep}.jsonl`)

    const events = readFileSync(log, "utf8").split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)] } catch { return [] }
    })

    const prompt = prompts.find((p) => p.id === row.prompt)
    const r = classifyRun(events, prompt)
    // The expense-report request is the regression check (a skill described today), reported apart.
    runs.push({
      workspace: row.prompt === "expense" ? "regression" : workspace, variant: row.variant, model: row.model, prompt: row.prompt, skill: row.skill, rep: row.rep,
      followed: r.followed, loadedTarget: r.loadedTarget, openworkCalls: r.openworkCalls, calls: r.calls, loaded: r.loaded,
      costUsd: row.costUsd, answerStart: r.answerStart, log: relative(join(here, ".."), log),
    })
  }
}

// What the agent sees at the end of the instructions, per variant, in the 39-skill workspace.
const live = JSON.parse(readFileSync(join(here, "fixtures", "live-39.json"), "utf8"))

const tails = Object.fromEntries(Object.keys(VARIANTS).map((variant) => {
  const rebuilt = rebuildInstructions(live.instructions, live.skills, variant)

  return [variant, rebuilt.slice(rebuilt.indexOf(HEADER)).split("\n").slice(-3).join("\n")]
}))

const describedIn = (instructions) => instructions.slice(instructions.indexOf(HEADER)).split("\n").filter((line) => line.startsWith("- ") && !line.startsWith("- …")).length

const indexStats = {
  instructionsChars: live.instructions.length,
  skills: live.skills.length,
  described: describedIn(live.instructions),
  describedWithNames: describedIn(rebuildInstructions(live.instructions, live.skills, "names")),
  describedWithSplit: describedIn(rebuildInstructions(live.instructions, live.skills, "split")),
}

runs.sort((a, b) => `${a.workspace}${a.variant}${a.model}${a.prompt}${a.rep}`.localeCompare(`${b.workspace}${b.variant}${b.model}${b.prompt}${b.rep}`))

writeFileSync(join(here, "..", "data", "summary.json"), `${JSON.stringify({ metas, prompts, tails, indexStats, cells: tallyCells(runs), runs }, null, 1)}\n`)

console.log(tallyCells(runs).map((c) => `${c.workspace} ${c.variant} ${c.model}: ${c.followed}/${c.targetRuns} followed, ${c.unrelatedWithCalls}/${c.unrelatedRuns} unrelated with calls`).join("\n"))
