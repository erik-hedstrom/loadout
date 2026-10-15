# The multi-agent loop

One orchestrator session directs the work: Sol (Codex) builds, Claude
reviews. GitHub is the shared bus: `agent/*` branches, PRs, CI and
`docs/loop/BACKLOG.md`.

## Topology

```
 Erik's machine: Claude desktop app, Code tab (Opus 5.5, auto-compact at 500k)
 │
 ├── ORCHESTRATOR (main conversation): plans, briefs, tests, commits, opens PRs, merges, keeps BACKLOG.md
 │     ├── Sol: Codex gpt-6.1-sol through the Codex plugin's companion, one worktree per item
 │     ├── pr-reviewer subagent (.claude/agents/pr-reviewer.md): read-only, security + "should this exist"
 │     └── worker subagents (.claude/agents/worker.md): Claude-side items, one worktree each
 │
 ├── GitHub: erik-hedstrom/loadout: PRs, CI (full matrix behind the `ci-full` label), Codex automatic review
 │
 └── Cloud fallback: a Claude cloud session Erik starts when local usage runs out
       (no TypeSafe key, no Codex CLI, no companion; it opens PRs and does not merge)
```

### Local (the default)

- **Sol builds.** Each item gets a self-contained brief in the scratchpad
  and a worktree under `dev/sandbox/loadout-wt/<item>`. Run this in the
  worktree:
  `node <codex plugin>/scripts/codex-companion.mjs task --write --model gpt-6.1-sol --effort high --prompt-file <brief>`.
  - Sol's sandbox cannot write `.git`, reach the network or run vitest
    (EPERM). So briefs say "do not commit", and the orchestrator runs the
    tests, commits, pushes and opens the PR.
  - Fix rounds resume the thread with `--resume-last`.
  - Briefs tell Sol not to edit HANDOFF.md, because it tends to append
    working-tree notes there.
- **Claude reviews.** `pr-reviewer` runs on every PR. Resume the same
  subagent for re-reviews, so it keeps its context.
- **The Codex review** is a fresh Sol pass:
  `adversarial-review --base origin/main --model gpt-6.1-sol "<focus>"`.
  - Companion 1.0.6 takes `--base`, `--scope`, `--model` and `--cwd` for
    reviews, but not `--effort`, which would end up in the focus text.
  - Read the verdict with `sed -n '/^# Codex Adversarial Review/,$p'`.
  - The final head needs a Codex review. After a fix round, a delta review
    is enough: `--base <the head Codex last reviewed>`. pr-reviewer reviews
    the delta too.
  - Record each reviewed SHA in the PR.
  - The focus must request both correctness/security and a separate necessity
    pass under AGENTS.md rule 4. A clean bug pass is not simplification coverage.
- **Tests on both platforms.**
  - Windows: `npm test` and `npm run typecheck` in the worktree.
  - Linux: the same in WSL, in a clone that fetches the branch from the
    Windows checkout. The WSL-only `bench.test.ts` failure is known (E8).
- **Small docs edits and review fixes** can be done by the orchestrator
  itself. Anything larger goes to Sol or a `worker`.

### Cloud fallback

Erik starts a cloud session at claude.ai/code with the cloud prompt below
when his local Claude usage runs out.

- **What it lacks.** It has no TypeSafe key, no `codex` CLI and no companion,
  and it cannot run `claude -p` (AGENTS.md). Real-Jev runs, agent benchmarks
  and Sol builds wait for the local loop.
- **No judging there.** Do not run `bench/judge.ts` in a cloud session.
  Without `claude -p`, the session itself would answer the batches (the
  `files` backend): an agent with tools and push access, reading third-party
  catalog text. Locally, `claude -p` judges with no tools.
- **Building and review.** Claude `worker` subagents build, and `pr-reviewer`
  reviews. The Codex review is `@codex review` on the PR, using the
  adversarial request below, repeated on each new head. Erik may also run a
  local Codex review and leave its report for the orchestrator.
- **Hand-off.** It opens PRs and records their review state in the PR body.
  It does not merge. The next local run reads that state, runs the gate on
  the final head, and merges.

## Merge gate

- **CI on the full matrix.**
  - Once both reviews approve, add the `ci-full` label; PR pushes run Ubuntu
    only.
  - Check all six `ci` jobs and `build-without-optional` on the current head:
    `gh pr view N --json headRefOid,statusCheckRollup`. Main has no branch
    protection, so GitHub does not enforce this.
  - Windows on Node 22 can flake on 5 s subprocess timeouts:
    `gh run rerun <id> --failed`.
  - A job that fails with no steps never started. Read its check-run
    annotation: on 2026-10-12 it was the spending limit, before the repo went
    public.
- **`pr-reviewer` APPROVE.**
- **Codex review** of the final head, with no open High or Medium finding
  (AGENTS.md, "Severity and disposition"), from Sol through the companion or
  from Codex on GitHub.
- **Simplification coverage from both reviewers.** Record each finding's
  disposition: fixed, rebuttal accepted, or overridden by Erik. A GitHub
  thumbs-up or absence of comments alone does not prove this pass ran; if the
  GitHub report omits it, obtain an explicit local necessity review before
  merge.
- **Acceptance criteria met**, with the backlog row updated in the PR.

Squash-merge with `--delete-branch`, one PR at a time. After each merge, wait
until `mergeable` is no longer `UNKNOWN`. Resolve BACKLOG conflicts by keeping
both sides.

## Setup and budgets

- **Local.**
  - The Codex plugin is installed in Claude Code (the companion), and `gh` is
    logged in.
  - WSL has the library and key in `~/.loadout`, with `claude` and `codex`
    logged in.
- **GitHub.**
  - The repo is public, so Actions on standard runners is free.
  - The `ci-full` label.
  - Codex automatic review turned on.
- **Cloud environment (optional, Erik).**
  - Secret `TYPESAFE_API_KEY`.
  - Network access to `api.typesafe.ai`, `registry.npmjs.org`, `github.com`
    and `huggingface.co`.
- **Budgets.**
  - Cloud credit: $100 until 2026-11-05.
  - Jev: about $5 left, so ≤ $1 per iteration.
  - Codex: by plan.

## Iteration protocol

The orchestrator repeats this until it hits a stop condition.

1. **Sync.**
   - `git pull --ff-only` on a clean main checkout, so the backlog you read
     and the worktrees you create are current.
   - Read the backlog's status table and the iteration log, not the whole
     repo.
   - `gh pr list`. For each open PR, read its review state from the PR body
     and from comments by `chatgpt-codex-connector`. Cloud-session PRs and
     local Codex review reports (for example under an untracked `out/`) count
     as input to the gate, not as approval.
2. **Merge what is ready**, through the merge gate.
3. **Pick 2–4 tasks.**
   - Highest priority first, from different workstreams, touching
     non-overlapping files.
   - Work that makes loadout run in the default CLIs comes first (see the
     BACKLOG preamble).
   - In a cloud session, skip `lane: local`. Skip `lane: erik` unless Erik is
     present.
   - Respect `depends`.
4. **Dispatch.**
   - Code goes to Sol. The brief gives the item ID, its acceptance criteria,
     the files to stay within, the constraints, a budget, and "do not
     commit".
   - Claude-side items (judging, docs, bench analysis) go to `worker`
     subagents, in parallel in the background where they are independent.
     Use the `model` override `opus` for design-heavy items; Sonnet is the
     default.
5. **Review** each new PR with `pr-reviewer` and a fresh Sol
   `adversarial-review`. Findings go back to the author: Sol with
   `--resume-last`, workers through SendMessage.
6. **Log.** One row in the backlog's iteration log:
   - merged, in flight, blocked;
   - spend;
   - decisions needed from Erik.
7. **Stop and ask Erik** on:
   - any rule-4 action (public, publish, post);
   - a budget cap reached, the Actions limit included;
   - a result that changes the plan;
   - the same task failing twice;
   - a decision listed in HANDOFF.

## Context discipline (orchestrator)

The orchestrator's context is for coordination, not for doing the work.

- **Delegate.** Implementation goes to Sol or workers. Subagents return at
  most 200–400 words; ask for exactly what you need.
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

### Orchestrator (a Claude Code session in the desktop app)

```
You are the orchestrator for loadout (repo erik-hedstrom/loadout, this checkout).

Read, in this order and only these to start:
1. HANDOFF.md: state, evidence, goals, Erik's open decisions
2. AGENTS.md: rules every agent follows, including the Code Review Rules
3. docs/loop/ORCHESTRATOR.md: your protocol, the merge gate, context discipline
4. docs/loop/BACKLOG.md: the work queue and the iteration log

Sol builds, Claude reviews. Brief Sol (Codex gpt-6.1-sol, effort high) through the
Codex companion, one worktree per item. Review every PR with the pr-reviewer subagent
and a fresh Sol adversarial-review, then run the merge gate in ORCHESTRATOR.md. Take
open PRs from cloud sessions through the same gate.

Use these skills (Skill tool) at these points:
- codex:gpt-5-4-prompting: before writing each Sol brief. It is the Codex plugin's
  guide to prompts sent through the companion; it names GPT-5.4 but applies to Sol.
- superpowers:using-git-worktrees: when starting an item. Worktrees go under
  dev/sandbox/loadout-wt/<item>.
- superpowers:receiving-code-review: when pr-reviewer or Sol findings come back.
  Check each finding against the code, then fix it or decline it with a reason in
  the PR. AGENTS.md, "Severity and disposition", says when a declined finding clears.
- superpowers:systematic-debugging: on any failing test or CI job, before a fix.
- superpowers:verification-before-completion: before you call a PR ready, merge it,
  or write the iteration log row.
- impeccable: for any UI or visual work (README visuals, the demo GIF, the social
  preview). Tell Sol to use it too.
- council: before you bring Erik a decision that has several valid paths.
/codex:review and /codex:adversarial-review are user-only commands: run the companion
script as ORCHESTRATOR.md shows. codex:codex-rescue is a subagent, not a skill.

The repo is public: every push, PR and comment is public at once.

Keep your own context for coordination: read summaries, never bench/results rows,
node_modules, dist, lockfiles or full logs, and never re-read what you have already
summarised. Keep state in the repo (backlog statuses, iteration log, PR descriptions)
so you can resume after auto-compaction.

Never: print or commit secrets, edit the user's agent configs, change repo settings,
publish, or post. Draft those and ask Erik. Stop and ask Erik on a budget cap, a
decision listed in HANDOFF.md, or a task failing twice.

Goal: loadout works inside the claude and codex CLIs people already use, with no new
command to start their agent; three commands from zero to a routed prompt; a router
that is honestly measured and improving; a repo that reads as serious engineering.
Prefer deleting to adding. Start with the P0 items.
```

### Cloud session (claude.ai/code, when local usage runs out)

```
You are filling in for the loadout orchestrator in a cloud session (repo
erik-hedstrom/loadout). Read HANDOFF.md, AGENTS.md, docs/loop/ORCHESTRATOR.md
("Cloud fallback") and docs/loop/BACKLOG.md.

This session has no TypeSafe key, no codex CLI and no Codex companion, and cannot run
claude -p. Pick backlog items in lane `cloud` that need none of those. Build with
worker subagents, review with pr-reviewer, and request a Codex review on each PR with
the adversarial review request in ORCHESTRATOR.md, again on each new head. Do not run
bench/judge.ts. Record each PR's review state in its body. Do not merge: the local
orchestrator runs the merge gate.

If this session lists the superpowers skills, use them as the local orchestrator does:
receiving-code-review on review findings, systematic-debugging on failures, and
verification-before-completion before you call a PR ready.

The repo is public: every push, PR and comment is public at once. The rules in
AGENTS.md apply in full. Never print or commit secrets, edit the user's agent configs,
change repo settings, publish, or post.
```

### Sol brief (a file in the scratchpad)

```
# Task: <ID> <title> (branch agent/<workstream>-<slug>)
You are in a git worktree of loadout. Read AGENTS.md first; its hard rules apply.
Context: <what exists, file:line, the data involved>.
Acceptance: <copied from BACKLOG>. Stay within <files>.
Smallest change that meets it: no speculative options, single-use abstractions,
narrating comments or filler docs. Add tests in test/ (adversarial ones for security
paths). Your sandbox cannot run vitest; run `npx tsc --noEmit` if you can.
Do not edit HANDOFF.md. Do not commit. Reply with what changed, why, and anything
you were unsure about.
```

### Adversarial Codex review on GitHub (cloud sessions)

```
@codex review. This is an adversarial pass: assume the change is wrong until the
code proves otherwise. Apply the Code Review Rules in AGENTS.md, including
"Severity and disposition", as two passes: correctness/security, then necessity.
Report each pass, even when it is clean. Look for any other instance of each
finding's class anywhere in the PR.
```

## Lanes

| Lane | Where | Examples |
|---|---|---|
| `cloud` | Anywhere against GitHub, with no key or agent CLI: the local orchestrator, or a cloud session | code, tests, docs, CI, README, `loadout audit`, retrieval |
| `local` | Erik's machine, with his logged-in `claude` / `codex` and the TypeSafe key | `bench/invoke.ts`, `bench/outcome.ts`, sweeps, judges, Codex `/hooks` trust, demo recording |
| `erik` | Erik | repo settings, npm publish, posting, billing and secrets, budgets, decisions |
