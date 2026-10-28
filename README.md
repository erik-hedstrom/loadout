# loadout

[![CI](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml/badge.svg)](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml) [![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Claude Code and Codex list your installed skills in every request, needed or
not. With 50 real skills installed, Claude Code 2.1.308 (Haiku) added
**8,049 input tokens** to each request and Codex 0.163 (gpt-6-luna) 4,484.
At 1,235 skills Claude Code added 15,030, and Codex removed every
description and left 888 skills out of its list. loadout's own search tools
added 158 tokens per request in Claude Code. These are single requests in
fresh sessions; whole sessions are not measured
([B12](bench/RESULTS.md#b12-results-2026-10-28-what-installed-skills-cost-per-request-on-current-hosts)).

loadout keeps your skills in a separate library, and a prompt hook in Claude
Code or Codex adds the ones predicted to fit each substantive prompt. A cheap
model (TypeSafe's [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev))
makes the prediction, for about $0.001 per routing decision on the v4
benchmark's requests
([RESULTS](bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged)).

loadout's [MCP tools](docs/mcp.md) let the agent search the library, and MCP
servers you opt into the gateway are offered there too (untested in a host).
The [launcher](docs/launcher.md) instead makes one decision per session:
skills, MCP servers and a model tier. Tier-choice quality is not evaluated
([RESULTS](bench/RESULTS.md#threats-to-validity)). Host checks and untested
paths: [hosts](docs/hosts.md).

## Quickstart

Needs Node 22.12+, a TypeSafe API key, and the `claude` or `codex` CLI. The
npm package is not published yet, so install from the repository:

```bash
# 1. Install
git clone https://github.com/erik-hedstrom/loadout && cd loadout
npm ci && npm run build && npm link

# 2. Key and library
loadout init --key-file /path/to/typesafe-key.txt    # or export TYPESAFE_API_KEY
# Optional starter pack: loadout init --pack documents
loadout add https://github.com/obra/superpowers       # or `loadout audit --adopt`: copy the skills you have

# 3. Plugin, for the CLI you use
claude plugin marketplace add erik-hedstrom/loadout && claude plugin install loadout@loadout
codex plugin marketplace add erik-hedstrom/loadout && codex plugin add loadout-codex@loadout   # then trust the hook in /hooks
```

- **Before step 2,** `loadout audit` estimates, per host, the tokens your
  installed skills' descriptions add (characters divided by 4, a fixed rule
  of thumb that is not measured, before host caps) and lists your MCP servers
  without counting their schemas. It only reads.
- **After step 3,** `loadout doctor` checks the key (one Jev call when Jev
  routing is on and a key is found), library, index and hosts, and prints a
  fix for each gap.

Adopted skills keep costing tokens until you move or disable them in each
host ([library](docs/library.md#skills)).

Then start `claude` or `codex` as usual. Latency and setup details:
[the hook plugins](docs/hook.md).

**Privacy:** with a key set, the hook sends the text of each prompt event
except short follow-ups such as "yes" or "go on", in every project, to
TypeSafe's Jev API with repository and skill details. `"router": "lexical"` in
`~/.loadout/config.json` (under `$LOADOUT_HOME` when set) keeps prompts local.
What is sent, and from where:
[privacy](docs/hook.md#privacy).

## What is measured

All numbers, caveats and negative results: [bench/RESULTS.md](bench/RESULTS.md).

- **Choices, on new held-out requests** (201 in the test split, written by
  gpt-6.1-sol; provenance unverified) against a 1,262-skill library, judged
  by Claude Opus: a useful skill was loaded for 73% (62–81) of the requests
  that need one; 64% (55–72) of loaded skills were useful and 7% (4–13) would
  mislead; these two intervals ignore within-request correlation
  ([C1](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)). On C1's general
  business requests it loaded too readily.
- **Agents use what they get,** in headless runs capped at 4 minutes
  (Claude Code on Sonnet 5.5, also capped at 8 turns; Codex on gpt-6.1-sol):
  when the launcher loaded a skill, Claude Code opened one in 9 of 10 sessions
  (Wilson 95%: 60–98%) and Codex in 11 of 11 (74–100%). With the search tool,
  useful-skill use in Claude Code went from 2 of 10 (6–51%) to 6 of 10
  (31–83%) sessions when the prompt hook was added from settings.json
  ([RESULTS](bench/RESULTS.md#do-agents-use-what-they-are-given)).
  The hook-only plugin injected full skill text in 6 of 10 sessions
  (31–83%); no library skill was opened (0–28%; headless, WSL behind Windows,
  where folder reads were not permitted). Whether the injected text was
  followed is not shown ([same study](bench/RESULTS.md#do-agents-use-what-they-are-given)).
- **Better work: not shown.** In an 8-request, nominally blind pilot with
  Codex (gpt-6.1-sol, 6-minute cap), where the loadout arm got the judge's
  top skill, it won 4 (22–78%), lost 3 (14–69%) and split 1 (2–47%)
  ([pilot](bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).
- **Search tools:** their token cost (measured only in the first request of
  fresh Claude Code sessions) and how often agents used them:
  [library search](docs/mcp.md#cost-and-privacy).

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
- [Library search over MCP](docs/mcp.md): `find_tools` and `load_skill`
  mid-session, and how to set it up per host.
- [The launcher](docs/launcher.md): `loadout claude|codex`, one decision up
  front, including a model tier.
- [Hosts](docs/hosts.md): what was checked in which host.

## Development

```bash
npm test
npm run typecheck
npm run dev -- route "<task>"
```

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). License: Apache-2.0.
