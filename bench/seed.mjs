#!/usr/bin/env node
// Make a provisional OpenWork workspace and fill it with skills.
// Usage: node seed.mjs <workspace.json> [--filler]   (--filler adds the 27 generic team skills too)
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { register, tokenSource, mcp } from "./workspace.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const [file, flag] = process.argv.slice(2)

if (!file) throw new Error("usage: node seed.mjs <workspace.json> [--filler]")

const { organization, expiresAt } = await register(flag === "--filler" ? "Skill index bench (39 skills)" : "Skill index bench (control)", file)

console.log(`workspace ${organization}, expires ${expiresAt}`)

const getToken = tokenSource(file)

const create = async (pluginName, skillMarkdown) => {
  const result = await mcp(getToken, "tools/call", { name: "create_skill", arguments: { pluginName, skillMarkdown } })

  if (result.isError) throw new Error(`${pluginName}: ${JSON.stringify(result.content)}`)
  console.log(`  + ${result.structuredContent.name}`)
}

for (const name of readdirSync(join(here, "skills"))) await create(name.replace(/\.md$/, ""), readFileSync(join(here, "skills", name), "utf8"))

if (flag === "--filler") {
  const filler = JSON.parse(readFileSync(join(here, "filler.json"), "utf8"))

  for (const { name, description } of filler) {
    await create(name, `---\nname: ${name}\ndescription: "${description}"\n---\n\n# ${name}\n\nFollow the team's template for this task. Keep it concise.\n`)
  }
}
