// Read one `claude -p --output-format stream-json` log and say what the agent did with OpenWork skills.

const short = (name) => name.replace(/^mcp__openwork__/, "")

/** Strip Markdown emphasis and heading marks so `**WEEKLY UPDATE · …**` counts like the plain line. */
export const firstLine = (text) => (text.trim().split("\n")[0] ?? "").replace(/[*_#`>]/g, "").trim()

export function classifyRun(events, prompt) {
  const calls = []

  for (const event of events) {
    if (event.type !== "assistant") continue

    for (const part of event.message?.content ?? []) {
      if (part.type === "tool_use") calls.push({ name: short(part.name), input: part.input })
    }
  }

  const result = events.findLast((event) => event.type === "result")
  const answer = String(result?.result ?? "")
  const loaded = calls.flatMap((call) => (call.name === "get_skill" ? [String(call.input?.name ?? "")] : []))
  const listed = calls.filter((call) => call.name === "list_skills").length
  const openworkCalls = calls.filter((call) => !call.name.includes("__") && call.name !== "ToolSearch").length
  const loadedTarget = prompt.skill ? loaded.some((name) => name === prompt.skill || name.startsWith(`${prompt.skill}-`)) : null
  // Followed = loaded the team's skill and answered in its exact shape. The shape alone isn't enough:
  // an agent can title its own release notes "Release Notes v2.4" without ever reading the skill.
  const followed = prompt.skill ? loadedTarget && firstLine(answer).startsWith(prompt.marker) : null

  return { followed, loadedTarget, listed, loaded, openworkCalls, calls: calls.map((call) => call.name), answerStart: answer.slice(0, 120) }
}
