# C2 gateway, credentials and run accounting

Part of the [C2 protocol](PROTOCOL.md), frozen with it. Arms, Isolation,
Expected spend and Smoke run first are its sections.

## Credentials

The hook (`loadout hook claude`) and `loadout mcp` are child processes of
`claude`, running as the same user, in the same container, as the agent's
`Bash`. They read the Jev key through `resolveApiKey` (`src/config.ts`): an
environment variable, or the file `jev.apiKeyFile` names. So `Bash` can read it
too, from `env`, the file or `/proc/<pid>/environ`, and the Anthropic
credential is in the same position. loadout cannot withhold a key from the
shell, and this protocol does not claim it can.

The allowed APIs are an exit too: skill text can carry an attacker's own key
and have `Bash` call the allowed API with it, putting a stolen credential into
a request the attacker reads from their own account. A host allowlist cannot
tell keys apart inside TLS. So no real key goes into the sandbox:
- **The gateway holds the keys.** A harness gateway outside the sandbox is the
  only route out. `claude` gets `ANTHROPIC_BASE_URL` pointing at it and a
  placeholder `ANTHROPIC_API_KEY`; the loadout home's `config.json` sets
  `jev.baseUrl` to it, and the file `jev.apiKeyFile` names holds a placeholder.
  The gateway drops any credential header, adds the real one, and forwards each
  route to one fixed upstream host over its own TLS connection. It allows only
  the paths the smoke run shows `claude` needs (the messages endpoint, not the
  batches or files APIs) and, in the `small-loadout` batch only, `POST
  /v1/systemone`, the one path `jevClient` calls. Everything else is refused
  and counted. An attacker's key is overwritten, so nothing the sandbox sends
  reaches another account. It also reads each Anthropic request body, within a
  size limit (16 MiB, Jev 4 MiB; the smoke run may lower them), and refuses a
  body whose top-level keys, tool `type` values, `model`, `cache_control` `ttl`
  values or `anthropic-beta` header values the smoke run did not see `claude`
  send (the arm's model and the overhead models it calls). That closes the
  server-side tools (web search, web fetch, code execution) and `mcp_servers`,
  which would give `Bash` web access and remote tools. Such a refusal
  invalidates the run. If a second run shows the same unseen value, `claude`
  itself sends it: the batch halts for Erik, who adds it as a deviation under
  Frozen, and the runs it touched are rerun. The `claude` version is pinned
  (see Arms). It needs an Anthropic API key.
- **The gateway cannot tell `claude` from `Bash`.** `Bash` is a child of
  `claude` and inherits its environment, so the placeholder key, the base URL
  and anything else `claude` holds are readable by `Bash`; a secret only
  `claude` has does not exist. The placeholder key is unique per run, which
  attributes each request to its run and refuses a straggler from an earlier
  run, and binds nothing more. So a skill can POST to the allowed paths itself,
  to get help from the arm's own model or to spend the cap. The protocol does
  not prevent that: it sorts every request by what it is, never by who sent it,
  and prices all of them.
- **Every request is exactly one of four things,** by its body and the links
  before it, whatever its status and whether the stream was cut or completed. A request carrying
  k-1 assistant turns is at position k. It *completes* when the gateway has
  read `message_stop` from upstream while the client is still connected; an
  `error` event inside a 200 stream is a failure. The *link* at position k is
  the first request there to complete: the first completed retry becomes the
  link, and a candidate that completes later is priced, never a link.
  - **(a) The next link:** the first request at position k that carries
    exactly links 1 to k-1 as its assistant turns, in order and equal by hash,
    and whose last user turn answers exactly the `tool_use` ids of link k-1.
    A link without `tool_use` that stopped at `max_tokens` is continued by a
    last user turn of ordinary text; one that stopped any other way has no
    next link. Earlier user turns are not compared, since `claude` may rewrite
    old tool results. Position 1 is the conversation's first request.
  - **(b) An exact retry** of the request that fixed position k (same body
    hash), at most as often as the retry limit the smoke run records.
  - **(c) A side call:** what `claude` calls outside the conversation (title,
    summary or similar). Per arm the smoke run pins the whole request body as a
    template: every key, `model`, `max_tokens`, system prompt, tools, header
    values and the text around the variable parts, hashed. Only the *slots*
    vary, and the smoke run lists them. A slot holds text copied from the chain
    so far (the prompt, a response's text, a tool result already in a request),
    checked as a substring, or an opaque value (an id, a time) in a recorded
    format, 64 bytes at most; none is longer than the longest the smoke run
    saw. So the fixed prompt replayed with another payload does not match. A
    match within the smoke run's count per run (or per `tool_use`) is a side
    call; retries are not counted again; a shortfall is reported. Subagents are
    off (see Arms): they would be more chains.
  - **(d) Off-chain,** and the run `invalid` (see Arms): everything else, cut
    or not, 2xx or not. That includes a second request at a position with
    another body (a fork, or `Bash` and `claude` both extending the chain), an
    assistant turn that is not a link, a second conversation (a `claude`
    started by `Bash`), a compaction and a side-call body off its template.
  - **Why it holds.** Assistant turns reach `claude` only through the gateway,
    and `tool_use` ids and thinking signatures are made upstream, so no request
    carries a turn the gateway did not return. Secrecy is not needed: a request
    `Bash` sends is the next link, and `claude`'s own is then a second one at
    that position, class (d). `Bash` can take the chain over by killing
    `claude`: one chain, priced like any other.
- **The gateway reads every forwarded request to the end,** whoever cut the
  client, within the drain (below), so a request cannot be cut after the
  answer and before `message_delta` to pay one output token.
- **Pricing.** Cost is the gateway's usage at list prices (Expected spend) plus
  the Jev cost, every rate at the over-100k tier for a request whose input
  passes 100k tokens. A request without final usage is priced from the last
  usage seen, and at its reservation when none was seen or the drain aborted
  it. The *reservation*, made before forwarding, uses the highest input-side
  price that can apply: `max_tokens` at the output price plus T input tokens at
  the cache-write price (1.25 times input), both at the over-100k tier if T
  passes 100k. T is the body's bytes without the base64 of images and documents
  (a token is at least a byte), plus 6,000 per image (an assumption; the smoke
  run checks the provider's maximum) and the whole context
  window per document block (its pages cannot be read from its bytes), at most
  the window.
- **Jev requests, `small-loadout` only.** The hook and `loadout mcp` send them
  as the same user as `Bash`, so the gateway cannot say who sent one. It
  verifies the path; the top-level keys `jevClient` sends (`model`, `state`,
  `questions`); the configured `model`; question ids and types equal to the
  sets `wideQuestions` and `closeQuestions` build; the 4 MiB limit; and a
  count. `askJev` sends two requests per decision (`src/route.ts`), none for an
  empty or follow-up prompt (`src/hook.ts`), and `jevClient` retries once on a
  429, 5xx, timeout or network error. With D = 1 + F (one hook decision, since
  `-p` takes one prompt; F the `find_skills` `tool_use` blocks in the chain's
  responses), 2xx requests are at most 2D and all requests at most 4D. More
  makes the run `invalid`; fewer is reported. Not verified: who sent a request,
  and `state` and the instructions, which carry the prompt, so `Bash` can spend
  up to the bound on well-formed Jev requests. Their cost is the 2xx requests
  at the rate the smoke run records.
- **A run ends in a fixed order.** (1) `claude` exits, or the runner stops it
  at the cap or the ceiling. (2) The gateway revokes the run's placeholder key;
  a new request on it is refused unread and counted. (3) The runner stops the
  sandbox and reads its state. (4) The gateway drains: it reads every upstream
  request of the run still in flight, Anthropic and Jev, for at most 2 minutes
  (twice the slowest response the smoke run measured, if longer), then aborts
  the rest at their reservations. (5) Only then are the run's record, classes
  and cost final, and collection or the next run can begin: the next run waits
  for the drain. A request refused between (2) and (3) does nothing and is not
  `invalid`; one on the revoked key after (3) means the stop failed, and the
  batch halts for Erik.
- **Not loadout proxying.** AGENTS.md rule 1 bars the product from proxying an
  agent's API traffic. This gateway is benchmark harness: not in `src/`, not
  shipped, used only in this sandbox on accounts made for it, through documented
  settings (`ANTHROPIC_BASE_URL`, `jev.baseUrl`); it leaves bodies as they are
  and adds a credential header. Erik confirms.
- **Keys per batch, with a cap.** Each batch (one arm, and the smoke run) has
  its own Anthropic key, and the `small-loadout` batch its own Jev key. A key is
  used nowhere else and has a provider spend cap set to the approved total for
  its batch (where there is none, the gateway refuses requests past a count the
  runner sets from that total). Each run has a ceiling on priced usage
  (Expected spend) and at most 2 requests in flight (the smoke run may raise
  this). Before forwarding one the gateway reserves its price against the
  ceiling and the batch cap, refusing it if either would be passed, and
  replaces the reservation with the actual price at the drain. A refusal is
  classed like any other request and does not itself invalidate the run. A run
  that hits its ceiling ends in the order above and is judged like `capped`.
- **Probed.** Before the smoke run a script, running as the agent's user in the
  run sandbox, prints yes or no for each of: a credential-shaped string (the
  patterns in [scan-patterns.json](scan-patterns.json)) other than the
  placeholders in `env`, the key file, `/proc/*/environ` and the home folder;
  and a connection straight to an API's address getting an answer. Against a
  stub upstream the gateway is shown to:
  - replace a credential header, and refuse a path, tool type, body, model,
    `cache_control` ttl and beta value off its lists;
  - class as (d) a second conversation, a fork, a copy beyond the retry limit,
    a forged assistant turn, a side call with a changed or padded slot or the
    fixed prompt replayed with another payload, and a **cut request that is
    none of (a) to (c)**, whatever its status. `Bash` sends these too, with a
    forged `result` event added to the stream: neither verdict nor cost change;
  - take a **529 on a link candidate whose retry completes** as valid, the
    retry being the link, and an original that completes after its retry as
    priced and not a link;
  - take a **`max_tokens` stop and its continuation** as a link, and a request
    after an `end_turn` stop as (d);
  - treat an `error` event inside a 200 as a failure;
  - price a client cut after the full answer and before `message_delta` from
    upstream's final usage; price reservations with a cache write, an over-100k
    body, an image and a PDF block; and drain.
- **Revoked, and confirmed.** A batch's keys are revoked when its last run
  (reruns included) ends, before any of its output is scanned, extracted,
  judged or committed; one request per key that must now be refused confirms
  it. If a revocation is not confirmed, nothing from the batch is
  committed. This is defence in depth: no real key was in the sandbox, and if
  the gateway failed, the key is dead before anything leaves the machine.
- **Scanned.** The runner never prints a key. The scan looks for each key's
  exact value (a hit means the gateway failed) and for the shapes in
  scan-patterns.json, in two passes: the collected file names and contents, the
  stream and the `claude` stderr, on the host, before extraction; then the
  extracted text, before judging (office files are compressed, so the first
  pass cannot see into them). A hit stops the batch and Erik is told. What the
  scan cannot see is under [What is committed](PROTOCOL.md#what-is-committed).

**Evidence.** A decision (accept, invalid, cost, rerun cause, treatment check)
rests on the first row only. The runner reports where the stream differs from
the gateway; the smoke run must agree exactly.

| Source | Pieces |
|---|---|
| Outside the agent's reach | The gateway's record (requests, classes, models, usage, ids, block hashes, the first request's tools, prompt and hook context, `find_skills` calls in returned responses, Jev shape and count); the runner's clock and kill reason; the engine's sandbox state; resolver and egress counters; collector, extraction and check results from the second sandbox; the self-check and probe (they run before any agent text exists); judge verdicts |
| Written in the sandbox, forgeable | The stream (init, `assistant` ids and usage, `result` fields such as `total_cost_usd`, `modelUsage`, `num_turns`, `duration_ms`, hook events), stderr, hook and `loadout mcp` output: reported only, labelled "reported by the sandbox", and the stream decides nothing. The files and final message are the output judged, not accounting |

Records the harness keeps outside the sandbox can carry what the agent put in
them, so each is counted, scanned or not kept:

| Record | Handling |
|---|---|
| Gateway | Per run: requests per allowed path, refused requests, bytes, status codes. Per request: class, `model` and beta values (from the fixed sets), usage (input and cache tokens in `message_start`, output in the last `message_delta`), the response's message id and stop reason, a hash of its content blocks (`type`, text, tool `id`, `name`, `input`, thinking `signature`; fields `claude` does not resend are left out, as the smoke run shows), the hashes of the assistant turns the request carries, and `max_tokens`. Bodies are parsed, never stored; no body, header, query string or refused path is logged. Local: ids and hashes carry bits the agent chose, so only sums and the classes by count are committed. |
| Firewall drop log, container engine log | Not kept (a refused address and port carry bits; the log driver is off). Refusals are counted only. |
| Stream JSON with hook events, final message, `claude` stderr | Local, never committed; scanned in pass one. |

Numbers the agent influences (duration, tokens, cost, test, row, dropped-file,
refused-request and class counts, the rejected and invalid flags) are a thin
channel too, a few bits per run. The control is the same: no real key in the
sandbox, and revocation before anything is committed.

Between runs, a new sandbox, run volume, loadout home, placeholder key, ceiling
and counters for each attempt, reruns included; the gateway and resolver keep
nothing else. The provider's prompt cache is not isolated: runs on the account
share it within its lifetime, so a run can start warm because of the one
before it, honestly (same tools and system prompt) or by a request `Bash` sent
to warm a prefix. A hit makes requests faster and billed cost lower, never
slower. It can move the `capped` flag, the duration and the billed cost by the
seconds per request a cached prefix saves; it does not change what a request
returns, the uncached cost behind the headline, or any check or verdict. The
order of arms is a stated limit and cache tokens are reported per run.
Isolating it would take a provider workspace per run; a nonce in the prompt
changes the treatment, and where `--append-system-prompt` lands in the cached
prefix was not checked.
