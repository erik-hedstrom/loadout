[![CI](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml/badge.svg)](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml)
# loadout

Agents list your installed skills in their requests, needed or not. In
Claude Code, 1,232 skills under generated names added **12,283 input tokens**
to a fresh session's first request, about 10 per skill; with real names, and
in later turns: not shown. Codex caps its listing instead: of 1,262 installed
skills, it showed 424 in an offline render
([B1](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)).

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

- **Before step 2,** `loadout audit` estimates, per host, the tokens your
  installed skills' descriptions add (about 4 characters per token, before
  host caps) and lists your MCP servers without counting their schemas. It
  only reads.
- **After step 3,** `loadout doctor` checks the key (one Jev call), library,
  index and hosts, and prints a fix for each gap.

Skills copied with `audit --adopt` stay listed by the agents, and keep
costing tokens, until you move them out of the agents' own folders;
`audit --adopt` prints how for each host.

Then start `claude` or `codex` as usual. Latency and setup details:
[the hook plugins](docs/hook.md).

**Privacy:** the hook sends each routed prompt, in every project, to
TypeSafe's Jev API with repository and skill details. `"router": "lexical"`
in `~/.loadout/config.json` keeps prompts local; the hook then adds context
only for prompts that name a skill. What is sent, and from where:
[privacy](docs/hook.md#privacy).

**Tested so far:** the Claude Code CLI hook in one run; the Codex plugin
install offline only ([hosts](docs/hosts.md)).

## What is measured

All numbers, caveats and negative results: [bench/RESULTS.md](bench/RESULTS.md).

- **Choices, on new held-out requests** (201 in the test split) against a
  1,262-skill library, judged by Claude Opus: a useful skill was loaded
  for 73% (62–81) of the requests that need one; 64% (55–72) of loaded skills
  were useful and 7% (4–13) would mislead
  ([C1](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)). It loads too
  readily on general business requests.
- **Agents use what they get:** when the launcher loaded a skill, Claude Code
  opened it in 9 of 10 headless sessions (Wilson 95%: 60–98%) and Codex in 11
  of 11 (74–100%). Adding the prompt hook to the search tool raised
  useful-skill use in Claude Code from 2 of 10 (6–51%) to 6 of 10 (31–83%)
  sessions
  ([RESULTS](bench/RESULTS.md#do-agents-use-what-they-are-given)).
- **Better work: not shown.** In an 8-request blind pilot with Codex,
  loadout's version won 4, lost 3 and split 1
  ([pilot](bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).
- **Small libraries:** in Claude Code, the one host measured, the MCP search
  tools cost more tokens than a native listing
  ([details](docs/mcp.md#cost-and-privacy)). The Claude Code plugin
  adds only the hook, not these tools.

How it decides: [DESIGN.md](DESIGN.md). Security model: [SECURITY.md](SECURITY.md).
It works only through official extension points (plugins, hooks, MCP, CLI
flags) and never proxies an agent's API traffic.

## Use

```bash
loadout audit [--adopt]          # estimate installed skills' listing tokens; --adopt copies them to the library
loadout add <dir|github-url>     # add skills to the library
loadout list [--sources]         # show the library
loadout route "<task>"           # show the decision for a task
loadout setup <host>             # print setup for claude-code, codex, claude-desktop, cursor, opencode
loadout doctor                   # check key, library, index and hosts, with fixes
loadout mcp [--http]             # the library as an MCP server
loadout claude "<task>"          # launch Claude Code with one up-front decision
loadout codex "<task>"           # launch Codex with one up-front decision
```

- [The library](docs/library.md): adding skills and MCP servers, configuration.
- [The hook plugins](docs/hook.md): Claude Code and Codex, WSL, latency, privacy.
- [Library search over MCP](docs/mcp.md): `find_skills` and `load_skill`
  mid-session, in Claude Code, Codex, Claude Desktop, Cursor, OpenCode and
  ChatGPT.
- [The launcher](docs/launcher.md): `loadout claude|codex`, one decision up
  front, including a model tier; used by the benchmarks.
- [Hosts](docs/hosts.md): what was checked in which host.

## Development

```bash
npm test
npm run typecheck
npm run dev -- route "<task>"
```

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). License: Apache-2.0.
