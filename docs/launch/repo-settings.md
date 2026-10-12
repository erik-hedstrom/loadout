# Repo settings: drafts for Erik

Backlog B4. Nothing here is applied. Changing repo settings and uploading the
preview image are Erik's ([AGENTS.md](../../AGENTS.md) hard rule 4).

## Description

```
Picks skills for each Claude Code or Codex prompt, and MCP servers and model tier per launched session, routed by Jev.
```

118 characters (GitHub allows 350). The prompt hook routes skills only; MCP
servers and the model tier apply when the launcher starts a session
([docs/hosts.md](../hosts.md)). It makes no claim a benchmark has to back.
Leave the website field empty until there is a page to point to.

## Topics

Repository counts come from GitHub search on 2026-10-12 (`topic:<name>`), so
each topic is one people use. They show how crowded a topic is; how a topic
affects who finds loadout is not measured.

| Topic | Repos | Why |
|---|---:|---|
| `claude-code` | 89,773 | The main host loadout plugs into. |
| `codex-cli` | 3,033 | The other host. |
| `agent-skills` | 31,496 | What loadout selects among. |
| `model-context-protocol` | 35,844 | loadout is an MCP server and selects MCP servers. |
| `mcp-server` | 35,112 | loadout ships an MCP server (`loadout mcp`). |
| `claude-code-plugin` | 9,683 | The install path (plugin plus hook). |
| `ai-agents` | 112,718 | The broad category. |
| `coding-agent` | 6,731 | The narrower category loadout is in. |
| `llm-routing` | 547 | The routing idea. |
| `developer-tools` | not checked | A general tag for a CLI people install. |
| `typescript` | not checked | The implementation language. |

11 topics, within GitHub's limit of 20. Skipped: `llm` and `claude`,
which are too broad to help, and `codex` (39,141 repos), for which `codex-cli`
is the narrower choice.

## Steps for Erik

1. Open https://github.com/erik-hedstrom/loadout and click the gear next to
   "About" (top right of the code tab).
2. Paste the description. Type each topic and press Enter, then **Save changes**.
3. Social preview: **Settings**, **General**, scroll to **Social preview**,
   **Edit**, **Upload an image**, and choose
   [docs/brand/social-preview.png](../brand/social-preview.png) (1280 x 640).
   [social-preview.svg](../brand/social-preview.svg) is the source.
4. Check it: paste the repo URL into a private chat or a link-preview tool and
   confirm the image shows the name, tagline and `$0.0011`.

The image's one figure, `$0.0011 per routing decision`, is from
[v4](../../bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged),
315 realistic requests. On C1's 300 new requests the mean was $0.0012
([C1](../../bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)), so edit
both files if you would rather show a range. To change the image, edit the SVG
and render it again at an exact 1280 x 640 viewport, for example with
Puppeteer's `page.setViewport` and `page.screenshot`; Chrome's
`--window-size` flag leaves a blank strip at the bottom.
