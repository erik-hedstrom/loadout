# C2 gateway, credentials and run accounting

Part of the [C2 protocol](PROTOCOL.md), frozen with it. Section names such as
Arms, Isolation, Expected spend and Smoke run first are its sections.

## Credentials

What loadout does today (`resolveApiKey` in `src/config.ts`): it reads the Jev
key from the environment variable named there, or else from the file that
`jev.apiKeyFile` in `$LOADOUT_HOME/config.json` names. The hook
(`loadout hook claude`) and `loadout mcp` are child processes of `claude`.
They run as the same user, in the same container, as the agent's `Bash`. So
whatever key those two processes can read, `Bash` can read: `env`, a key file,
`/proc/<pid>/environ`. The Anthropic credential is in the same position:
`claude` needs it and `Bash` is its child. loadout cannot withhold a key from
the shell, and this protocol does not claim it can.

The allowed APIs are an exit too. Skill text can carry an attacker's own key
and have `Bash` call the allowed API with it (the Anthropic batches API, for
example), putting a stolen credential into a request the attacker reads back
from their own account. A host allowlist cannot tell the keys apart inside
TLS. So no real key goes into the sandbox:
- **The gateway holds the keys.** A harness gateway outside the sandbox is the
  only route out. `claude` gets `ANTHROPIC_BASE_URL` pointing at it and a
  placeholder `ANTHROPIC_API_KEY`. The loadout home's `config.json` sets
  `jev.baseUrl` to it, and the file `jev.apiKeyFile` names holds a placeholder.
  The gateway drops any credential header on a request, adds the real one, and
  forwards each route to one fixed upstream host over its own TLS connection.
  It allows only the paths the smoke run shows `claude` needs (the messages
  endpoint, not the batches or files APIs) and, in the `small-loadout` batch
  only, `POST /v1/systemone`, the one path `jevClient` calls; the bare batches
  have no Jev route. Everything else is refused and counted. An attacker's key
  in a request is overwritten, so nothing the sandbox sends reaches another
  account. It also reads each Anthropic request body, within a size limit (16
  MiB, Jev 4 MiB; the smoke run may lower them), and refuses a body whose
  top-level keys, tool `type` values, `model` or `anthropic-beta` header values
  are not among the ones the smoke run saw `claude` send (the arm's model and
  the overhead models it calls). That closes the server-side tools (web search,
  web fetch, code execution) and `mcp_servers`, which would
  give `Bash` web access and remote tools through the allowed path. The lists
  come from one smoke run per arm, so a value it did not see (a beta header on a
  tool the smoke run did not use) is refused and invalidates that run. If a
  second run in the batch shows the same unseen value, `claude` itself sends it:
  the batch halts for Erik, who adds it as a deviation under Frozen, and the
  runs it touched are rerun. The `claude` version is pinned (see Arms). It needs
  an Anthropic API key: the protocol assumes one.
- **The gateway cannot tell `claude` from `Bash`.** `Bash` is a child of
  `claude` and inherits its environment, so the placeholder key, the base URL
  and anything else `claude` holds (a nonce header, a client certificate) are
  readable by `Bash` from `env` or `/proc/<ppid>/environ`, as the same user. A
  secret only `claude` has does not exist. The placeholder key is unique per
  run, which attributes each request to its run and refuses a straggler from an
  earlier run, and binds nothing more. So a skill can POST to the allowed paths
  itself, to get help from the arm's own model or to spend the cap. The protocol
  does not prevent that; the chain rule makes it visible and the gateway prices
  it (next bullets).
- **Accounted at the gateway, never from the stream.** `Bash` can forge
  `assistant` and `result` events through `/proc/<claude pid>/fd/1` and kill
  `claude` after calls of its own, so the stream (see Evidence) never accepts a
  run, invalidates one or sets a cost; the gateway does. Per request it records
  the path, status, `model`, `anthropic-beta` values and upstream usage (input
  and cache tokens come in `message_start`, output in the last
  `message_delta`). For a messages request it also records the response's
  message id, a hash of its content blocks (`type`, text, tool `id`, `name`,
  `input`, thinking `signature`; fields `claude` does not resend are left out,
  as the smoke run shows), the hashes of the assistant turns the request
  carries, and `max_tokens`. Bodies are parsed, never stored; ids and hashes
  stay local. Per run:
  - **One chain.** Each completed (2xx) messages request is the next link of
    one conversation: it carries exactly the earlier responses' assistant
    turns, in order and equal by hash, and its last user turn answers exactly
    the last turn's `tool_use` ids (a turn with none has no next link). Earlier
    user turns are not compared, since `claude` may rewrite old tool results.
    Off-chain, and the run `invalid` (see Arms): a request that repeats a taken
    link (a fork, or a copy of a completed request), carries an assistant turn
    the gateway did not return, or starts a second conversation (a `claude`
    started by `Bash`); also a compaction, which rewrites the assistant turns
    (the smoke run checks that 25k-75k contexts do not compact). A request
    whose body equals an earlier one that did not complete (429, 5xx, a cut
    stream) is a retry: priced, not a link.
  - **Side calls.** What `claude` calls outside the conversation (title,
    summary or similar) has a shape the smoke run measures per arm: model, no
    tools, system prompt hash, `max_tokens`, body size, count per run (or per
    `tool_use`). A request of that shape within its count is a side call; any
    other is off-chain; a shortfall is reported. Subagents would be more
    chains, so they are off (see Arms).
  - **Why it holds.** Assistant turns reach `claude` only through the gateway,
    and `tool_use` ids and thinking signatures are made upstream, so no request
    carries a turn the gateway did not return. Secrecy is not needed: with the
    whole conversation in hand, a request `Bash` sends is the next link, which
    makes `claude`'s own next request a second one on that link, or it is
    off-chain. `Bash` can take the chain over by killing `claude`; that is one
    chain, priced like any other, judged by its files.
  - **Cost** is the gateway's usage at list prices (the table under Expected
    spend, over-100k tier per request) plus the Jev cost. A request without
    final usage is priced from the last usage seen, and at its ceiling when
    none was seen or the drain aborted it: `max_tokens` at the list output
    price plus the body's bytes as input tokens (a token is at least a byte) at
    the list input price.
- **Jev requests, `small-loadout` only.** The hook and `loadout mcp` send them
  as the same user as `Bash`, so the gateway cannot say who sent one. It
  verifies the path; the top-level keys `jevClient` sends (`model`, `state`,
  `questions`); the configured `model`; question ids and types equal to the
  sets `wideQuestions` and `closeQuestions` build (the smoke run records them);
  the 4 MiB limit; and a count. `askJev` sends two requests per decision
  (`src/route.ts`), none for an empty or follow-up prompt (`src/hook.ts`), and
  `jevClient` retries once on a 429, 5xx, timeout or network error, so the
  bounds are upper ones. With D = 1 + F (one hook decision, since `-p` takes
  one prompt; F the `find_skills` `tool_use` blocks in the chain's responses),
  2xx requests are at most 2D and all requests at most 4D. More makes the run
  `invalid`; fewer is reported. Not verified: who sent a request, and `state`
  and the instructions, which carry the prompt, so `Bash` can spend up to the
  bound on Jev requests of the right shape. The Jev cost is the 2xx requests at
  the per-request rate the smoke run records.
- **The stream is a cross-check.** The runner reports where it differs from
  the gateway: assistant message ids, tokens per model against `modelUsage`,
  hook events against Jev requests. The smoke run must agree exactly. In a full
  run a difference decides nothing, and a run with no `result` (capped, killed)
  is compared on counts only.
- **A run ends in a fixed order.** (1) `claude` exits, or the runner stops it
  at the cap or the ceiling. (2) The gateway revokes the run's placeholder key;
  a new request on it is refused. (3) The runner stops the sandbox and reads
  its state. (4) The gateway drains: it keeps reading every upstream request of
  the run still in flight, Anthropic and Jev, for at most 2 minutes (twice the
  slowest response the smoke run measured, if longer), then aborts the rest;
  each gets its final usage or its ceiling price. (5) Only then are the run's
  record, chain check and cost final, and collection or the next run can begin.
  So a request started before the end lands in this run's record, and cannot
  spend the next run's cap or warm its cache. A request refused between (2) and
  (3) is counted
  and does nothing, so it is not `invalid` (the hook's or `loadout mcp`'s own
  retry can outlive `claude`). One on the revoked key after (3) means the stop
  failed: the batch halts for Erik. A request in flight at the end is normal (a
  capped run has one), not `invalid`.
- **Not loadout proxying.** AGENTS.md rule 1 keeps the product from proxying an
  agent's API traffic. This gateway is benchmark harness, not product: not in
  `src/`, not shipped, run only in this benchmark's sandbox on accounts made for
  it, using documented settings (`ANTHROPIC_BASE_URL`, `jev.baseUrl`); it
  leaves bodies as they are and adds a credential header. Erik confirms this
  reading (Open for Erik).
- **Keys per batch, with a cap.** Each batch (one arm, and the smoke run) has
  its own Anthropic key, and the `small-loadout` batch its own Jev key. A key is
  used nowhere else and has a provider spend cap set to the approved total for
  its batch; where a provider offers none, the gateway refuses requests past a
  count the runner sets from that total. Each run has a ceiling on priced
  usage: the larger of three times the arm's high per-run figure (Expected
  spend) and three times the largest the smoke run measured. At most 2 requests
  are in flight per run (the smoke run may raise this), and before forwarding
  one the gateway reserves its ceiling price against the run's ceiling and the
  batch cap, refusing it if either would be passed (such refusals do not
  invalidate the run) and replacing the reservation with the actual price at
  the drain. A run that hits its ceiling ends in the order above and
  is judged like `capped`.
- **Probed.** Before the smoke run a script, running as the agent's user in the
  run sandbox, prints yes or no for each of: a credential-shaped string (the
  patterns in [scan-patterns.json](scan-patterns.json)) other than the
  placeholders in `env`, the key file, `/proc/*/environ` and the home folder;
  and a connection straight to an API's address getting an answer. Against a
  stub upstream the gateway is shown to replace a credential header; to refuse
  a path, tool type, body and model off its lists; to mark off-chain a second
  conversation, a fork, a copy and a forged assistant turn; to price a retry and
  a cut stream; and to drain. The off-chain cases are also sent from `Bash`,
  with a forged `result` written through `/proc/$PPID/fd/1`: the run is still
  invalid.
- **Revoked, and confirmed.** A batch's keys are revoked when its last run
  (reruns included) ends, before any of its output is scanned, extracted,
  judged or committed, and one request per key that must now be refused
  confirms it. If a revocation is not confirmed, nothing from the batch is
  committed. This is defence in depth: no real key was in the sandbox, so no
  output can hold one, and if the gateway failed the key is dead by the time
  anything leaves the machine.
- **Scanned.** The runner never prints a key. The scan looks for each key's
  exact value (a hit means the gateway failed) and for the shapes in
  scan-patterns.json, in two passes: the collected file names and contents,
  the stream and the `claude` stderr, on the host, before extraction; then the
  extracted text, before judging (office files are compressed, so the first
  pass cannot see into them). A hit in either pass stops the batch: nothing
  more from it is extracted or judged, and Erik is told. What the scan cannot
  see, and why nothing raw is published, is under
  [What is committed](PROTOCOL.md#what-is-committed).

**Evidence.** A decision (accept, invalid, cost, rerun cause, treatment check)
rests on the first row only.

| Source | Pieces |
|---|---|
| Outside the agent's reach | The gateway's record (requests, models, usage, ids, block hashes, the first request's tools, prompt and hook context, `find_skills` calls in returned responses, Jev shape and count); the runner's clock and kill reason; the engine's sandbox state; resolver and egress counters; collector, extraction and check results from the fresh second sandbox; the self-check and probe (they run before any agent text is present); judge verdicts |
| Written in the sandbox, forgeable | The stream (init tools and model, `assistant` ids and usage, `result` fields such as `total_cost_usd`, `modelUsage`, `num_turns` and `duration_ms`, hook events), stderr, hook and `loadout mcp` output: reported only, labelled "reported by the sandbox". The files and final message are the output judged, not accounting |

Records the harness keeps outside the sandbox can carry what the agent put in
them, so each is counted, scanned or not kept:

| Record | Handling |
|---|---|
| Resolver | Counters and one canary flag. No name is written, not even to its own stderr. |
| Gateway | Per run: requests per allowed path, refused requests, bytes, status codes, and per request the model (from the fixed set), the usage integers, the response's message id and the hashes of its content blocks and of the assistant turns the request carried. No body, header, query string or refused path is logged. Local: ids and hashes carry bits the agent chose, so only sums and the chain check's result by kind are committed. |
| Firewall drop log | Not kept. A refused destination (an address and port carry bits) is counted only. |
| Container engine log | Not kept: the log driver is off for the run container. |
| Stream JSON with hook events, final message, `claude` stderr | Local, never committed; scanned in pass one. |

Numbers the agent influences (duration, tokens, cost, test and row counts, the
dropped-file counts, the refused-request and off-chain counts, the rejected and
invalid flags) are a thin channel too, a few bits per run. The control is the
same: no real key in the sandbox, and revocation before anything is committed.

Between runs, a new sandbox, run volume, loadout home, placeholder key, ceiling
and counters for each attempt, reruns included; the gateway and resolver keep
nothing else, and the next run
starts after the previous run's drain, so none of its requests is in flight.
The prompt cache is shared by runs on a key within the cache lifetime, so a run
can start warm because of the one before it, and the arms differ in run order.
Cache tokens are reported per run; the cost is reported as billed and as if
every input token were uncached, and the comparison uses the uncached one. A
request `Bash` sends to warm the next prefix is off-chain and cannot land in
the next run, but its cache entry lasts. Warmth changes cost as billed and
speed, not content; order effects remain as a stated limit.
