# Changelog

## Unreleased

## 0.1.0

### Added

- npm package `@erik-hedstrom/loadout`, which installs the `loadout` command and ships `dist/`, LICENSE, NOTICE and README only; the plugins install from the repository's marketplace, not from npm ([package.json](https://github.com/erik-hedstrom/loadout/blob/main/package.json), [release workflow](https://github.com/erik-hedstrom/loadout/blob/main/.github/workflows/release.yml), [releasing](https://github.com/erik-hedstrom/loadout/blob/main/CONTRIBUTING.md#releasing)).
- `loadout init`, a setup wizard with starter packs; it never edits host configs ([#30](https://github.com/erik-hedstrom/loadout/pull/30)).
- `loadout audit --adopt` prints paste-ready snippets that hide the adopted skills' native listings in Claude Code and Codex; it edits no host config ([#66](https://github.com/erik-hedstrom/loadout/pull/66)).
- `--isolate` for `loadout claude|codex` keeps your own MCP servers out of one launch; its flags were checked against the hosts' documentation, with no live run ([#32](https://github.com/erik-hedstrom/loadout/pull/32)).
- The prompt hook warns once per session when it runs without a TypeSafe key ([#27](https://github.com/erik-hedstrom/loadout/pull/27)).
- The config option `"skillFolders": false` makes the hook and `load_skill` offer `load_skill` only, with no skill folder ([#54](https://github.com/erik-hedstrom/loadout/pull/54)).
- Jev-routed selection: skills, MCP servers and model tier per session that
  `loadout claude` or `loadout codex` launches (`loadout route` prints the same
  decision without launching), skills per prompt except short follow-ups (a
  prompt hook for Claude Code; the Codex hook has not run live, backlog D2),
  skill search and loading (`loadout mcp`; over HTTP too, skills only, with a
  token required beyond localhost) plus an opt-in gateway to library MCP
  servers over stdio, `loadout setup <host>` config printing, and
  `loadout list --sources`. These came in direct commits before PRs were used.
- `loadout audit`: an inventory estimate of your installed skill listings, before host caps; `--adopt` copies the skills it finds into the library ([#3](https://github.com/erik-hedstrom/loadout/pull/3)).
- `loadout doctor`, a read-only setup check ([#20](https://github.com/erik-hedstrom/loadout/pull/20)).
- Claude Code plugin with the prompt hook ([#9](https://github.com/erik-hedstrom/loadout/pull/9)) and a Codex plugin carrying the hook and search server (install checked offline; the hook needs /hooks trust; a live run is pending under D2) ([#23](https://github.com/erik-hedstrom/loadout/pull/23)).
- MCP discovery: `find_tools` (renamed from `find_skills`) also matches gateway servers by the tool names and descriptions `server_tools` remembers; search never starts a server. `server_tools` output is bounded, with argument names and then bare names once it passes 12,000 characters ([#39](https://github.com/erik-hedstrom/loadout/pull/39)).
- Host capability matrix ([#18](https://github.com/erik-hedstrom/loadout/pull/18)) and host-neutral session skills ([#21](https://github.com/erik-hedstrom/loadout/pull/21)).
- Judge backends for Claude and offline files, and a Codex backend that refuses to run while the Codex CLI keeps its exec tools on, as codex-cli 0.160.1 does (backlog E12) ([#5](https://github.com/erik-hedstrom/loadout/pull/5)).
- Measurements: the Claude Code input-token increase from installed skill listings in fresh sessions, with generated skill names, and for Codex only offline rendered-prompt characters ([#6](https://github.com/erik-hedstrom/loadout/pull/6); [B1 results](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)), routing re-measured after the Jev framing change ([#7](https://github.com/erik-hedstrom/loadout/pull/7)), and 300 new held-out requests, where on their 201-request test split recall holds and precision falls ([#16](https://github.com/erik-hedstrom/loadout/pull/16); [C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)), and an MCP overhead study harness, with no runs yet ([#38](https://github.com/erik-hedstrom/loadout/pull/38)).
- Apache-2.0 license, NOTICE, CONTRIBUTING, SECURITY, and issue and PR templates ([#1](https://github.com/erik-hedstrom/loadout/pull/1)).
- GitHub Actions CI on Ubuntu, macOS and Windows, Node 22 and 24 ([#2](https://github.com/erik-hedstrom/loadout/pull/2)).
- Measurements, all with their scope and limits in [bench/RESULTS.md](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md):
  - [B12](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#b12-results-2026-10-28-what-installed-skills-cost-per-request-on-current-hosts): the cost of installed skill listings per request on current Claude Code and Codex, and of loadout's search tools. These are single requests in fresh sessions; whole sessions are not measured ([#67](https://github.com/erik-hedstrom/loadout/pull/67)).
  - [C13](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c13-2026-10-16-pure-jev-baseline-on-main): the routing baseline on main ([#45](https://github.com/erik-hedstrom/loadout/pull/45)).
  - [C14 rerun](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c14-rerun-2026-10-26-codex-luna-with-the-fixes): three prompts on Codex, with and without loadout. Loadout added uncached input tokens on all three; better work is not shown ([#64](https://github.com/erik-hedstrom/loadout/pull/64), [#65](https://github.com/erik-hedstrom/loadout/pull/65)).
  - [B11 replacement pilot](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#b11-replacement-pilot-2026-10-23-completed-2026-10-26): it does not establish retained quality or size break-even; the full study has not run ([#57](https://github.com/erik-hedstrom/loadout/pull/57), [#63](https://github.com/erik-hedstrom/loadout/pull/63)).
  - [C15 harness and preregistration](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c15-method-preregistered), native library against loadout: the study has not run ([#69](https://github.com/erik-hedstrom/loadout/pull/69)).

### Changed

- Prompt-hook follow-ups skip hook start-up, and the relay loads on demand ([#14](https://github.com/erik-hedstrom/loadout/pull/14)).
- Routing (`loadout route`, the launcher, the prompt hook and `loadout mcp`) caches parsed library metadata and re-parses only changed manifests ([#24](https://github.com/erik-hedstrom/loadout/pull/24)).
- Requires Node 22.12 or newer (was 20) ([#2](https://github.com/erik-hedstrom/loadout/pull/2), [#1](https://github.com/erik-hedstrom/loadout/pull/1)).
- `loadout setup claude-code` and `loadout setup codex` print the plugin install commands; the settings and TOML snippets print instead with `--windows`, or under WSL when the bare `claude` or `codex` on `PATH` is a Windows install (with only `claude.exe` or `codex.exe` on `PATH`, pass `--windows`) ([#9](https://github.com/erik-hedstrom/loadout/pull/9), [#23](https://github.com/erik-hedstrom/loadout/pull/23)).
- SECURITY.md and the issue templates send vulnerability reports to GitHub's private vulnerability reporting instead of the maintainer directly; it was still off in the repo settings on 2026-10-12 ([#22](https://github.com/erik-hedstrom/loadout/pull/22)).
- Simplified `src/` ([#12](https://github.com/erik-hedstrom/loadout/pull/12)), `bench/` (`bench/outcome` loses `--agent`) ([#11](https://github.com/erik-hedstrom/loadout/pull/11)) and the docs ([#15](https://github.com/erik-hedstrom/loadout/pull/15)).
- CI runs the full matrix only on PRs labelled `ci-full` ([#13](https://github.com/erik-hedstrom/loadout/pull/13)).
- The `server_tools` description is constant, so the tool list does not change when the library's servers do ([#59](https://github.com/erik-hedstrom/loadout/pull/59)).
- The README leads with the problem and a three-step quickstart ([#28](https://github.com/erik-hedstrom/loadout/pull/28)).

### Fixed

- A disconnected MCP client cancels its Jev calls ([#19](https://github.com/erik-hedstrom/loadout/pull/19)).
- The build works without the optional `@huggingface/transformers` package ([#8](https://github.com/erik-hedstrom/loadout/pull/8)).
- On Windows, a host installed only as `claude.exe` or `codex.exe` is found ([#52](https://github.com/erik-hedstrom/loadout/pull/52)).
- A hook state folder that cannot be written no longer drops the prompt's context ([#49](https://github.com/erik-hedstrom/loadout/pull/49)).

### Security

- MCP credential relay for the Codex launcher: env and header values stay out of Codex's argv, environment and session files. The Claude launcher writes them into the session's `mcp.json`, which is created with POSIX mode 0600 (on Windows it inherits the folder's permissions). Reports show only MCP type, command, cwd, URL origin and key names. Diagnostics carry only controlled metadata (the escaped server name, URL origin, HTTP status, MCP error code or errno), never upstream error text. Skill copies reject links and keep a pinned root and size budgets. Jev prompts frame library text as third-party data ([#4](https://github.com/erik-hedstrom/loadout/pull/4), [#10](https://github.com/erik-hedstrom/loadout/pull/10)).
- `server_tools` escapes upstream tool text, remembered tool lists are read as untrusted data, and cache and state folders under the loadout home must be real folders, not links ([#39](https://github.com/erik-hedstrom/loadout/pull/39)).
- `loadout doctor` runs no CLI from a relative `PATH` entry and gives its version checks an allowlisted environment only ([#20](https://github.com/erik-hedstrom/loadout/pull/20)).
- Key-shaped strings are replaced with a fixed token before a prompt, goal or keywords go to Jev ([#53](https://github.com/erik-hedstrom/loadout/pull/53)).
