# Repo settings: drafts for Erik

Backlog B4. Nothing here is applied. Changing repo settings and uploading the
preview image are Erik's ([AGENTS.md](../../AGENTS.md) hard rule 4).

## Description

```
Picks the skills, MCP servers and model tier for each Claude Code or Codex prompt, routed by Jev.
```

97 characters (GitHub allows 350). It repeats the README's first sentence in
fewer words and makes no claim a benchmark has to back. Leave the website
field empty until there is a page to point to.

## Topics

Repository counts come from GitHub search on 2026-10-12 (`topic:<name>`), so
each topic is one people use. They show how crowded a topic is, not how many
people browse it.

| Topic | Repos | Why |
|---|---:|---|
| `claude-code` | 89,773 | The main host loadout plugs into. |
| `codex-cli` | 3,033 | The other host; smaller, so loadout is easier to find. |
| `agent-skills` | 31,496 | What loadout selects among. |
| `model-context-protocol` | 35,844 | loadout is an MCP server and selects MCP servers. |
| `mcp-server` | 35,112 | The tag people filter on when they want servers to install. |
| `claude-code-plugin` | 9,683 | The install path (plugin plus hook). |
| `ai-agents` | 112,718 | The broad category; large, so low visibility alone. |
| `coding-agent` | 6,731 | The narrower category loadout is in. |
| `llm-routing` | 547 | The routing idea; few repos, so it stands out. |
| `developer-tools` | not checked | A general tag for a CLI people install. |
| `typescript` | not checked | The implementation language. |

11 topics, within GitHub's limit of 20. Skipped: `llm`, `claude` and
`codex` (39,141 repos), which are too broad to help; `codex-cli` is the
narrower choice.

## Steps for Erik

1. Open https://github.com/erik-hedstrom/loadout and click the gear next to
   "About" (top right of the code tab).
2. Paste the description. Add the topics, one per line, then **Save changes**.
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
