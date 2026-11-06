# OpenWork MCP skill uptake bench

Unofficial demo by Cheryl Aurelia; not affiliated with OpenWork or Different AI.

## The problem

OpenWork's agent MCP (`https://api.openworklabs.com/mcp/agent`) ends its server instructions with an index
of the member's skills, so clients that show instructions to the model know which skills exist
(`skillIndexInstructions` in
[ee/apps/den-api/src/mcp/skills-extension.ts](https://github.com/different-ai/openwork/blob/dev/ee/apps/den-api/src/mcp/skills-extension.ts)).
The instructions are capped at 4,096 characters (Claude Code's limit), so the index describes the skills
that fit, in alphabetical order with the built-in skills mixed in, and ends with
`- …and N more; call list_skills to see them all.`

In a workspace with 39 skills, that cut falls around the letter "h". The bench asks Claude Code for four
team tasks whose skills sort after it (weekly update, release notes, vendor evaluation, translation
review) and checks whether the agent loads the skill and answers in its shape. The proxy can swap the
index text to try alternatives (`bench/skill-index.mjs`). Results and every run log are on the page
(`app/page.tsx`, data in `data/summary.json`).

Run logs are published through `bench/sanitize.mjs`: it keeps what the model said and called, OpenWork's
answers and the final result, and drops your local Claude Code setup and any local tool output.
Run it on new logs before committing them.

This is my own finding, not a user report. Only Claude Code (2.1.318, sonnet and haiku) was tested.

## What's here

- `bench/seed.mjs`: makes an anonymous, provisional OpenWork workspace with the documented agent
  registration (https://openworklabs.com/auth.md) and adds the skills in `bench/skills/` (plus 27 generic
  team skills with `--filler`). Workspaces expire after 72 hours. The assertion is written to the file you
  name with mode 0600 and never printed.
- `bench/proxy.mjs` + `bench/skill-index.mjs`: a local pass-through to the live MCP that adds the bearer
  token and can rebuild only the skill index. `current` is a verbatim copy of the server's function;
  `skill-index.test.mjs` checks that it reproduces the live instructions byte for byte.
- `bench/bench.mjs`: runs `claude -p --strict-mcp-config` against each variant, writes stream-json logs and
  `results.json`. `bench/classify.mjs` judges a run: followed = loaded the skill with `get_skill` and
  answered in its exact shape.
- `bench/serve.mjs`: serve one variant on localhost for any other MCP client.
- `bench/results/`: the runs shown on the page.

## Run it

Needs Node 22+ and a logged-in Claude Code.

```bash
cd bench
node seed.mjs ws-control.json
node seed.mjs ws-39.json --filler
node bench.mjs --workspace ws-control.json --variants live --label control
node bench.mjs --workspace ws-39.json --variants live,names --label big39
node summarize.mjs control=results/<…-control> "39 skills"=results/<…-big39>
cd .. && npm install && npm run dev
```

Tests: `npm test` (bench classifier, tally, index fidelity, page helpers). Lint: `npx oxlint`.
