# Recording the A5 demo

This is the free preparation for A5. The real GIF and the root README change
wait for the coordinator's paid take. Never publish the stub preview.

## Prerequisites

Run in WSL Ubuntu with Node >=22.12, `node_modules` installed and `npm run
build` completed in this checkout. `claude` must be the Windows Claude Code
npm shim on WSL's PATH, as in [bench/invoke.ts](../../bench/invoke.ts).
No package is installed into the user's agent configuration.

Install these official x86_64 Linux musl release binaries in a tools directory
on the Windows mount. The SHA-256 values below match the release assets'
published GitHub API `digest` fields (verified 2026-11-04).

| Tool | Official release asset | SHA-256 |
|---|---|---|
| asciinema 3.2.1 | [asciinema-x86_64-unknown-linux-musl](https://github.com/asciinema/asciinema/releases/download/v3.2.1/asciinema-x86_64-unknown-linux-musl) | `bec9781bc8f297a9d3d74ff60205599507f2abba1183578b8b2f22be4c999214` |
| agg 1.9.0 | [agg-x86_64-unknown-linux-musl](https://github.com/asciinema/agg/releases/download/v1.9.0/agg-x86_64-unknown-linux-musl) | `ddcbf6ca044c8ac3a434dcb9ee89fb9e3be87209982b7c2adb55f782e8f0f390` |

Name them `asciinema` and `agg` and mark them executable. The renderer uses the
existing DejaVu Sans Mono font. Neither Chromium nor ffmpeg is needed.

## Run

Export these variables outside the recorded terminal. Values are deliberately
absent from this document and from the on-screen commands.

| Variable | Purpose |
|---|---|
| `A5_TOOLS_DIR` | Directory containing the two binaries; Windows-mounted |
| `A5_OUTPUT_DIR` | Scratch directory for takes; Windows-mounted |
| `A5_LIBRARY_DIR` | Optional source skills directory; defaults to `$HOME/.loadout/library/skills` |
| `A5_JEV_KEY_FILE` | Paid only: existing key file's absolute WSL path, passed privately by the coordinator |
| `CLAUDE_CODE_OAUTH_TOKEN` | Paid only: exported privately by the coordinator; never read or printed by these scripts |

```bash
bash docs/demo/take.sh dry-run
# Only the coordinator runs this next command; it spends quota:
bash docs/demo/take.sh paid
```

Each run gets a new directory containing `demo.cast`, `demo.gif`, `audit.json`
and `skills.sha256`. A paid take also retains `hook-evidence.json`, only the
hook state's offered/injected skill keys. The scripts delete the temporary HOME and Windows runtime
directory on exit, including the generated key-file pointer and Claude state.
They never read the machine's loadout config or copy login files. Only
loadout's own `resolveApiKey()` opens the supplied key file in the paid hook.
Do not use `bash -x`, debug logging, or record credential setup.

The take starts the stock **interactive** `claude` CLI with an initial prompt;
it does not use `loadout claude`, `-p`, a proxy, or synthetic agent output.
Approve normal startup/trust screens. After the answer, type `/exit`.
Target 30–45 seconds, including the seven-second audit hold. If onboarding or
latency makes it longer, keep the honest take or discard and re-take; do not
cut, splice, accelerate, or replace frames. The recording displays the short
equivalent relative plugin path; the process receives its Windows translation.

## Environment and evidence

The isolated HOME lives under `/var/tmp`. `CLAUDE_CONFIG_DIR`, `LOADOUT_HOME`,
`CODEX_HOME` and XDG state are inside it. The Windows CLI's working directory
and `USERPROFILE` are in the take's temporary Windows runtime directory,
because its shell cannot work from a WSL UNC cwd. No real agent home is edited.

Twenty-four existing manifests are copied into the isolated Claude skills directory:
`canvas-design`, `docx`, `frontend-design`, `mcp-builder`, `pdf`, `pptx`,
`webapp-testing`, `xlsx`, `ai-podcast-creation`, `managed-airflow-dag-authoring`,
`use-js-interop`, `nextflow-development`, `chatgpt-apps`, `compose-outreach`,
`zoom-general`, `azure-validate`, `clinical-decision-support`,
`migrate-dotnet8-to-dotnet9`, `handle-objection`, `setup-zoom-webhooks`,
`social-content-engine`, `linear`, `qutip`, `speech-to-text`.
These same 24 plus `obsidian-markdown` are copied
into loadout's library. Only `SKILL.md` is copied, through `readConfined()`;
none of their code, templates, or other references is executed. Source content
is third-party material. The manifest hashes identify the exact take's data.
The audit excerpts the Claude summary, comparison and method from the real
offline command and wraps at word boundaries. It is an estimate
from descriptions, not a measured token-saving claim.

The plugin is copied from this checkout's `plugins/loadout`; its hooks and
metadata are unchanged. Only `.mcp.json`'s launch command is replaced with
this checkout's WSL Node entry point, matching `bench/invoke.ts`. The PATH
shim bridges the unchanged `loadout hook claude` command into the same WSL
runtime. Before capture, the built `dist`, `package.json` and installed
`node_modules` are copied into `/var/tmp` for fast WSL startup (D17); no install
or dependency lifecycle script runs. `WSLENV` forwards a fixed list of paths and the OAuth token. The
Jev key-file path is stored only in the temporary config, never forwarded or
printed. Embeddings are disabled to avoid a model download; Jev routing and
injection policy retain their defaults in paid mode.

The prompt asks for an Obsidian note with YAML properties, a wikilink, a warning
callout and tasks. It neither names a skill nor instructs the agent to open one.
`obsidian-markdown` is absent from the native Claude skills. The selection
remains Jev's decision; opening and using it remains Claude's decision.

Use **Sonnet 5.5** (`claude-sonnet-5-5`): it is the cheaper model with direct
skill-opening evidence for this example in [D13](../../bench/RESULTS.md#the-plugin-with-its-mcp-server-d13-2026-11-03).
The earlier Haiku probe only establishes hook delivery. This interactive
demo, its smaller library and its prompt are not a replication of D13.
Allow about **$0.05–$0.20 API-equivalent per take**, plus under $0.002 for
one Jev routing decision (normally **two** HTTP calls, wide then close).
Reasoning: roughly 20–60k aggregate input tokens and 0.5–2k output tokens at
[Sonnet 5.5 pricing](https://platform.claude.com/docs/en/about-claude/pricing)
($2/$10 per million input/output tokens, before cache effects) is $0.045–$0.14;
the wider allowance covers cache writes and extra turns. OAuth uses subscription
quota, not necessarily an API charge. D13 averaged $0.152 per longer session;
costs and successful skill use for this take are still unmeasured.

## Look and acceptance

Impeccable direction: let the actual terminal be the proof. One steady frame,
GitHub Dark's charcoal ground and pale text, a cyan shell prompt, DejaVu Sans
Mono at 18 px, 1.25 line height, 96 columns by 30 rows. No title cards, fake
hook messages, decoration, or claimed savings. At README width the commands
and tool names must remain readable. Render at eight FPS and normal speed,
with no idle compression, then hold the final frame for three seconds.

Before adding the real GIF to the README, inspect the cast and GIF locally:

1. The real audit appears first with meaningful installed-skill inventory cost.
2. The session is stock Claude, and the loadout plugin's server connects.
3. The hook supplied `obsidian-markdown`: inspect `hook-evidence.json` for its
   offered/injected key. If stronger delivery evidence is needed, inspect local
   Claude transcript context for `<skill_relevance>` or an injected third-party
   block before leaving the session; temporary state is deleted on exit.
   Hook state establishes the hook's decision, not the host's receipt on its
   own. A tool call alone does not establish hook delivery.
4. Claude visibly opens `obsidian-markdown` via the plugin's `load_skill` (or
   reads its `SKILL.md`) and produces the requested Obsidian constructs.
   A mention of the skill alone is insufficient. If text was injected and
   nothing is visibly opened, re-take or report the missing acceptance.
5. No credential, key-file path, personal path, account identity, or stub appears.
6. The GIF is under **2,000,000 bytes**; the script checks this. Keep every
   original frame. If size fails, re-render the whole cast with fewer FPS.

Do not publish raw casts or transcripts without inspecting them. A failed
take is not evidence of success. The free preview tests rendering, timing and
the audit only; the actual model, Jev selection, interactive startup, hook
delivery and skill use remain for the coordinator to verify.
