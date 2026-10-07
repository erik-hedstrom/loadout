# The multi-agent loop

One orchestrator directs workers from two vendors: Anthropic (Claude Code) and
OpenAI (Codex). Most work runs **in the cloud** against the GitHub repo. Erik's
machine is needed only for tasks that use his logged-in agent CLIs or desktop
apps.

## Topology

```
                     ┌──────────────── GitHub: erik-hedstrom/loadout ────────────────┐
                     │  main ◄── PRs from agent/* branches · docs/loop/BACKLOG.md     │
                     └──────▲──────────────────▲───────────────────────▲──────────────┘
                            │ push/PR          │ push/PR               │ reads, merges
             ┌──────────────┴─────┐  ┌─────────┴──────────┐  ┌────────┴─────────────────┐
             │ Claude cloud       │  │ Codex Cloud tasks  │  │ ORCHESTRATOR             │
             │ sessions / routines│  │ (codex cloud exec) │  │ Claude Opus 5.5          │
             │ Opus/Sonnet 5.5    │  │ gpt-6.1-sol        │  │ cloud routine, or /loop  │
             └────────────────────┘  └────────────────────┘  │ on the Linux machine     │
                                                             └──────────────────────────┘
          Local-only lane (Linux machine, Erik's logged-in CLIs): agent-in-the-loop
          benchmarks (bench/invoke.ts, bench/outcome.ts), desktop-app checks, /hooks trust
```

- **The bus is GitHub:** branches, PRs, and the backlog file. Agents never
  share state any other way. Every decision and result lands in a PR or in
  `docs/loop/BACKLOG.md`.
- **Cross-vendor review:**
  - Claude's PRs are reviewed by Codex (`codex review`, or a Codex Cloud task
    "review PR #N").
  - Codex's PRs are reviewed by Claude.

  This held up well: five Codex review rounds found 40+ real issues in
  Claude's work.
- **The orchestrator owns merges and the backlog.** Workers own their branch
  only.

## One-time setup (Erik)

1. **Claude cloud.**
   - At https://claude.ai/code, give the Claude GitHub app access to the
     private repo `erik-hedstrom/loadout`.
   - In the "Dev" environment (`env_01AyP9ufhZvwzrX4yNpxrMgo`), add the
     secret `TYPESAFE_API_KEY`.
   - Allow network access to `api.typesafe.ai`, `registry.npmjs.org`,
     `github.com` and `huggingface.co` (the embedding model download).
   - Routines and cloud sessions then clone the repo, run `npm ci`, and push
     `agent/*` branches.
2. **Codex Cloud.** At https://chatgpt.com/codex, create an environment for
   `erik-hedstrom/loadout`:
   - setup script `npm ci && npm run build`;
   - secret `TYPESAFE_API_KEY`;
   - internet access to the same hosts.

   Write its id here: `CODEX_ENV=<env id>`. Tasks are then submitted with
   `codex cloud exec --env $CODEX_ENV --branch main "<brief>"`, from any
   machine logged into Codex, and fetched with `codex cloud diff|apply <task>`
   or as PRs.
3. **Budget.** Write the caps here (Erik decides):
   - Jev: $1 per iteration, ~$6 of credit left on 2026-10-07;
   - Claude credits: $100 available, suggested $10 per day;
   - Codex: by plan.
4. **Decisions.** Answer the blocking decisions in [HANDOFF.md](../../HANDOFF.md)
   (license, public timing, npm name), or the orchestrator will keep asking.

## Iteration protocol (orchestrator)

Run it every few hours as a cloud routine, or on demand with `/loop`.

1. **Sync.**
   - Pull `main`. Read `HANDOFF.md`, `AGENTS.md`, `docs/loop/BACKLOG.md`.
   - Check open PRs, CI status and the cloud tasks in flight
     (`codex cloud list`; the routine run list).
2. **Merge what is ready:** green CI, a cross-vendor review approved, and the
   acceptance criteria checked. Update the backlog.
3. **Pick 2–4 tasks.**
   - Highest priority first, from different workstreams, touching
     non-overlapping files.
   - Skip anything marked `needs: erik` or `lane: local` unless Erik is
     available.
   - Respect `depends`.
4. **Dispatch** each task with the worker brief below, to the vendor in its
   `agent` column:
   - **Claude:** a cloud session, either `claude --cloud "<brief>"` run from a
     checkout of the repo (`claude --teleport <session>` pulls one back
     locally), or a one-shot routine with `run_once_at`, repo
     `erik-hedstrom/loadout`, model `claude-opus-5-5` for design-heavy work,
     `claude-sonnet-5-5` otherwise.
   - **Codex:** `codex cloud exec --env $CODEX_ENV --branch main "<brief>"`.
5. **Review** each incoming PR with the other vendor (review brief below).
   Send the findings back to the author as a follow-up task on the same
   branch.
6. **Report.** Append an iteration entry to the backlog's log, and keep a
   running cost total:
   - merged, in flight, blocked;
   - spend;
   - decisions needed from Erik.
7. **Stop and ask Erik** when you reach:
   - a rule-4 action (going public, publishing, posting);
   - a budget cap;
   - a failing result that changes the plan;
   - the same task failing twice.

## Worker brief (template)

```
You are working on loadout (https://github.com/erik-hedstrom/loadout). First read
AGENTS.md (rules), HANDOFF.md (state) and the backlog item below in
docs/loop/BACKLOG.md. Follow AGENTS.md exactly: never print secrets, never touch the
user's agent configs, nothing public.

Task <ID>: <title>
Why: <one or two sentences from the backlog>
Acceptance criteria:
- <copied from the backlog>
Constraints: <files to stay within; budget: e.g. ≤ $0.50 of Jev; no new runtime deps>

Work on branch agent/<id>-<slug> from main. Make small commits. Run `npm test` and
`npm run typecheck`; both must pass. Open a PR titled "<ID>: <title>" whose body
says: what changed, how you tested it (commands + output), cost incurred, what is
left. Update the item's status in docs/loop/BACKLOG.md in the same PR. If something
needs Erik's decision, stop and say so in the PR instead of guessing.
```

## Review brief (template, other vendor)

```
Adversarially review PR #<N> in erik-hedstrom/loadout (branch agent/...). Read AGENTS.md
first. Read-only: do not push. Check correctness, security (secrets, path handling,
prompt-injection framing of third-party skill text, anything that edits user config),
evaluation discipline (no tuning on test, honest claims), tests for each fix, and
whether the backlog acceptance criteria are met. Output a numbered list by severity
(High/Medium/Low) with file:line, a concrete failure scenario and a fix, then
"APPROVE" or "CHANGES REQUESTED".
```

## Orchestrator prompt (paste into a cloud routine or a `/loop` session)

```
You are the orchestrator for loadout (https://github.com/erik-hedstrom/loadout).
Read HANDOFF.md, AGENTS.md, docs/loop/ORCHESTRATOR.md and docs/loop/BACKLOG.md, then
run ONE iteration of the protocol in ORCHESTRATOR.md: sync, merge what is ready,
pick 2–4 tasks, dispatch them with the worker brief to the vendor named in the
backlog, request cross-vendor reviews, update the backlog log with results, spend and
decisions needed. Respect every rule in AGENTS.md, in particular: nothing public
without Erik, no secrets in output, no edits to user agent configs, budget caps.
Goal of the whole loop: wide adoption of loadout among people who install hyped skill
packs and waste tokens on them, a README and onboarding that take a newcomer from
zero to a routed session in three commands, an honestly measured and improving
router, and a repo that reads as strong, serious engineering on Erik's GitHub.
```

## Lanes

| Lane | Runs where | Examples |
|---|---|---|
| `cloud` | Claude cloud or Codex Cloud | code, tests, docs, CI, README, `loadout audit`, retrieval work, sweeps and judges through the Anthropic API |
| `local` | Linux machine with Erik's logged-in `claude` / `codex` | `bench/invoke.ts`, `bench/outcome.ts`, Codex `/hooks` trust, desktop-app setups (Claude Desktop, Cursor), demo recording |
| `erik` | Erik himself | going public, npm publish, posting, connecting GitHub apps, secrets, budgets |
