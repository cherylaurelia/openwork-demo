// The skill index OpenWork's agent MCP appends to its server instructions, and the variants under test.
// `current` is a verbatim JS copy of skillIndexInstructions in
// ee/apps/den-api/src/mcp/skills-extension.ts (different-ai/openwork 27e266a).

const INDEX_DESCRIPTION_CHARS = 160
const HEADER = "Skills available to this member (load one with get_skill by its name before doing that kind of task):"

const countLine = (count) => `- …and ${count} more; call list_skills to see them all.`
const nudgeLine = (count) => `- …and ${count} more not shown. Most of this member's own skills may be among them: before writing a document, update, report or reply, call list_skills with a keyword from the request.`
const taskLine = (count) => `- …and ${count} more not shown, including most of this member's own skills. Before doing a task for the member, call list_skills with a keyword from the request and follow the matching skill.`
const broadLine = (count) => `- …and ${count} more not shown, including most of this member's own skills. Before writing, reviewing, comparing or planning anything for the member, call list_skills with a keyword from the request.`
const namedLine = (rest) => `- …and ${rest.length} more, by name: ${rest.map((skill) => skill.name).join(", ")}.`
const hintLine = (count) => `- …and ${count} more not shown, mostly this member's own skills. If the request might match one, call list_skills with a keyword from the request before answering.`

// `rest` writes the last line for the skills that got no description. `current` counts them;
// `names` is the proposed change (same code as the PR): name them when every name fits, else count.
function indexWith(more, skills, budgetChars, nameTheRest = false) {
  if (skills.length === 0 || HEADER.length + 1 + more(skills.length).length > budgetChars) return ""
  const rest = nameTheRest && HEADER.length + 1 + namedLine(skills).length <= budgetChars ? namedLine : (skipped) => more(skipped.length)
  const lines = []
  let used = HEADER.length

  for (const [index, skill] of skills.entries()) {
    const description = skill.description.length > INDEX_DESCRIPTION_CHARS
      ? `${skill.description.slice(0, INDEX_DESCRIPTION_CHARS - 1).trimEnd()}…`
      : skill.description

    const line = `- ${skill.name}: ${description}`
    const pointer = index === skills.length - 1 ? 0 : rest(skills.slice(index + 1)).length + 1

    if (used + line.length + 1 + pointer > budgetChars) {
      lines.push(rest(skills.slice(index)))
      break
    }

    lines.push(line)
    used += line.length + 1
  }

  return [HEADER, ...lines].join("\n")
}

// The PR (different-ai/openwork, fix/skill-index-name-the-rest): descriptions stop at half of the
// budget, the last line names as many of the other skills as fit, counts the rest, points at list_skills.
function indexSplit(skills, budgetChars) {
  const lines = skills.map((skill) => {
    const description = skill.description.length > INDEX_DESCRIPTION_CHARS
      ? `${skill.description.slice(0, INDEX_DESCRIPTION_CHARS - 1).trimEnd()}…`
      : skill.description

    return `- ${skill.name}: ${description}`
  })

  const all = [HEADER, ...lines].join("\n")

  if (skills.length > 0 && all.length <= budgetChars) return all

  const more = (names, unnamed) => {
    const listed = names.length > 0 ? `, by name: ${names.join(", ")}${unnamed > 0 ? `, and ${unnamed} others` : ""}` : ""

    return `- …and ${names.length + unnamed} more${listed}; call list_skills to see them all.`
  }

  if (skills.length === 0 || HEADER.length + 1 + more([], skills.length).length > budgetChars) return ""
  let described = 0
  let used = HEADER.length

  while (described < skills.length - 1 && used + 1 + lines[described].length <= budgetChars / 2) used += 1 + lines[described++].length
  const names = skills.slice(described).map((skill) => skill.name)
  let named = names.length

  while (named > 0 && used + 1 + more(names.slice(0, named), names.length - named).length > budgetChars) named--

  return [HEADER, ...lines.slice(0, described), more(names.slice(0, named), names.length - named)].join("\n")
}

// Built-in Cloud skills have `skill:<name>` capabilities; a member's own skills are `plugin:<id>:<id>`.
const ownFirst = (skills) => [...skills.filter((s) => !s.capability.startsWith("skill:")), ...skills.filter((s) => s.capability.startsWith("skill:"))]

export const VARIANTS = {
  current: (skills, budget) => indexWith(countLine, skills, budget),
  hint: (skills, budget) => indexWith(hintLine, skills, budget),
  nudge: (skills, budget) => indexWith(nudgeLine, skills, budget),
  task: (skills, budget) => indexWith(taskLine, skills, budget),
  broad: (skills, budget) => indexWith(broadLine, skills, budget),
  names: (skills, budget) => indexWith(countLine, skills, budget, true),
  split: (skills, budget) => indexSplit(skills, budget),
  "own-first": (skills, budget) => indexWith(countLine, ownFirst(skills), budget),
}

/** Replace the skill index at the end of `instructions`, keeping the 4,096-char budget the server uses. */
export function rebuildInstructions(instructions, skills, variant) {
  const at = instructions.indexOf(HEADER)

  if (at < 0) return instructions
  const rules = instructions.slice(0, at - 1)

  return `${rules}\n${VARIANTS[variant](skills, 4096 - rules.length - 1)}`
}

export { HEADER }
