# Changelog

## Unreleased

### Added

- Jev-routed selection: skills, MCP servers and model tier per session that
  `loadout claude` or `loadout codex` launches (`loadout route` prints the same
  decision without launching), skills per prompt except short follow-ups (a
  prompt hook for Claude Code and Codex), skill search and loading plus an
  opt-in gateway to library MCP servers (`loadout mcp`, also over HTTP with a
  token for remote hosts), `loadout setup <host>` config printing, and
  `loadout list --sources`. These came in direct commits before PRs were used.
- `loadout audit`: an inventory estimate of your installed skill listings, before host caps ([#3](https://github.com/erik-hedstrom/loadout/pull/3)).
- `loadout doctor`, a read-only setup check ([#20](https://github.com/erik-hedstrom/loadout/pull/20)).
- Claude Code plugin with the prompt hook ([#9](https://github.com/erik-hedstrom/loadout/pull/9)) and a Codex plugin carrying the hook and search server (install checked offline; the hook needs /hooks trust; a live run is pending under D2) ([#23](https://github.com/erik-hedstrom/loadout/pull/23)).
- Host capability matrix ([#18](https://github.com/erik-hedstrom/loadout/pull/18)) and host-neutral session skills ([#21](https://github.com/erik-hedstrom/loadout/pull/21)).
- Judge backends for Claude and offline files, and a Codex backend that refuses to run while the Codex CLI keeps its exec tools on, as codex-cli 0.160.1 does (backlog E12) ([#5](https://github.com/erik-hedstrom/loadout/pull/5)).
- Measurements: the Claude Code input-token increase from installed skill listings in fresh sessions, with generated skill names, and for Codex only an offline rendered-prompt count ([#6](https://github.com/erik-hedstrom/loadout/pull/6); [B1 results](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)), routing re-measured after the Jev framing change ([#7](https://github.com/erik-hedstrom/loadout/pull/7)), and 300 new held-out requests, where on their 201-request test split recall holds and precision falls ([#16](https://github.com/erik-hedstrom/loadout/pull/16); [C1](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).
- Apache-2.0 license, NOTICE, CONTRIBUTING, SECURITY, and issue and PR templates ([#1](https://github.com/erik-hedstrom/loadout/pull/1)).
- GitHub Actions CI on Ubuntu, macOS and Windows, Node 22 and 24 ([#2](https://github.com/erik-hedstrom/loadout/pull/2)).

### Changed

- Prompt-hook follow-ups skip hook start-up, and the relay loads on demand ([#14](https://github.com/erik-hedstrom/loadout/pull/14)).
- Routing (`loadout route`, the launcher, the prompt hook and `loadout mcp`) caches parsed library metadata and re-parses only changed manifests ([#24](https://github.com/erik-hedstrom/loadout/pull/24)).
- SECURITY.md and the issue templates send vulnerability reports to GitHub's private vulnerability reporting instead of the maintainer directly; it was still off in the repo settings on 2026-10-12. docs/hosts.md dates two host notes ([#22](https://github.com/erik-hedstrom/loadout/pull/22)).
- Simplified `src/` ([#12](https://github.com/erik-hedstrom/loadout/pull/12)), `bench/` ([#11](https://github.com/erik-hedstrom/loadout/pull/11)) and the docs ([#15](https://github.com/erik-hedstrom/loadout/pull/15)).
- CI runs the full matrix only on PRs labelled `ci-full` ([#13](https://github.com/erik-hedstrom/loadout/pull/13)).

### Fixed

- A disconnected MCP client cancels its Jev calls ([#19](https://github.com/erik-hedstrom/loadout/pull/19)).
- The build works without the optional `@huggingface/transformers` package ([#8](https://github.com/erik-hedstrom/loadout/pull/8)).

### Security

- MCP credential relay, an allowlist for reports, and fixed-text diagnostics ([#4](https://github.com/erik-hedstrom/loadout/pull/4), [#10](https://github.com/erik-hedstrom/loadout/pull/10)).
- `loadout doctor` runs no CLI from a relative `PATH` entry and gives its version checks an allowlisted environment only ([#20](https://github.com/erik-hedstrom/loadout/pull/20)).
