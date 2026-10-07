# Security

## Threat model

loadout treats installed skills as untrusted text. The boundaries are skill
file access, context passed to the host agent, requests to TypeSafe and access
to the MCP endpoint.

### Third-party skills

loadout imports and copies skills without executing their code
(`addSkills`, `addFromGitHub` in [library.ts](src/library.ts)). Manifest and
MCP skill-file reads use `readConfined`, which rejects absolute paths,
traversal, files resolving outside the skill folder and oversized files;
`readSkillFile` also rejects binary content.

For injected context and MCP file responses, `escapeSkillTags` prevents skill
text from opening or closing loadout's skill tags. `injectionBlock` frames
instructions as third-party reference material; `promptContext` similarly
frames skill metadata, and `loadSkill` marks file responses as third-party
([launch.ts](src/launch.ts), [hook.ts](src/hook.ts), [mcp.ts](src/mcp.ts)).
This framing does not guarantee that a host agent will resist prompt injection
or decline to execute a command suggested by a skill.

### Prompt hook

`runHook` reads the host's JSON from stdin. With Jev enabled and a key present,
`promptContext` routes nonempty prompts except short follow-ups identified by
`isFollowUp`. `route` sends the trimmed prompt, repository directory name,
top-level file names, dependency names and language extensions to TypeSafe,
alongside candidate skill names/descriptions and shortlisted instruction
excerpts. `askJev` makes two requests through `jevClient` to
`jev.baseUrl` plus `/v1/systemone` (default endpoint: `https://api.typesafe.ai/v1/systemone`)
([cli.ts](src/cli.ts), [hook.ts](src/hook.ts), [route.ts](src/route.ts),
[repo.ts](src/repo.ts), [jev.ts](src/jev.ts), [config.ts](src/config.ts)).

Do not install the `UserPromptSubmit` hook, or remove its entry from your host
configuration, to avoid automatic per-prompt routing. Setting `router` to
`"lexical"` in loadout's config prevents Jev calls (`runHook`, `route`).
Hook state stores offered/injected skill IDs, not prompt text (`writeState`).

### HTTP MCP

`loadout mcp --http` defaults to `127.0.0.1:8787`. Loopback may run without a
token; a non-loopback `--host` or any `--allowed-host` requires `--token-file`.
When configured, `serveHttp` checks `Authorization: Bearer <token>` with
`timingSafeEqual` and enables the SDK's Host check. It filters the library to
skills, exposing only `find_skills` and `load_skill`, with no MCP gateway
([cli.ts](src/cli.ts), [mcp.ts](src/mcp.ts)). Authorized clients can read
library skills and spend Jev credit through searches. The server uses plain
HTTP; remote access needs a trusted HTTPS tunnel or TLS terminator.

### Credentials

`resolveApiKey` reads `TYPESAFE_API_KEY` first, then the configured
`jev.apiKeyFile`; `jevClient` uses it as a bearer credential
([config.ts](src/config.ts), [jev.ts](src/jev.ts)).

E9 is a merge prerequisite: this branch cannot yet promise that MCP server
environment and header values are never printed, saved or placed in argv.
`materialize` writes server configuration to session files, `codexArgs`
serializes these values into arguments, and CLI JSON/dry-run output can expose
them ([launch.ts](src/launch.ts), [cli.ts](src/cli.ts)). Recheck these paths
after E9 merges before replacing this warning with a protection claim.

## Out of scope

loadout does not sandbox the host agent or opted-in MCP server processes
(`launch`, `Gateway.connect`), protect against a compromised local account,
or control TypeSafe's data retention or a tunnel provider's security. Skills
must still be reviewed before use; framing and confined reads are limited
protections, not a trust decision.

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/erik-hedstrom/loadout/security/advisories/new).
Include the affected version, reproduction steps and impact, with credentials
removed. Do not report vulnerabilities in public issues.
