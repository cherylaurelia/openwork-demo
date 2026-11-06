import { MODELS, REPO, SOURCE, bench, findCell, followedShare, logUrl, type Run } from "@/lib/bench";

const BIG = "39 skills";
const CONTROL = "control";
const CHOSEN = "names";
const REGRESSION = "regression";

const ROWS = [
  { workspace: CONTROL, variant: "live", label: "Control: 12 skills, all in the index", note: "live server, unchanged" },
  { workspace: BIG, variant: "live", label: "39 skills, today's index", note: "live server, unchanged" },
  { workspace: BIG, variant: "own-first", label: "Own skills listed before built-ins", note: "same count line" },
  { workspace: BIG, variant: "hint", label: "Overflow line: “if the request might match one”", note: "general wording" },
  { workspace: BIG, variant: "task", label: "Overflow line: “before doing a task”", note: "general wording; this round stopped early" },
  { workspace: BIG, variant: "broad", label: "Overflow line: “before writing, reviewing, comparing or planning”", note: "fewer requests in this round" },
  { workspace: BIG, variant: "nudge", label: "Overflow line: “before writing a document, update, report or reply”", note: "task-specific wording" },
  { workspace: BIG, variant: CHOSEN, label: "Describe what fits, name every other skill", note: "fewer requests in this round" },
  { workspace: BIG, variant: "split", label: "Half for descriptions, then names", note: "3 runs per request and model" },
] as const;

const SKILL_LABELS = new Map([
  ["weekly-update", "weekly update"],
  ["release-notes", "release notes"],
  ["vendor-evaluation", "vendor evaluation"],
  ["translation-review", "translation review"],
]);

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">{children}</p>;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-body">{children}</div>
    </section>
  );
}

function Share({ followed, runs, zeroIsGood }: { followed: number; runs: number; zeroIsGood: boolean }) {
  if (runs === 0) return <span className="text-muted">not run</span>;
  const tone = zeroIsGood ? (followed === 0 ? "text-status" : "text-miss") : followed === 0 ? "text-miss" : "text-ink";

  return (
    <span className={tone}>
      <span className="text-base font-semibold">{followed}</span>
      <span className="text-muted">/{runs}</span>
    </span>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-terminal p-4 font-mono text-[12.5px] leading-6 text-[#d6e2f0]">
      <code>{children}</code>
    </pre>
  );
}

function runVerdict(run: Run): string {
  if (run.followed === null) return run.openworkCalls > 0 ? `${run.openworkCalls} OpenWork calls` : "no OpenWork calls";

  if (run.followed) return "loaded and followed";

  if (run.loadedTarget) return "loaded, not followed";

  return run.calls.includes("list_skills") ? "searched, not loaded" : "never looked";
}

export default function Home() {
  const { cells, tails, indexStats, runs, metas } = bench;
  const share = (workspace: string, variant: string) => followedShare(MODELS.map((model) => findCell(cells, workspace, variant, model)));
  const control = share(CONTROL, "live");
  const today = share(BIG, "live");
  const proposed = share(BIG, CHOSEN);
  const targetPrompts = bench.prompts.filter((prompt) => prompt.skill !== null && prompt.skill !== "expense-report");
  const unrelatedPrompts = bench.prompts.filter((prompt) => prompt.skill === null);

  return (
    <main className="mx-auto max-w-[920px] px-5 pb-16 pt-8 md:pt-12">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-6 text-sm">
        <span className="font-semibold text-ink">OpenWork MCP · skill uptake bench</span>
        <nav className="flex gap-5 text-body">
          <a href={REPO}>Repo</a>
          <a href={`${REPO}/tree/main/bench`}>Bench</a>
          <a href={SOURCE}>skills-extension.ts ↗</a>
        </nav>
      </header>

      <section className="py-8 md:py-12">
        <Eyebrow>Unofficial demo · OpenWork agent MCP</Eyebrow>
        <h1 className="mt-3 max-w-[760px] text-[34px] font-semibold leading-[1.1] tracking-tight text-ink md:text-[48px]">
          Do agents actually use your team&apos;s OpenWork skills?
        </h1>
        <p className="mt-6 max-w-[680px] text-lg leading-8 text-body">
          <strong className="text-ink">Problem:</strong> a team shares skills through the OpenWork MCP, but nothing shows whether Claude Code
          picks them up from a plain request. <strong className="text-ink">Built:</strong> a bench that spins up a workspace with
          OpenWork&apos;s no-account agent sign-in, runs real Claude Code sessions against the live MCP and scores each run.
        </p>
        <p className="mt-3 max-w-[680px] text-lg leading-8 text-body">
          First finding: with {indexStats.skills} skills, the MCP&apos;s 4 KB skill index describes {indexStats.described} and ends with
          &ldquo;…and N more; call list_skills&rdquo;. Team skills past that line were followed in {today.followed} of {today.runs} plain
          requests, against {control.followed} of {control.runs} when they were inside the index. No index change tried here closes the gap:
          naming the skills and a task-specific overflow line each got {proposed.followed} of {proposed.runs}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={REPO} className="rounded-full bg-ink px-5 py-3 text-[15px] font-medium text-white no-underline hover:bg-terminal">
            Bench repo
          </a>
          <a href="#run" className="rounded-full border border-border bg-tonal px-5 py-3 text-[15px] font-medium text-ink no-underline">
            Run it with your SKILL.md files
          </a>
        </div>
      </section>

      <Section eyebrow="Result" title="How often the team's skill was followed">
        <p>
          Same workspace, same {targetPrompts.length} plain requests for 4 team skills that sort late (
          {[...new Set(targetPrompts.map((prompt) => SKILL_LABELS.get(prompt.skill ?? "") ?? prompt.skill))].join(", ")}),{" "}
          {metas[0]?.reps ?? 2} runs each per model. Followed = the agent loaded the skill with <code>get_skill</code> and answered in its exact
          shape. Unrelated = {unrelatedPrompts.length} requests no skill covers; the column counts runs that called OpenWork anyway.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-tonal font-mono text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Skill index</th>
                {MODELS.map((model) => (
                  <th key={model} className="px-4 py-3 font-medium">
                    {model}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Unrelated, extra calls</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const rowCells = MODELS.map((model) => findCell(cells, row.workspace, row.variant, model));
                const extra = rowCells.reduce((sum, cell) => sum + (cell?.unrelatedWithCalls ?? 0), 0);
                const of = rowCells.reduce((sum, cell) => sum + (cell?.unrelatedRuns ?? 0), 0);

                return (
                  <tr key={`${row.workspace}-${row.variant}`} className={`border-t border-border ${row.variant === CHOSEN ? "bg-[#f3f8ff]" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{row.label}</div>
                      <div className="text-xs text-muted">{row.note}</div>
                    </td>
                    {rowCells.map((cell, i) => (
                      <td key={MODELS[i]} className="px-4 py-3">
                        <Share followed={cell?.followed ?? 0} runs={cell?.targetRuns ?? 0} zeroIsGood={false} />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <Share followed={extra} runs={of} zeroIsGood />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>
          Regression check: expense-report is described today and only named in that variant. Asked for an expense report, both models
          followed it {share(REGRESSION, "live").followed}/{share(REGRESSION, "live").runs} today and {share(REGRESSION, CHOSEN).followed}/
          {share(REGRESSION, CHOSEN).runs} with names.
        </p>
        <p className="text-sm text-muted">
          Claude Code {(metas[0]?.claudeCode ?? "").replace(" (Claude Code)", "")}, models sonnet and haiku, {runs.length} runs in total, small samples (2 runs per request
          and model, 3 for the half-and-half row). Every run&apos;s log is linked below.
        </p>
      </Section>

      <Section eyebrow="What the agent sees" title="The last lines of the instructions">
        <p>
          The server describes as many skills as fit (here {indexStats.described} of {indexStats.skills}, built-ins included) and counts the rest.
          With today&apos;s line, no run called <code>list_skills</code> to find them. With their names in the index, Sonnet went straight to{" "}
          <code>get_skill</code> for the weekly-update and release-notes skills, as it does for described ones. Vendor-evaluation and
          translation-review stayed hard for both versions, as in the control; Haiku rarely loads any skill but weekly-update, even in the control. 
        </p>
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Today</p>
        <Code>{tails.current}</Code>
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Naming the rest</p>
        <Code>{tails[CHOSEN]}</Code>
      </Section>

      <Section eyebrow="What could change it" title="Index variants, tested through a proxy">
        <p>
          The index is built by <code>skillIndexInstructions</code> in <a href={SOURCE}>ee/apps/den-api/src/mcp/skills-extension.ts</a>. The
          bench&apos;s proxy swaps only that text, so a variant can be tried against the live MCP before anyone changes the server. Rewording the
          overflow line helped only when the wording matched the task; naming the skills worked without that, at a cost: {indexStats.describedWithNames}{" "}
          skills keep a description instead of {indexStats.described} (or {indexStats.describedWithSplit} when half of the budget is kept for
          descriptions). These are small samples on one client, so they show where to look, not a verdict.
        </p>
      </Section>

      <Section eyebrow="Why it was fun to build" title="A workspace in two HTTP calls">
        <p>
          OpenWork&apos;s <a href="https://openworklabs.com/auth.md">agent sign-in</a> made this possible without an account: one POST returns
          a provisional workspace and a signed assertion, one token exchange gives an MCP token, and <code>create_skill</code> fills it. Every
          run here used a fresh, self-expiring workspace, and the MCP&apos;s own instructions told the agent which skills existed. That&apos;s
          what made the index measurable at all.
        </p>
      </Section>

      <Section eyebrow="Method" title="How it was run (and how to run it)">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Two anonymous workspaces made with OpenWork&apos;s own agent registration (<a href="https://openworklabs.com/auth.md">auth.md</a>
            ): a control with the built-ins and 4 team skills, and one with 27 more generic team skills (39 in all). Both expire on their own
            after 72 hours. No sign-in, nothing claimed or connected.
          </li>
          <li>
            Claude Code ran headless (<code>claude -p --strict-mcp-config</code>) with the OpenWork MCP as its only server, in an empty folder
            with no CLAUDE.md or AGENTS.md above it.
          </li>
          <li>
            Variants go through a local proxy in front of the live <code>api.openworklabs.com/mcp/agent</code> that rebuilds only the skill
            index at the end of <code>initialize</code>. Its copy of the server&apos;s function reproduces the live instructions byte for byte
            (a test checks this), and the live server&apos;s own text through the proxy scored the same as without it.
          </li>
          <li>
            This is my own measurement; no user has reported the index issue. Only Claude Code was tested: Codex couldn&apos;t run on this machine, and hosts that
            support the Skills Extension (SEP-2640) don&apos;t use the index at all.
          </li>
        </ul>
        <p id="run">Point it at your own skills by putting SKILL.md files in <code>bench/skills/</code> and requests in <code>prompts.json</code>:</p>
        <Code>{`cd bench
node seed.mjs ws-control.json            # control workspace
node seed.mjs ws-39.json --filler        # 39-skill workspace
node bench.mjs --workspace ws-39.json --variants live,${CHOSEN} --reps 2
node serve.mjs ws-39.json ${CHOSEN} 8810       # point any MCP client at it`}</Code>
      </Section>

      <Section eyebrow="Every run" title="Logs">
        <details className="rounded-2xl border border-border bg-tonal/60 p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">{runs.length} runs: verdict, tool calls, log</summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="font-mono uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Workspace · index</th>
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">Request</th>
                  <th className="py-2 pr-3 font-medium">Verdict</th>
                  <th className="py-2 font-medium">Log</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.log} className="border-t border-border">
                    <td className="py-1.5 pr-3">
                      {run.workspace} · {run.variant}
                    </td>
                    <td className="py-1.5 pr-3">{run.model}</td>
                    <td className="py-1.5 pr-3">
                      {run.prompt} #{run.rep}
                    </td>
                    <td className={`py-1.5 pr-3 ${run.followed === false ? "text-miss" : run.followed ? "text-status" : ""}`}>{runVerdict(run)}</td>
                    <td className="py-1.5">
                      <a href={logUrl(run.log)}>jsonl</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      <footer className="border-t border-border pt-6 text-sm text-muted">
        Unofficial demo by Cheryl Aurelia: not affiliated with OpenWork or Different AI. OpenWork&apos;s name is used only to describe what was
        tested.
      </footer>
    </main>
  );
}
