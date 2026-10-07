# The multi-agent loop

One orchestrator session directs work by Claude and Codex. Everything runs in
the cloud against the GitHub repo. Erik's machine is only needed for tasks
that use his logged-in agent CLIs or desktop apps.

## Topology

```
 Claude cloud session (claude.ai/code, repo erik-hedstrom/loadout, Opus 5.5)
 │  paid by the cloud-session credit ($100, expires 2026-11-05)
 │  auto-compact at 500k tokens (.claude/settings.json)
 │
 ├── ORCHESTRATOR (main conversation): plans, dispatches, merges, keeps BACKLOG.md
 │     ├── worker subagents   (.claude/agents/worker.md, own worktree + branch each)
 │     └── pr-reviewer subagent (.claude/agents/pr-reviewer.md, read-only: security + "should this exist")
 │
 ├── GitHub: erik-hedstrom/loadout  ← the shared bus: agent/* branches, PRs, CI, BACKLOG.md
 │     └── Codex on GitHub: "@codex <task>" (cloud task), "@codex review", "@codex security review"
 │
 └── local lane (Linux machine, Erik's logged-in CLIs): bench/invoke.ts, bench/outcome.ts,
       Codex /hooks trust, desktop-app checks, demo recording
```

- **The credit:** it pays for cloud sessions, not Routines or Projects. So
  the orchestrator is a long cloud session that Erik starts, not a scheduled
  routine. Claude-side work runs as subagents inside it; their tokens come out
  of the same credit.
- **Codex** is reached through GitHub. A PR or issue comment `@codex <task>`
  starts a Codex cloud task on that branch. `@codex review` and
  `@codex security review` post reviews. Erik can also submit tasks from his
  machine with `codex cloud exec --env <id>`.
- **Every PR gets two reviews** against the `## Code Review Rules` in
  `AGENTS.md`:
  - the `pr-reviewer` subagent;
  - Codex on GitHub.

  Findings go back to the author before the merge.

## One-time setup (Erik)

1. **Claude cloud.**
   - GitHub is connected. Make sure the Claude GitHub app can access the
     private repo `erik-hedstrom/loadout`, including pushing branches and
     opening PRs.
   - In the environment the session uses, add the secret `TYPESAFE_API_KEY`.
   - Allow network access to `api.typesafe.ai`, `registry.npmjs.org`,
     `github.com` and `huggingface.co` (the embedding model download).
2. **Codex.** At https://chatgpt.com/codex:
   - Connect the repo to a Codex environment: setup script
     `npm ci && npm run build`, secret `TYPESAFE_API_KEY`, the same internet
     access.
   - Turn on **Automatic review** for the repo (code review settings).
3. **Budget.** Write the caps here (Erik decides):
   - the cloud credit: $100 until 2026-11-05;
   - Jev: about $6 left, so ≤ $1 per iteration;
   - Codex: by plan.
4. **Decisions.** Answer the blocking decisions in [HANDOFF.md](../../HANDOFF.md):
   license, public timing, npm name, hook default.
5. **Start the session.** At claude.ai/code:
   - pick the repo;
   - choose Opus 5.5;
   - paste the orchestrator prompt below.

   If the session's Claude Code is older than v2.1.288, run
   `/autocompact 500000` first. The repo setting covers newer versions.

## Iteration protocol

The orchestrator repeats this until it hits a stop condition.

1. **Sync.**
   - `git pull`.
   - Read the backlog's status table and the iteration log, not the whole
     repo.
   - Check open PRs, CI and Codex comments: `gh pr list`, `gh pr checks`,
     `gh pr view N --comments`, if `gh` works.
2. **Merge what is ready:**
   - CI green;
   - `pr-reviewer` APPROVE;
   - Codex review without unresolved High or Medium findings;
   - acceptance criteria met.

   Squash-merge, then update the backlog.
3. **Pick 2–4 tasks.**
   - Highest priority first, from different workstreams, touching
     non-overlapping files.
   - Skip `lane: local` and `lane: erik` unless Erik is present.
   - Respect `depends`.
4. **Dispatch.**
   - Claude tasks go to `worker` subagents, run in parallel in the background
     where the tasks are independent. Pass the item ID, its acceptance
     criteria, files to stay within and a budget. Use the `model` override
     `opus` for design-heavy items; Sonnet is the default.
   - Codex tasks: open a draft PR or issue for the item and comment
     `@codex <worker brief>`.
5. **Review** each new PR:
   - run `pr-reviewer` with the PR number;
   - comment `@codex review`, plus `@codex security review` for
     security-relevant changes, unless automatic review already ran.
   - Send the findings to the author: resume the same `worker`, or comment
     `@codex <fix these>` on the PR.
6. **Log.** One row in the backlog's iteration log:
   - merged, in flight, blocked;
   - spend;
   - decisions needed from Erik.
7. **Stop and ask Erik** on:
   - any rule-4 action (public, publish, post);
   - a budget cap reached;
   - a result that changes the plan;
   - the same task failing twice;
   - a decision listed in HANDOFF.

## Context discipline (orchestrator)

The orchestrator's context is for coordination, not for doing the work.

- **Delegate.** Implementation, investigation and reading code go to
  subagents. Subagents return at most 200–400 words; ask for exactly what you
  need.
- **Read summaries, not sources:**
  - `git diff --stat`, `gh pr view --json title,files,additions,deletions`;
  - the backlog tables;
  - the first lines of RESULTS sections.
- **Never read:** `bench/results/**` rows, `node_modules`, `dist`, lockfiles,
  full logs or transcripts.
- **Use** `wc -l`, `grep -c`, `head` and `jq` to check facts.
- **Do not repeat work:** don't re-read a file you have already summarised,
  and don't re-run a subagent's checks yourself. Trust them, then spot-check
  one claim.
- **Persist state in the repo, not in context:**
  - backlog statuses;
  - the iteration log;
  - PR descriptions.

  After compaction, rebuild state from those.
- **Auto-compaction** happens at 500k tokens. Before a large step, write
  anything you would hate to lose into the iteration log.

## Prompts

### Orchestrator (paste into the cloud session)

```
You are the orchestrator for loadout (repo erik-hedstrom/loadout, this checkout).

Read, in this order and only these to start:
1. HANDOFF.md: state, evidence, goals, Erik's open decisions
2. AGENTS.md: rules every agent follows, including the Code Review Rules
3. docs/loop/ORCHESTRATOR.md: your protocol, context discipline, review gate
4. docs/loop/BACKLOG.md: the work queue and the iteration log
Your subagents are defined in .claude/agents/: `worker` (implements one backlog
item on its own branch and worktree) and `pr-reviewer` (read-only review for security
and for code or text that should not exist).

Run the iteration protocol from ORCHESTRATOR.md and repeat it until a stop condition.
Delegate all implementation and investigation to subagents or Codex. Keep your own
context for coordination: read summaries, never bench/results rows, node_modules,
dist, lockfiles or full logs, and never re-read what you have already summarised.
Keep state in the repo (backlog statuses, iteration log, PR descriptions) so you can
resume after auto-compaction at 500k tokens.

Every PR needs CI green, a pr-reviewer APPROVE and a Codex review on GitHub before
you merge it. The result must read like careful engineering: prefer deleting to
adding, and reject filler code and filler text.

Never: print or commit secrets, edit the user's agent configs, make anything public,
publish, or post. Draft those and ask Erik. Stop and ask Erik on a budget cap, a
decision listed in HANDOFF.md, or a task failing twice.

Goal of the loop: wide adoption of loadout among people who install hyped skill packs
and waste tokens on them. That means a README and onboarding that take a newcomer
from zero to a routed session in three commands, a router that is honestly measured
and improving, and a repo that reads as strong, serious engineering on Erik's
GitHub. Start with the P0 items.
```

### Codex task (comment on a PR or issue)

```
@codex Work on backlog item <ID> in docs/loop/BACKLOG.md. Follow AGENTS.md exactly.
Acceptance criteria: <copy>. Stay within <files>. Smallest change that meets them; no
speculative options, single-use abstractions, narrating comments or filler docs.
Run npm test and npm run typecheck. Update the item's status in BACKLOG.md. Commit
with the Co-Authored-By line from AGENTS.md. Report: what changed, test output, cost.
```

### Review request (comment on a PR)

```
@codex review against the Code Review Rules in AGENTS.md. Prioritise security
(secrets, user configs, untrusted skill text, file access) and anything that should
be deleted rather than kept.
```

## Lanes

| Lane | Where | Examples |
|---|---|---|
| `cloud` | Orchestrator session subagents, or Codex on GitHub | code, tests, docs, CI, README, `loadout audit`, retrieval, sweeps and judges through an API key |
| `local` | Linux machine with Erik's logged-in `claude` / `codex` | `bench/invoke.ts`, `bench/outcome.ts`, Codex `/hooks` trust, desktop-app setups, demo recording |
| `erik` | Erik | going public, npm publish, posting, GitHub app and secrets, budgets, decisions |
