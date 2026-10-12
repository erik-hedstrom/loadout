@AGENTS.md

## Claude-specific notes

- Bench scripts call Claude through `claudeJson()` in `bench/lib.ts`
  (`claude -p` with stripped tools and settings). Long system prompts go
  through `--system-prompt-file`.
- Subagents (`worker`, `pr-reviewer`) and the loop:
  [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md).
