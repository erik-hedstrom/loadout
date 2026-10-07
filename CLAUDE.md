@AGENTS.md

## Claude-specific notes

- Bench scripts call Claude through `claudeJson()` in `bench/lib.ts`
  (`claude -p` with stripped tools and settings).
  - Long system prompts go through `--system-prompt-file`.
  - Keep judges at `--concurrency 1` with large batches, so the catalog stays
    cached: about $0.10 per 20-request batch instead of $0.90 cold.
- Subscription session limits have been hit during long judge or agent runs.
  Prefer the Anthropic API with prompt caching (or the Message Batches API at
  half price) for large judging jobs once backlog item E7 lands.
- When you finish a task, leave the repo with `npm test` and
  `npm run typecheck` green and the backlog item updated.
