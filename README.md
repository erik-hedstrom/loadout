[![CI](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml/badge.svg)](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml)
# loadout

Installed skills are listed in every request your agent sends, needed or
not. In Claude Code, listing 1,232 skills added **12,283 input tokens to each
request**, about 10 per skill. Codex caps its listing instead: of 1,262
installed skills it showed 424
([B1](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request),
with generated skill names).

loadout keeps your skills in a separate library, and a prompt hook in Claude
Code or Codex adds only the ones that fit each prompt, chosen by a cheap model
(TypeSafe's [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev))
for about $0.001 per routed prompt
([RESULTS](bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged)).

## Quickstart

Needs Node 22.12+, a TypeSafe API key, and the `claude` or `codex` CLI. The
npm package is not published yet, so install from the repository:

```bash
# 1. Install
git clone https://github.com/erik-hedstrom/loadout && cd loadout
npm ci && npm run build && npm link

# 2. Key and library
loadout init --key-file /path/to/typesafe-key.txt    # or export TYPESAFE_API_KEY
loadout add https://github.com/obra/superpowers       # or `loadout audit --adopt`: copy the skills you have

# 3. Plugin, for the CLI you use
claude plugin marketplace add erik-hedstrom/loadout && claude plugin install loadout@loadout
codex plugin marketplace add erik-hedstrom/loadout && codex plugin add loadout-codex@loadout   # then trust the hook in /hooks
```

- **Before step 2,** `loadout audit` shows what the skills and MCP servers
  you already have cost per request, per host. It only reads.
- **After step 3,** `loadout doctor` checks the key (one Jev call), library,
  index and hosts, and prints a fix for each gap.

Then start `claude` or `codex` as usual. Each routed prompt waits about 1.5 s
for the hook (p50, one machine,
[RESULTS](bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)).

**Privacy:** the hook runs in every project. Every routed prompt goes to
TypeSafe's Jev API, with the repository's top-level file names and dependency
names. `"router": "lexical"` in `~/.loadout/config.json` keeps prompts local.

**Tested so far:** the Claude Code plugin's hook in one CLI run, loaded from
a local folder rather than the marketplace; the Codex plugin install offline,
with a live hook session untested. Desktop apps and other
hosts are untested ([hosts](docs/hosts.md)). Details: [the hook plugins](docs/hook.md).

## What is measured

All numbers, caveats and negative results: [bench/RESULTS.md](bench/RESULTS.md).

- **Choices, on new held-out requests** (201 in the test split) against a
  1,262-skill library, judged by Claude Opus: a useful skill was loaded
  for 73% (62–81) of the requests that need one; 64% (55–72) of loaded skills
  were useful and 7% (4–13) would mislead
  ([C1](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)). It loads too
  readily on general business requests.
- **Agents use what they get:** when the launcher loaded a skill, Claude Code
  opened it in 9 of 10 headless sessions and Codex in 11 of 11. With the search
  tool plus the prompt hook, 6 of 10 Claude Code sessions opened a useful
  skill, against 2 of 10 with search alone
  ([RESULTS](bench/RESULTS.md#do-agents-use-what-they-are-given)).
- **Better work: not shown.** In an 8-request blind pilot with Codex,
  loadout's version won 4, lost 3 and split 1
  ([pilot](bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).
- **Small libraries:** loadout's search tools add 546 tokens per request in
  Claude Code, more than a native listing of 50 skills (477); the crossover is
  interpolated near 57 skills
  ([B1](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)).
  The Claude Code plugin adds only the hook, not these tools.

How it decides: [DESIGN.md](DESIGN.md). Security model: [SECURITY.md](SECURITY.md).
It works only through official extension points (plugins, hooks, MCP, CLI
flags) and never proxies an agent's API traffic.

## Use

```bash
loadout audit [--adopt]          # what installed skills cost per request; --adopt copies them to the library
loadout add <dir|github-url>     # add skills to the library
loadout list [--sources]         # show the library
loadout route "<task>"           # show the decision for a task
loadout setup <host>             # print setup for claude-code, codex, claude-desktop, cursor, opencode
loadout doctor                   # check key, library, index and hosts, with fixes
loadout mcp [--http]             # the library as an MCP server
loadout claude|codex "<task>"    # launch the agent with one up-front decision
```

- [The library](docs/library.md): adding skills and MCP servers, configuration.
- [The hook plugins](docs/hook.md): Claude Code and Codex, WSL, latency, privacy.
- [Hosts](docs/hosts.md): what was checked in which host.

## Search mid-session, from any MCP host

`loadout mcp` gives an agent `find_skills` and `load_skill`, for when the work
drifts. The Codex plugin attaches it; for Claude Code, Claude Desktop, Cursor,
OpenCode and ChatGPT, see [library search over MCP](docs/mcp.md).

## The launcher

`loadout claude "<task>"` and `loadout codex "<task>"` start the agent with one
decision made up front, including a model tier. The benchmarks use them; the
plugins are the everyday path. See [the launcher](docs/launcher.md).

## Development

```bash
npm test
npm run typecheck
npm run dev -- route "<task>"
```

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). License: Apache-2.0.
