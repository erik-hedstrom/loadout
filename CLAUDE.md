@AGENTS.md

## Claude-specific notes

- Bench scripts call Claude through `claudeJson()` in `bench/lib.ts`
  (`claude -p` with stripped tools and settings). Long system prompts go
  through `--system-prompt-file`.
- Run judges at `--concurrency 1`; see [bench/README.md](bench/README.md) for
  the cost.
- Subagents (`worker`, `pr-reviewer`) and the loop:
  [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md).
- When you finish a task, leave the repo with `npm test` and
  `npm run typecheck` green and the backlog item updated.
