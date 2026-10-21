# C2 protocol: does the small tier plus loadout match the large tier?

Backlog item C2. The fixtures and this protocol were written before any run.

## Provenance of the tasks

- Claude Opus 5.5 (a Claude Code worker session; model from the commit's
  Co-Authored-By line) wrote all 18 tasks, their inputs and `KEY.md` on
  2026-10-12. It did not read the skill library (`bench/data/library*`, skill
  lists) or `requests*.jsonl`, but it had `bench/RESULTS.md` in context, which
  names library skills (`contract-review`, `xlsx`, `statistical-analysis` and
  others). So the tasks are not independent of the library:
  - `data-ab-test` repeats the outcome pilot's A/B task;
  - the office tasks mirror the docx, xlsx, pptx and pdf skills in
    anthropics/skills.
- The tasks sit in areas where skills exist; results say nothing about work
  outside them. Inputs are hand-written or produced by
  [make_inputs.py](make_inputs.py) (seeded, repeatable byte for byte). All
  names, companies and numbers are invented.
- 4 tasks are controls (`ctl-*`) where no skill should help; a gain there
  points at the harness or the judge. No tuning happens on these tasks, so all
  18 are test tasks; a change that follows from the results is re-tested on
  new tasks.

## Isolation

The repo is public and holds the answers (`KEY.md`, the generator). `Bash` runs
without limits, so the sandbox, not the tool list, is the boundary: the
container below, and `claude`'s own Bash sandbox, which leaves `Bash` no
network (see [Arms](#arms)). A run does not start until the container meets all
of this:
- **A container or VM, one per run, destroyed after it.** A throwaway user on
  the host does not qualify: it shares the host's files, processes, disk and
  network. Nothing is mounted back; the runner copies the outputs out.
- **Nothing from the host.** No bind mounts or host volumes (the run folder is
  a fresh volume), no container-runtime socket, no `--privileged`, no added
  capabilities, `no-new-privileges`, and a non-root user inside. No checkout,
  and none of `~/.claude`, `~/.codex`, `~/.loadout`, an SSH agent or a cloud
  credential: the batch's keys, in `<keys>`, are the only credentials inside
  (Credentials and spend). So the Docker tasks (`devops-*`) cannot run
  `docker`; the judge reads the files.
- **Limits set from outside**: CPU, memory, process count, disk for the run
  folder and the writable layer, and the 15-minute wall clock.
- **Egress enforced outside the container** (a network rule, not a setting
  inside it). The only routes are TCP 443 to the Anthropic API host and, in the
  `small-loadout` arm, the Jev host, at the addresses the resolver below returns
  for those names. Denied: everything else, the host, other containers,
  private and link-local addresses (cloud metadata included). WebFetch and
  WebSearch are also disallowed, as a tool setting only. Nothing of the harness
  sits on the traffic to the two hosts.
- **Name resolution is egress too.** A lookup of `<secret>.attacker.example`
  reaches the attacker's name server with no connection from the container, so
  a skill can encode a credential into DNS labels. The only resolver the
  container can reach is the harness's. It answers those two names exactly (no
  wildcard or suffix match) and REFUSED for every other, forwarding nothing. It
  keeps counters, never names (answered, refused, forwarded, which must stay 0,
  per run, and a flag set when a query equals the self-check's canary). The
  egress rule denies port 53, DNS over TLS (853) and DNS over HTTPS elsewhere.
- Each run starts in a fresh folder holding a copy of only that task's `inputs`
  from [index.json](index.json) (not `task.md`, not `KEY.md`).
- The plugin is a copy of `plugins/loadout` outside the checkout; `loadout`
  comes from a packed build (`npm pack`), not from the checkout. `Write` and
  `Edit` run outside the Bash sandbox (sandboxing page), so what feeds the hook,
  `loadout mcp` and the lazy import in `src/embed.ts` is root-owned and
  read-only, outside the run folder and the temp directory: the plugin copy, the
  `loadout` install with its `node_modules`, and the library and `config.json`
  of `LOADOUT_HOME`. Only `<home>/sessions` (hook state) and `<home>/index`
  (metadata and embedding caches) are writable by hook/MCP, keeping normal
  cache writes behind the home deny (Arms).
- Nothing can be installed during a run, so the image, the same for all arms,
  holds Node 22+, Python 3 with python-docx, openpyxl, python-pptx, pypdf,
  pdfplumber, pandas and matplotlib, and sqlite3. Versions go into the results.
- **Collection, checks and text extraction run in a second sandbox.** When
  `claude` exits, or the runner stops it at the cap, the runner stops the
  container. Its state must read stopped, with no process left in its cgroup,
  before anything else happens; that kills every process the agent started,
  background ones included. A fresh sandbox from the same image then gets the
  run volume mounted read-only, with no network at all, no credentials and the
  limits in the table below. It runs the collector, the text extraction and the
  check script. They execute or parse what the agent wrote (`node --test`,
  unittest, docx and pptx files), so they never run on Erik's machine, and the
  host never walks, opens or parses the agent's folder itself.
- **The collector looks before it opens, and every later step on the agent's
  bytes has a bound** ([COLLECTION.md](COLLECTION.md)); a violation fails the
  run as `output rejected` (see [Arms](#arms)).
- Runs and judging happen on a local machine where the CLIs are logged in.

The smoke run starts with a self-check from two places: the container as a
plain process (the runner's exec), and `claude`'s Bash tool with the settings
under Arms. It passes when:
- In the container: no host path and no runtime socket exist, and there is no
  route to the host or to a metadata address.
- In the container, connection: a TCP connect to a literal outside IP address
  fails. (A literal address takes name resolution out of the test.)
- In the container, resolution, apart from connection: a lookup of a canary
  name through the container's resolver fails or is refused; the same lookup
  sent to a public resolver, over port 53 and 853, gets no answer; and the
  resolver's counters show the canary flag set, refused up by the lookups made
  and forwarded still 0. The canary is a random label under a domain the
  operator controls, if its name server logs queries (it must see nothing),
  plus a name that does not exist.
- Control: the Anthropic host's name resolves and the smoke run's first request
  with the batch's key succeeds, so a dead network cannot pass.
- The configured limits show.
- In `claude`'s Bash tool, a runner-owned sink, started by a runner exec inside
  the container and outside the Bash sandbox, counts connections per nonce on a
  TCP port bound to all addresses, a UDP port and an AF_UNIX socket at a nonce
  path. `Bash` tries each with its own nonce: a TCP connect to the loopback
  address and to the container's own address; a UDP datagram; the unix socket;
  `curl --noproxy '*'`; a request through the proxy variables; a SOCKS attempt
  through `ALL_PROXY`; and each of these again with
  `dangerouslyDisableSandbox: true`. It passes only if the sink's count for
  every nonce is 0, never the tool output in the stream, which the model can
  forge. Control: the same attempts from a runner exec must each be counted, so
  a dead sink cannot pass. Also the sandbox is on (a write outside the run
  folder fails with `Read-only file system`, a symlink made in it is not
  followed) and no process outside the sandbox is visible in `/proc`.
- The credential-read probe under Credentials and spend, and no
  `enableWeakerNestedSandbox` in the effective settings.

Its output goes into the results.

## Credentials and spend

Each arm calls its vendor directly (AGENTS.md rule 1). Unreadable keys, spend
limits, batch revocation and usage checks replace a gateway.

- **A workspace and a key per batch** (an arm; the smoke run). It needs a
  Console organization: the Admin and Usage APIs "are unavailable for individual
  accounts" ([usage and cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api),
  read 2026-10-14). The workspace's monthly spend limit
  ([workspaces](https://platform.claude.com/docs/en/manage-claude/workspaces),
  same date) is the batch's approved cap, so the plan runs inside one calendar
  month. The page gives no enforcement delay, so the limit backs up the
  pre-check under Expected spend. The key expires in 7 days (the Console offers
  3 hours to 30 days,
  [authentication](https://platform.claude.com/docs/en/manage-claude/authentication)),
  so a forgotten key dies by itself.
- **The threat.** Third-party skills can request a credential read and a
  pre-approved `find_tools` call. That call runs outside
  the Bash sandbox and sends `goal` (up to 4,000 characters) and `keywords` to
  Jev: a key could stay live in logs until batch revocation, up to about 27 h. Revocation
  cannot undo that. Anthropic already holds the key for the model's own turns.
- **Layer 1, the primary one: the agent cannot read a key.**
  - Both keys are under `<keys>`, outside the run folder.
    The Anthropic key reaches `claude` through `apiKeyHelper`, a harness-owned
    command that prints the file, with `ANTHROPIC_API_KEY` unset because the
    variable outranks the helper ([authentication](https://code.claude.com/docs/en/authentication),
    read 2026-10-14), so it is in no environment and no argv. The docs do not
    say the helper runs under `-p`; the smoke run checks, and if it does not,
    the key goes in the environment and the fresh `/proc` is the layer. The Jev
    key is the file `jev.apiKeyFile` names, not an MCP `env` entry: the hook has
    no configured `env`.
  - **The rule: `Bash` and its children cannot read `<keys>` or `<home>`.**
    The helper, hook and `loadout mcp` run outside it "with your full access"
    ([sandboxing](https://code.claude.com/docs/en/sandboxing)). Permission rules
    alone cannot block arbitrary Python or Node file reads
    ([permissions](https://code.claude.com/docs/en/permissions)). Each path:

    | Path | OS layer for `Bash` and its children | `claude`'s own tools (fence, then rule) |
    |---|---|---|
    | key files in `<keys>` | `sandbox.filesystem.denyRead` and `sandbox.credentials.files` (`deny`) | fence; `Read`, `Edit(//<keys>/**)` |
    | all of `<home>`, caches included | `sandbox.filesystem.denyRead` | fence; `Read`, `Edit(//<home>/**)` |
    | `/proc/<pid>/{environ,cmdline,root,cwd,fd,mem,maps}` of `claude`, `loadout mcp`, the hook | the default bubblewrap sandbox mounts a fresh `/proc` (below) | fence; `Read(//proc/**)` |
    | helper script, `$SETTINGS` | no key in either; both live in `<keys>`, so `Bash` cannot read them, and it writes only in the run folder | fence; `Edit(//<keys>/**)` |
    | temp copies, environment, argv | none holds a key: no step writes a copy (`--no-session-persistence`, no `--debug`), `ANTHROPIC_API_KEY` is unset, the Jev key is a file | |

    Sandbox paths use `/` for absolute, permission paths `//`; "A `denyRead`
    entry doesn't stop the Read tool", so both kinds are needed.
  - **Other spellings of a path.** For symlinks the docs say a deny rule applies
    "when either the requested path or the file it resolves to matches"; on hard
    links, `..`, `/dev/fd/*`, `/proc/self/*`, `/proc/thread-self/*`, relative
    paths and case they say nothing, so the protocol relies on none of it. The
    `permissions.blockReadsOutsideWorkingDirectories` denies `Read`, `Grep`,
    `Glob` and `LSP` outside working directories in every permission mode
    ([settings](https://code.claude.com/docs/en/settings-reference)), and
    `acceptEdits` approves edits only inside them
    ([permission modes](https://code.claude.com/docs/en/permission-modes)).
    Assumption, probed below: outside spellings are refused whether checked as
    given or resolved. Inside the folder:
    - *Symlinks:* the run folder is mounted `nosymfollow`
      (mount(8); [`MS_NOSYMFOLLOW`](https://man7.org/linux/man-pages/man2/mount.2.html), Linux 5.10+); the
      [self-check](#isolation) verifies that no process follows a link there.
      Links the agent makes stop working, `python -m venv` included.
    - *Hard links:* the run folder is its own mount, and `link(2)` fails
      across mounts (`EXDEV`), so no protected path links into it.
    - *Case:* the filesystem is case-sensitive.
    - *`..` under the run folder's prefix* passes only if the check does not
      normalise it; the probe tests it.
  - **The weaker mode is prohibited.** The default bubblewrap sandbox gives
    `Bash` a fresh `/proc`. `enableWeakerNestedSandbox` bind-mounts the
    container's instead, which "exposes process information to sandboxed
    commands that a fresh `/proc` mount would hide", and "considerably weakens
    security" (sandboxing). I infer a same-user child can then open
    `/proc/<claude pid>/root/<keys>/...` or `.../mem`, which resolve in
    `claude`'s mount namespace, past bubblewrap's mounts. Denying `/proc`
    through `denyRead` is undocumented under bubblewrap, so the alternative is a
    VM ("its own kernel",
    [sandbox environments](https://code.claude.com/docs/en/sandbox-environments)).
    The runner refuses to start if `$SETTINGS` or a managed settings file sets
    the mode, and the self-check needs `claude` absent from `Bash`'s `/proc`.
  - `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` and `CLAUDE_CODE_MCP_ALLOWLIST_ENV=1`
    ([env-vars](https://code.claude.com/docs/en/env-vars)) keep credentials out
    of the environments of `Bash`, hooks and MCP servers, a second layer.
  - **Probe, in every arm's smoke argv.** Canaries stand in `<keys>/<canary>`,
    `<home>/{config.json,sessions/<file>,library/.../SKILL.md}`, and `claude`'s
    and MCP's environments. Before hashing, add a skill-description canary;
    the runner verifies it in populated `<home>/index/library-scan.json`.
    `Read`, `Grep` and `Bash` must fail on these and an embedding-cache file.
    `Bash` tries each probe file with `cat`,
    Python `open()` and Node `fs.readFileSync`, plus `environ`, `cmdline`,
    `mem` at `maps`
    offsets, `/proc/<pid>/root/` paths to every probe file, and walks
    `/proc/<pid>/fd` for `claude` and MCP, plus its own descriptors 0 to 1023.
    For each protected file it tries symlinks and hard links from the run
    folder; all three tools try those links, relative, `..` and upper-case
    spellings. `Read` and `Grep` also try `/dev/fd/../environ`,
    `/proc/self/environ` and `/proc/thread-self/environ`; `Bash` tries links to
    `/proc/self/environ`.
    `Grep` from `/` and each protected parent, and `Glob /**`, must find no
    canary. `Edit` of each protected file and `Write` into library, sessions or
    index must fail; a runner exec checks unchanged bytes and no new file. No nonce may
    reach the stream. Positive controls outside the Bash sandbox verify hook
    access to home and keys, and MCP reads via `load_skill`.
    Only framed loadout controls may return its library nonce.
    This checks the pinned image and CLI, not every spelling or real key location.
- **Layer 2:** loadout redacts strings that match the key shapes emitted by
  `scan-patterns.ts` from everything it sends to Jev (BACKLOG E14). The script
  reads the production patterns; see [Collection](COLLECTION.md#bounds) for
  the JSON command. Base64 or splitting defeats it, so it is secondary.
- **Layer 3, not adopted:** a key per task needs a service to mint keys; the
  7-day expiry bounds a leak instead.
- **Revoked, and confirmed.** When a batch's last run (reruns included) ends,
  its workspace is archived, which "deactivates the workspace and archives every
  API key created for it", "within seconds", and "cannot be undone" (workspaces).
  Erik revokes the batch's dedicated Jev key. One request per key must then be
  refused, else nothing from the batch is judged or committed: revocation comes
  before judging, and judging before committing.
- **Spend.** An arm's cost is the vendor's usage for its key (1-minute buckets
  by key, model and token class) at list prices (Expected spend), plus Jev. It
  "typically appears within 5 minutes of API request completion, though delays
  may occasionally be longer", so the runner reads it after the archive.
  Per-run figures are the stream's, priced the same way; per arm they must sum
  to within 5% of the vendor's (tokens exactly in the smoke run), else per-run
  costs are "not shown". Before each task the pre-check takes the higher.
- **Jev** calls from the hook and `loadout mcp` are loadout's own router
  traffic, not an agent's. Their count and cost come from loadout's record of
  each decision (`src/route.ts` computes them; nothing writes them down yet: a
  small harness task), "reported by the sandbox" since the agent can write
  there, and from Jev's usage for the dedicated key where it reports any. About
  $0.0012 per decision.
- **A request refused for the workspace limit** ends the run, flagged `limit`,
  and the plan stops (stopping rule).
- **Scanned.** The runner never prints a key. The scan looks for each key's
  exact value, its base64 and hex forms, and the shapes in
  [scan-patterns.ts](scan-patterns.ts), in three passes after the
  revocation: collected names and contents, the stream (before it is gzipped)
  and `claude` stderr, on the host; extracted text, before judging; and
  everything about to be committed. A hit stops the batch and Erik is told.

The prompt cache is shared between the runs of an arm (one key, one workspace),
so a run can start warm after the one before it. A hit makes requests faster and
billed cost lower, so it can move `capped`, the duration and the files a run has
when cut. It does not change what a request returns or the uncached cost behind
the headline. Cache tokens are reported per run. Sharing between workspaces is
not checked, so the order of arms is a stated limit; a workspace per run would
isolate them (a nonce in the prompt would change the treatment).

## Evidence

Nothing records requests from outside the container. What costs money rests on
the vendor's usage record, out of the agent's reach, as do the runner's clock and
kill reason, the engine's sandbox state, resolver and egress counters, collector,
extraction and check results, the self-check (it runs before any agent text
exists) and judge verdicts. The pins below rest on the stream, which `claude`
writes inside the container: an agent that left the Bash sandbox could change
it, a stated limit. Its `result` fields (`total_cost_usd`, `num_turns`,
`duration_ms`), hook events, stderr and hook and `loadout mcp` output are
"reported by the sandbox" and decide nothing.

With no delegation and no compaction (Arms), a run is one conversation: every
request is its next turn or a retry of one. A run that fails checks 1 to 4 is
`invalid`; check 5 stops the plan. Either halts all arms until Erik classifies
it as caused by the agent (it stands) or by `claude` (a deviation under Frozen;
the run is rerun after the fix).
1. The init event names the model asked for and lists the same tools in every
   arm, apart from the two loadout tools in `small-loadout`, and none of the
   tools denied under Arms.
2. Every `assistant` event names the pinned model, none holds a `tool_use` for
   a denied tool, and none comes from a nested conversation.
3. The stream shows no compaction event.
4. Message ids are unique and each usage is finite. `max_tokens` is not in the
   stream, only `output_tokens`, which must stay at most the pinned 32,000.
5. The vendor shows no model but the pinned one for the arm's key (before each
   task, from its record so far); token sums are compared at the end (Spend). A
   side call to another model that cannot be turned off is listed by the smoke
   run and priced in. The smoke key carries both models, so the check there is
   per model.

## Given up compared with a harness gateway

- Refusal before the fact. A harness gateway refused an off-list model, tool,
  beta or compaction request before it went out; now a violation is found
  afterwards and the run is `invalid`.
- A hard per-run limit. `--max-budget-usd` is an estimate that "can pass the
  cap"; the workspace limit is per arm and month, with no documented delay.
- Pins on a record the agent cannot reach. Tools, `max_tokens` (the setting
  covers "most requests") and compaction rest on the stream.
- Per-run cost from the vendor, and a check of each Jev request.
- No key kept out of the container. The keys are files the hook and `loadout
  mcp` read, and the Anthropic key is in `claude`'s memory. The defences, and
  what the probe cannot prove, are under [Credentials and
  spend](#credentials-and-spend); pattern redaction before Jev (layer 2)
  cannot catch encoded or split credentials, and revocation cannot undo a leak
  to Jev.

## Arms

One run per task and arm. `$PROMPT` is `task.md` verbatim, read by the runner
from outside the run folder. All arms share this argv and this environment;
only `small-loadout` adds to it.
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` and `CLAUDE_CODE_MCP_ALLOWLIST_ENV=1`.
  `ANTHROPIC_API_KEY` is unset: the key comes from `apiKeyHelper` (Credentials
  and spend).
- `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32000`: the same `max_tokens` in every arm; the
  worst request under Expected spend assumes it. The
  [env-vars](https://code.claude.com/docs/en/env-vars) page says it applies to
  "most requests" and lowers a value above the model's cap to the cap.
- `DISABLE_COMPACT=1` and `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK=1`:
  compaction rewrites turns, and the fallback sends a request without a stream.
- `FORCE_PROMPT_CACHING_5M=1`: the 5-minute cache TTL, the one the ceilings
  price (1-hour writes cost more).
- `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` (the background title request),
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` (auto-updates among others) and
  `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false`: the documented switches for
  requests outside the conversation. The smoke run must see none (Evidence).
- `ENABLE_TOOL_SEARCH=false` loads every tool upfront, the same in every arm.
- All are in env-vars (read 2026-10-14; `DISABLE_NON_ESSENTIAL_MODEL_CALLS` is
  not). The smoke run confirms each on the pinned CLI.

The argv, with `$CEILING` the arm's per-run ceiling (Expected spend) and
`$SETTINGS` this JSON (`<keys>` is the harness directory that holds the key
files, `<helper>` and this file; no secret is in the JSON):

```json
{"apiKeyHelper":"<helper>",
 "permissions":{"blockReadsOutsideWorkingDirectories":true,
  "deny":["Read(//<keys>/**)","Edit(//<keys>/**)","Read(//proc/**)",
   "Read(//<home>/**)","Edit(//<home>/**)"]},
 "sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false,
  "network":{"strictAllowlist":true},
  "filesystem":{"denyRead":["<keys>","<home>"]},
  "credentials":{"files":[{"path":"<keys>","mode":"deny"}]}}}
```


```bash
claude -p "$PROMPT" --output-format stream-json --verbose --include-hook-events \
  --model "$MODEL" --max-budget-usd "$CEILING" --no-session-persistence \
  --setting-sources '' --strict-mcp-config --mcp-config "$MCP" --settings "$SETTINGS" \
  --permission-mode acceptEdits --allowedTools Bash $EXTRA_TOOLS \
  --disallowedTools WebFetch WebSearch Task Agent Workflow SendMessage Skill
```

| Arm | `$MODEL` | `$MCP` | Additions |
|---|---|---|---|
| `small-bare` | `claude-haiku-5-5` | `{"mcpServers":{}}` | none |
| `small-loadout` | `claude-haiku-5-5` | `{"mcpServers":{"loadout":{"command":"loadout","args":["mcp"],"env":{"LOADOUT_HOME":"<home>"}}}}` | `--plugin-dir <plugin copy>`; `$EXTRA_TOOLS` = `mcp__loadout__find_tools mcp__loadout__load_skill`; `LOADOUT_HOME=<home>` with the full library, `config.json` pointing `jev.apiKeyFile` at the batch's Jev key in `<keys>` and `jev.baseUrl` left at default |
| `large-bare` | `claude-sonnet-5-5` | `{"mcpServers":{}}` | none |

- `plugins/loadout` is hook-only; `loadout mcp` supplies two pre-approved
  read-only tools. Agent-initiated library reads use only `load_skill`;
  the hook can inject framed text.
- **`Bash` has no network.** `$SETTINGS` goes in with `--settings`, the "Command
  line" settings level, which `--setting-sources` (`user`, `project`, `local`)
  does not exclude ([CLI reference](https://code.claude.com/docs/en/cli-reference),
  read 2026-10-14). Per the [sandboxing page](https://code.claude.com/docs/en/sandboxing)
  (same date), `Bash` and its children then run in a namespace "that has no
  connection to your network", the sandbox proxy refuses every host, `claude`
  ignores the `dangerouslyDisableSandbox` retry, and it exits at startup if the
  sandbox cannot start. Claude's own requests, hooks and local MCP servers "run
  outside it", so `claude` still reaches the API, and the hook and `loadout mcp`
  still reach Jev.
  - Linux needs `bubblewrap` and `socat` in the image, and the optional seccomp
    filter, which "adds Unix domain socket blocking" and comes with
    `npm install -g @anthropic-ai/sandbox-runtime`. Where `bwrap` cannot mount
    `/proc`, `enableWeakerNestedSandbox` is prohibited (Credentials and
    spend): use a VM (Decided by Erik).
  - No task needs network from `Bash`: the Docker tasks cannot run `docker`,
    `ctl-ratelimiter-bug` runs `node --test` with no dependency, and the rest
    use the preinstalled tools.
- **No delegation.** `Task` and `Agent` are both disallowed in every arm. The
  [sub-agents page](https://code.claude.com/docs/en/sub-agents) (read
  2026-10-14) says `Task` became `Agent` in v2.1.63, `Task(...)` references
  "still work as aliases", and "To prevent Claude from delegating to any
  subagent, deny the `Agent` tool itself". A bare name in `--disallowedTools`
  "removes the matching tools from Claude's context" (CLI reference). The
  [tools reference](https://code.claude.com/docs/en/tools-reference) lists three
  more paths, denied the same way: `Workflow` ("orchestrates many
  subagents in the background"), `SendMessage` (writes to another agent or
  session) and `Skill` (a skill with `context: fork` runs in a subagent).
  Denying `Skill` disables all skills in every arm, bundled ones included
  (skills page: "Disable all skills by denying the Skill tool"). The init event
  must list none of them (Evidence). A subagent would start conversations the
  one-conversation reading of the stream does not cover; the arms stay equal, at
  the cost of any gain from subagents (a stated limit).
- **`Read`, `Grep` and `Glob` stay in the run folder** in every arm (the fence
  under Credentials and spend); the library is never a working directory, so
  its `CLAUDE.md`, `AGENTS.md` and `.claude/` cannot load as memory.
  **Stated limit:** the hook and `load_skill` listing suggest direct folder
  reads; no config switch suppresses them yet (D18).
  Bash cannot run or copy library scripts or binary assets; `load_skill` refuses
  binaries and points at the denied folder. This may hurt docx, pptx, xlsx and
  pdf tasks.
  D18 is not required: raw reads fail; `load_skill` frames text. Failed
  attempts count toward outcomes.
  Native skill-folder loading is the host baseline (disabled here with `Skill`);
  loadout's separate third-party library is measured as shipped, framed by
  `load_skill` and the hook.
- **No compaction, in every arm.** A compaction rewrites the assistant turns,
  so the run would no longer be one conversation: mostly for `small-loadout`,
  whose hook context and skill text fill the window sooner. `DISABLE_COMPACT=1`
  turns off all of it, `/compact` included. A run that fills the window ends at
  the provider's context error and is judged as it stands, flagged `context
  full`. A compaction that shows in the stream anyway is `invalid`.
- **Budget.** `--max-budget-usd` is the arm's ceiling per run. The CLI reference
  says it checks "its client-side cost estimate, which can differ from your
  bill" and "Spend can pass the cap, so leave headroom" (the ceilings do). A run
  it stops is judged like `capped`. It is a soft stop; the workspace limit is the
  hard one.
- **Pinned CLI.** The image holds one `claude` version, v2.1.285 or later,
  part of the treatment hashes, with auto-update off (see the env list above).
  The sandboxing page (read 2026-10-14) gives v2.1.219 for `strictAllowlist`
  and v2.1.285 for the admin-required sandbox and for `allowUnsandboxedCommands:
  false` to hold against a project's `true`; the CLI reference gives v2.1.217
  for the budget cap's enforcement.
- **Caps.** 15 minutes wall clock per run, measured by the runner. On a timeout
  the folder as it stands is judged and the run is flagged `capped`; the rate
  per arm is reported (in the
  [pilot](../../RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07), loadout
  runs hit the 6-minute cap 4 times, bare runs twice).
- **Collected per run**: the stream, the `claude` stderr, the final message (the
  `result` text, or the last assistant text when there is no `result`), every
  file added or changed relative to the inputs, and the per-message usage read
  from the stream. What is committed is under What is committed.
- **Order and concurrency.** Task by task in the order under Expected spend,
  all three arms of a task before the next, resumable per task, one run at a
  time, since parallel runs would change how often the limits hit. Within a task
  the arms rotate with the task's position.
- **Failed runs.** A run is rerun once from a clean folder only for a fault the
  engine reports on its own side: the container failed to start, or the engine
  or host restarted. An upstream 5xx, 529 or 429 and a stream cut are never
  causes, since a run's own traffic can provoke them: the run stands, flagged,
  with its cost. Nor is an out-of-memory kill, a process or disk limit or a full
  run volume (the agent can reach them), a `result` event saying "API error"
  (the sandbox's word) or how the output looks.
  The failed attempt must be valid. The rerun follows at once, under the check
  in Expected spend; if it cannot be funded or fails too, the task is "not run".
- **Invalid and rejected runs are results.** A run that fails an Evidence check
  is `invalid` and halts the plan ([Evidence](#evidence)); one that fails
  collection is `output rejected`. Neither is rerun; both are counted per arm and
  task, and their cost counts toward the spend.

## What is committed

AGENTS.md says to commit raw results, and a reviewer can check the numbers only
against the outputs they came from. The fixtures and the agents' outputs are
ours, so the only reasons to withhold anything are a secret, a path or a
username. The streams also hold third-party skill text from `load_skill`
results, which is not ours: Erik's read covers its licences (Decided by Erik).
Committed under `bench/results/<timestamp>-c2/`:
- per run: the final message, every file the collector kept, the stream (gzip,
  hook events included), the `claude` stderr, the extracted text, the
  per-message usage records, and the runner's figures: arm, task, `capped`,
  `ceiling`, reruns, duration, flags, violations by kind, the selected skill
  names and the Jev record. `total_cost_usd`, `num_turns`, `duration_ms` and the
  hook's exit status are labelled "reported by the sandbox";
- every check result, with the counts the check reads (tests run, rows, slides)
  and the number of files each check dropped from its copy;
- per judge call: the exact input, the output with its sentence, and the verdict
  (`A`, `B`, `tie`) or guess (`A`, `B`, `unsure`), with the redaction counts per
  arm and the extracted size in bytes;
- the vendor's usage export per key (the key id replaced by the arm's name) and
  the comparison with the stream's sums, the resolver and egress counters, the
  sandbox self-check, the credential probe, the hashes of the treatment (see
  Smoke run first) and the `claude` version.

**Gates, in order, before anything is committed.** A failure commits nothing
from the batch, and Erik is told.
1. The revocations are confirmed (Credentials and spend).
2. The secret scan (Credentials and spend, third pass) runs over every file to
   be committed, names and contents, zip entries inflated, with the stream and
   the judge inputs and outputs included. A file with a hit is withheld, not
   edited.
3. The paths and usernames scan, with its rules fixed here. In text files and
   in file names it replaces the host's home directory path with `<home>`, the
   run folder's path with `<run>`, the host's user name as a whole word with
   `<user>`, the host name with `<host>` and any email address with `<email>`.
   A binary file (docx, xlsx, pptx, pdf, SQLite) with a hit is withheld, not
   rewritten. The scans run again after the replacement, and a hit left over
   withholds the file. The replacements are counted per token and committed
   with the file. A sanitised file differs from what the check and the judge
   saw only at those tokens.
4. Erik reads the folder before anything is pushed (AGENTS.md rule 4).

A withheld file is listed by run and reason (secret, path, binary), never named
or quoted. The run's verdict and cost still count, labelled "not reproducible
from the folder".

The scans cannot see a key in a form they do not look for (split across files,
compressed, enciphered). That is why the keys are revoked first and Erik reads
the folder. The skill text a run loaded comes from the library snapshot whose
hash is recorded.

Others can recompute from the folder the win, tie and split counts, scores and
intervals, guess accuracy, check pass rates, and the cost, model call, duration
and capped figures: verdicts and checks from the committed judge inputs and
outputs and check results (rerunning the judge costs quota), the rest from the
usage records.

## Smoke run first

One run per arm on [smoke/](smoke/), a fixture outside all 18 task areas, not in
`index.json` or `KEY.md`, never scored or judged, its outputs not in the
results. The harness (see Frozen before the first run) is committed before it
runs.

**The treatment is frozen first.** Before the smoke run, the results record the
SHA-256 of the packed `loadout` tarball, of the plugin copy (a tar of its files
in sorted order), of the library snapshot in the loadout home, of that home's
`config.json` and of the `claude` install (with its version). The full run must
show the same five hashes. A treatment that does not run (the hook's context is
missing, tools are missing) stops the plan for Erik to decide, and a changed
treatment is a new registration with new hashes.

It passes when:
- the sandbox self-check and the credential probe have run and their output is
  recorded;
- the init event lists the same tools in all arms, apart from the two loadout
  tools in `small-loadout`, none of the tools denied under Arms (so `Task`,
  `Agent`, `Workflow`, `SendMessage` and `Skill` are gone), and the model asked
  for, which every `assistant` event names too;
- the hook event of the `small-loadout` run shows exit 0 and its output holds
  the `<skill_relevance>` context, and no bare run has one;
- the collector and the extraction script run on each smoke output folder;
- the Evidence checks pass for every smoke run, and the vendor's token sums for
  the smoke key equal the stream's exactly, per model.

The run records: Jev requests per hook decision and per `find_tools` call, any
other model the vendor shows for the key (a side call), the largest input and
output of one request in the stream, and the cost of the dearest request. The
dearest request must fit the worst-request figure under Expected spend, and each
smoke run its arm's ceiling; if not, the ceilings and the cost table change
together before the full run.

Recorded, not a gate: whether the `small-loadout` run called `load_skill`
apart from the probe. A miss is reported, not fixed.

A fault the smoke run shows in the harness is fixed before the first full run
and goes into RESULTS as a deviation, with its reason.

## Checks by script

The per-task checks, how they are kept from passing vacuously, and the
harness-owned signup probe are in [CHECKS.md](CHECKS.md).

Pass rates per arm and check are reported with Wilson intervals, next to the
judged results. The judge does not see them.

## Judging

- **Waits for E12.** The judge is Codex (gpt-6.1-sol), since Claude wrote the
  tasks and runs every arm. Outputs can carry third-party skill text, so Codex
  cannot judge until it can run with no tool that reads files, runs commands or
  reaches the network (E12). The files backend is no substitute.
- **Framing.** Outputs reach the judge escaped with `escapeSkillTags`, framed as
  third-party content with provenance `unverified`. `escapeSkillTags` escapes
  `<skill` tags only and does not strip terminal control characters, so the
  runner never prints agent text.
- **Blind.** Per task, three pairs: `small-loadout` vs `small-bare`,
  `small-loadout` vs `large-bare`, `small-bare` vs `large-bare`. Each pair is
  judged twice with the order swapped. The judge sees `task.md`, the extracted
  input files, that task's `KEY.md` entry, and two outputs labelled A and B:
  the final message and the files. Never transcripts, tool calls, skill names,
  cost, model or timing.
- **Binary outputs** (docx, xlsx, pptx, pdf) are turned into text by one
  script for all arms: paragraphs and tables, sheets with formulas and cached
  values, slides with notes. Formatting that text cannot show is not judged.
  Text files are shown as they are, within a size budget.
- **Verdict call.** Which output better does what the request asks, counting
  correctness against the key first, then completeness, then clarity. Answer
  `A`, `B` or `tie`, with one sentence. The prompt says nothing about guidance,
  skills or arms.
- **Guess call, separate.** After every verdict call has finished, each
  verdict call gets a second call with the same `task.md` and the same two
  outputs in the same order, without the key, asking only which output had
  extra guidance: `A`, `B` or `unsure`. It is separate because the
  question in the verdict prompt can steer the judge toward style differences.
- **Verdict per pair and task**, as in the pilot ([outcome.ts](../../outcome.ts),
  RESULTS): a side wins only if it is preferred in both orders. Two ties are a
  tie. Anything else is a split, never a win: opposite preferences (position
  bias), or a preference in one order and a tie in the other. Ties and splits
  are reported separately, splits broken down into those two.
- **Sequential.** The 216 judge calls (108 verdict, then 108 guess) run one at a
  time (concurrency 1), not through the two-way pool `outcome.ts` uses, so the
  judge's cached prompt stays warm. Calls are grouped by task, the fixed part of
  the prompt first. Each call is its own process, with no memory carried over.

## Template leakage

A skill's template or wording can show in the output and tell the judge which
arm it is reading. The redaction, the guess metric and what is not removed are
in [LEAKAGE.md](LEAKAGE.md).

## Analysis

- **Primary set: the 14 non-control tasks,** or those in the funded prefix (see
  Expected spend). The 4 controls are reported separately, likewise, with the
  skills the hook loaded on each.
- **Primary comparisons, fixed before any run:** `small-loadout` vs
  `small-bare` (does loadout help the small tier) and `small-loadout` vs
  `large-bare` (does it close the gap). The third pair is context.
- **Score and matching criterion, fixed before any run.** Per pair and task a
  win scores 1, a tie 0.5, a loss 0 and a split 0.5 (splits are also reported
  on their own). A pair with an `invalid` or `output rejected` run is not
  judged; it scores as a loss for the arm that has the bad run (a tie if both
  do). With W wins and L losses over the n paired tasks in the set, S = 0.5 +
  (W - L) / (2n). Its 95% interval is a Tango (1998) score interval for
  (W - L) / n, a paired method that keeps what the ties say; the formula and
  its tests are [bench/c2-score.ts](../../c2-score.ts) and
  [test/c2-score.test.ts](../../../test/c2-score.test.ts). The non-inferiority
  margin is 0.05 below parity (0.5). For `small-loadout` against `large-bare`,
  "match" is shown only if the lower bound is at least 0.45, "better" if it is
  above 0.5, "worse" if the upper bound is below 0.5, else "not shown". Against
  `small-bare`, "helps" if the lower bound is above 0.5, "hurts" if the upper
  bound is below 0.5, else "not shown". Wins, ties and losses are always shown
  beside it.
- **What 14 pairs can and cannot show.** Labels for `small-loadout` against
  `large-bare`, from [bench/c2-score.ts](../../c2-score.ts). All 14 tied: S =
  0.50, interval 0.39 to 0.61, "not shown". One win and 13 ties: 0.54, 0.42 to
  0.66, "not shown". Two wins, 12 ties: 0.57, 0.448 to 0.70, "not shown". Three
  wins, 11 ties: 0.61, 0.48 to 0.74, "match". Four wins, 10 ties: 0.64, 0.504 to
  0.77, "better". Nine wins, one tie, four losses: 0.68, 0.43 to 0.85, "not
  shown". So the fewest wins that reach "match" is 3, with no loss; ties alone
  never reach it. Erik
  set the margin at 0.05 (Decided by Erik).
- **Secondary, never a conclusion: the decisive-pair win rate,** wins / (wins +
  losses) with a 95% Wilson interval, next to the tie and split counts. It
  leaves ties out, so it reads 100% for one win and 13 ties. It is also shown
  without the pairs with a bad run, and without the pairs where a run is
  `context full` (the loadout arm reaches it sooner), with their number.
- **Cost per task:** mean and median per arm of the stream's usage at list price
  (as billed and uncached) plus Jev cost for `small-loadout`, with the CLI's
  `total_cost_usd` beside it as reported by the sandbox, and each arm's total
  from the vendor's usage (Credentials and spend), the spend headline. The
  per-task headline is the uncached figure. Also cost per task won, capped and
  `context full` rates, median model calls (messages in the stream) and median
  duration (the runner's), with `num_turns` and `duration_ms` beside them as
  reported by the sandbox. The Codex CLI reports no cost (`costLabel` in
  `bench/lib.ts`), so the judge's cost is not reported.
- **Per task:** a table of verdicts, to show which tasks drive a difference.
- Negative and null results go into `bench/RESULTS.md` with the numbers.

## Frozen before the first run

The commit that merges this protocol fixes the tasks, `KEY.md`, the checks, the
redaction rules, the limits under Isolation, the Evidence checks, the commit
gates and their sanitising rules, the primary comparisons, the matching
criterion and the analysis. The runner, collector, resolver, sandbox self-check,
credential probe, extraction script, check script with its tests and both judge
prompts do not exist yet; they are committed before the smoke run and change
only as set out under Smoke run first. After the first full run starts, none of
these changes. A change forced by a fault in the harness goes into RESULTS as a
deviation, with the reason and the runs it touched; those runs are rerun once
after the fix, and the originals stay reported. No tuning follows from these
results on these tasks.

## Expected spend (local run)

Preparing these fixtures cost $0: no model or Jev calls.

RESULTS has no measured 15-minute agentic run, so the per-run figures are
assumptions: 20-40 turns over a context of 25k-75k tokens, which is 0.5M-3M
cache-read tokens, 50k-200k cache-write tokens and 10k-40k output tokens per
run. API list prices per million tokens (cache read and write at the usual
0.1x and 1.25x of input, then output):

| Model | Prices | Per run |
|---|---|---:|
| Sonnet 5.5 | $0.20, $2.50, $10 | $0.33-1.50 |
| Haiku 5.5 | $0.01, $0.125, $0.50 | $0.02-0.08 |
| Haiku 4.5 (not chosen) | $0.10, $1.25, $5 | $0.16-0.75 |

For Haiku 5.5, every rate rises 5x for prompts over 100k tokens; the other two
are assumed to do the same (the smoke run corrects this). The assumed contexts
stay below 100k; the worst request below does not assume it.

| Item | Count | Estimate |
|---|---:|---|
| `large-bare` runs | 18 | $6-27 |
| `small-bare` and `small-loadout` runs | 36 | $0.60-2.70 |
| Jev routing for `small-loadout` ($0.0012 per decision, [C1](../../RESULTS.md#c1-2026-10-08-new-held-out-requests)), hook only | 18 | about $0.02; `find_tools` calls add more, not measured |
| Smoke run, one run per arm | 3 | $0.36-1.65 |
| Codex judging (3 pairs x 2 orders x 18 tasks, then the same number of guess calls), sequential | 216 | plan quota, cost not reported |

Prices are Anthropic's list prices as of 2026-10-06, not figures from RESULTS.
Expected Claude cost at list price, with no reruns: about $7-31 with Haiku 5.5.
It is cash: each batch's workspace key bills the API.

A run's ceiling (`--max-budget-usd`) is its high per-run figure plus room for
the worst request, since a stop can land late (Arms). A worst request is at most
200k input tokens at the 5-minute cache-write price plus 32k output tokens, both
at the 5x tier: for Sonnet 5.5, 0.2M x $12.50 + 0.032M x $50 = $2.50 + $1.60.
The 200k window and 32k `max_tokens` are assumptions the smoke run replaces.
The ceiling is the high figure plus two worst requests, and never below three
times that figure or three times the largest the smoke run measured. Honest runs
fit under it (the smoke run checks).

| Model | Worst request | Per-run ceiling |
|---|---:|---:|
| Sonnet 5.5 | $4.10 | $9.70 ($1.50 + 2 x $4.10) |
| Haiku 5.5 | $0.205 | $0.485 ($0.075 + 2 x $0.205) |

**Approvals.** For each arm the approval is (n - 1) x high + ceiling, which is
also the monthly spend limit of that arm's workspace (Credentials and spend),
with n = 36 (a rerun for every run, though reruns are limited to engine
faults). It funds n attempts only if each costs at most its high figure; one
can spend up to its ceiling.

**One stopping rule for all arms, fixed now, before any output exists.**
- Tasks run in the order of the SHA-256 of the task id, all three arms of a task
  before the next task. An engine-fault rerun (Arms) runs at once, before the
  next run.
- Before each task and each rerun, the runner checks that every arm's approved
  cost minus its spent cost (the higher of the stream's priced usage and the
  vendor's, Jev and invalid runs included) is at least that arm's ceiling, and
  that the approved hours cover it. Those hours are agent run time as the
  runner measures it (108 attempts x 15 minutes, about 27 h), not collection or
  extraction time. If any arm fails, every arm stops at that
  same position.
- The task whose rerun cannot be funded, and every task after the stop, are
  "not run" in all arms; the runs already made for that task are set aside and
  listed. The stop is final: no cap is raised once outputs exist, and a bigger
  cap is a new pre-registered run.
- The reported sample is the prefix of that hash-random order which every arm
  could fund; controls and non-controls fall into it as they come. Nothing in
  the rate depends on one arm's spending alone.

| Batch | Approved |
|---|---:|
| `large-bare` | 35 x $1.50 + $9.70 = $62.20 |
| `small-bare` | 35 x $0.075 + $0.485 = $3.11 |
| `small-loadout` | $3.11 |
| Smoke run (two small arms first, then `large-bare`) | 2 x $0.075 + $9.70 = $9.85 |
| Jev, `small-loadout` and smoke | about $0.04 |
| **Total** | **about $78** |

These are caps, not expectations: the expected cost is the no-reruns figure
above. Wall clock is about 108 x 15 minutes (the cap; about 27 h, the approved
hours) plus the smoke run, up to 10 minutes per attempt for collection and
extraction, and the wait for the vendor's usage, which the approved hours do
not count: a planning figure the smoke run replaces with measured
ones before the full run is approved.

## Decided by Erik (2026-10-19)

- Sandbox: a VM, with the Bash sandbox inside it. The engine, egress mechanism,
  resolver and collector sandbox are set when it is built; its setup and cost
  are Erik's. Model spend does not change.
- The full protocol, not a smaller pilot.
- Tiers: Haiku 5.5 for small, Sonnet 5.5 for large.
- Approvals: (n - 1) x high + ceiling under the shared, final stopping rule,
  about $78 (Expected spend). Approved hours: about 27 h.
- Matching margin: 0.05 below parity (Analysis).
- Licences: before anything is pushed, check the licences of the skills a run
  loaded.
- As drafted: delegation off in every arm (Arms); invalid and `output rejected`
  runs score as a loss for their arm, and each `invalid` run still halts the
  plan for Erik to classify (Analysis); compaction off in every arm; raw
  results committed after the gates under What is committed, with Erik reading
  the folder before any push; the loadout arm measures hook plus search (as
  drafted); the prompt cache shared between an arm's runs is a stated limit (Credentials and
  spend); no Codex-family replication (it needs a Claude judge).

## Open for Erik

Needed before the run, not before the merge.

- The Anthropic side (Credentials and spend): a Console organization, since the
  Admin and Usage APIs are not available to individual accounts; an Admin key
  that stays on the host; four workspaces (three arms and the smoke run), each
  with one key and a monthly limit at its approved cap, all inside one calendar
  month. Archiving cannot be undone. Say whether the runner archives them or you
  do by hand before anything is judged.
- The Jev key is dedicated to the `small-loadout` batch, and you revoke it
  after. Say whether Jev reports usage per key. The loadout arm needs
  redaction before Jev (BACKLOG E14, implemented separately from the protocol)
  and a record of each decision's calls, tokens and cost. The lexical router
  needs no Jev key but is a different product, so not the primary comparison.
