# Contributing

Use Node 22.12 or newer (22 or 24); see [AGENTS.md](AGENTS.md) for commands.

Tests need neither network access nor a TypeSafe key. Follow the
[evaluation discipline](AGENTS.md#evaluation-discipline), the
[Code Review Rules](AGENTS.md#code-review-rules) and the
[PR requirements](AGENTS.md#git-and-review).

Contributions intentionally submitted for inclusion are made under
[Apache-2.0](LICENSE), the same license as the project (inbound = outbound),
unless explicitly stated otherwise, as provided by section 5.

## Releasing

Only the maintainer releases. [release.yml](.github/workflows/release.yml)
runs when a `vX.Y.Z` tag is pushed. It checks that the tag is on `main` and
matches `package.json` and a `CHANGELOG.md` section, then builds and tests. The
`publish` job waits for approval in the `npm-release` environment, then runs
`npm publish --provenance` as `@erik-hedstrom/loadout` and creates the GitHub
release from that CHANGELOG section.

1. Move the `Unreleased` entries under `## X.Y.Z` in `CHANGELOG.md` and set the
   version in `package.json`; merge.
2. Tag the merge commit and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. Approve the `publish` job.

One-time setup, in the npm and GitHub settings: an `npm-release` environment
with Erik as required reviewer, and an `NPM_TOKEN` secret in it (a granular
token limited to publishing this package). The first publish needs the token.
Once the package exists, a trusted publisher can replace it: the job already
has `id-token: write`, so remove `NODE_AUTH_TOKEN` and the secret.
