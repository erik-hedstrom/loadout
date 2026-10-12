@AGENTS.md

## Claude-specific notes

- Bench scripts call Claude through `claudeJson()` in `bench/lib.ts`
  (`claude -p` with stripped tools and settings).
  - Long system prompts go through `--system-prompt-file`.
  - Keep judges at `--concurrency 1` with large batches, so the catalog stays
    cached: about $0.10 per 20-request batch instead of $0.90 cold.
- Subscription session limits have been hit during long judge or agent runs.
  Run judges locally, never in a cloud session: judge prompts carry the
  third-party catalog, and a cloud session can push to GitHub.
- Subagents: `worker` implements one backlog item on its own worktree and
  branch; `pr-reviewer` reviews a PR read-only, for security and for code or
  text that should not exist. See [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md).
- Auto-compact is set to 500k tokens in `.claude/settings.json`.
- When you finish a task, leave the repo with `npm test` and
  `npm run typecheck` green and the backlog item updated.
