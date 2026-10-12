# Changelog

## Unreleased

### Added

- Jev-routed selection of skills, MCP servers and model tier per session or
  prompt (`loadout route`, the launcher, `loadout mcp`, and a prompt hook for
  Claude Code and Codex). These came in direct commits before PRs were used.
- `loadout audit`: an inventory estimate of what your installed skills add to each request ([#3](https://github.com/erik-hedstrom/loadout/pull/3)).
- `loadout doctor`, a read-only setup check ([#20](https://github.com/erik-hedstrom/loadout/pull/20)).
- Claude Code plugin with the prompt hook ([#9](https://github.com/erik-hedstrom/loadout/pull/9)) and a Codex plugin carrying the hook and search server, installed offline, with a live run pending under D2 ([#23](https://github.com/erik-hedstrom/loadout/pull/23)).
- Host capability matrix ([#18](https://github.com/erik-hedstrom/loadout/pull/18)) and host-neutral session skills ([#21](https://github.com/erik-hedstrom/loadout/pull/21)).
- Judge backends for Claude, Codex and offline files ([#5](https://github.com/erik-hedstrom/loadout/pull/5)).
- Measurements: what installed skills cost per request ([#6](https://github.com/erik-hedstrom/loadout/pull/6); [B1 results](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)), routing re-measured after the Jev framing change ([#7](https://github.com/erik-hedstrom/loadout/pull/7)), and 300 new held-out requests where recall holds and precision falls ([#16](https://github.com/erik-hedstrom/loadout/pull/16); [C1](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).
- Apache-2.0 license, NOTICE, CONTRIBUTING, SECURITY and issue templates ([#1](https://github.com/erik-hedstrom/loadout/pull/1)).
- GitHub Actions CI on Ubuntu, macOS and Windows, Node 22 and 24 ([#2](https://github.com/erik-hedstrom/loadout/pull/2)).

### Changed

- Prompt-hook follow-ups skip hook start-up, and the relay loads on demand ([#14](https://github.com/erik-hedstrom/loadout/pull/14)).
- Parsed library metadata is cached for routed prompts ([#24](https://github.com/erik-hedstrom/loadout/pull/24)).
- Simplified `src/` ([#12](https://github.com/erik-hedstrom/loadout/pull/12)), `bench/` ([#11](https://github.com/erik-hedstrom/loadout/pull/11)) and the docs ([#15](https://github.com/erik-hedstrom/loadout/pull/15)); numbers in docs trace to RESULTS.
- CI runs the full matrix once per PR, behind the `ci-full` label ([#13](https://github.com/erik-hedstrom/loadout/pull/13)).
- Contributor and agent docs: the stock `claude` and `codex` CLIs come first ([#22](https://github.com/erik-hedstrom/loadout/pull/22)).

### Fixed

- A disconnected MCP client cancels its Jev calls ([#19](https://github.com/erik-hedstrom/loadout/pull/19)).
- The build works without the optional `@huggingface/transformers` package ([#8](https://github.com/erik-hedstrom/loadout/pull/8)).

### Security

- MCP credential relay, an allowlist for reports, and fixed-text diagnostics ([#4](https://github.com/erik-hedstrom/loadout/pull/4), [#10](https://github.com/erik-hedstrom/loadout/pull/10)).
- `loadout doctor` runs no CLI from a relative `PATH` entry and gives its version checks an allowlisted environment only ([#20](https://github.com/erik-hedstrom/loadout/pull/20)).
