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
runs when a `vX.Y.Z` tag is pushed:

1. `verify` checks that the tag is on `main` and matches `package.json`, and
   that `CHANGELOG.md` has entries under `## X.Y.Z`; then it builds and tests.
2. `publish` waits for approval in the `npm-release` environment, builds
   without the token, and runs `npm publish --provenance --ignore-scripts` as
   `@erik-hedstrom/loadout`.
3. `release` creates the GitHub release from the CHANGELOG entries. It is a
   separate job, so a failure there reruns without publishing to npm again.

The workflow cannot enforce its own protection. GitHub creates a missing
environment when a workflow references it, with no protection rules or secrets
([docs](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)),
so the settings below must exist **before the first tag is pushed**.

**One-time setup (Erik)**

- npm: the `@erik-hedstrom` scope exists when it matches your npm username
  ([scopes](https://docs.npmjs.com/about-scopes)); otherwise create an
  organization with that name. Create a granular access token with
  "Read and write (publish and stage)", set to the `@erik-hedstrom` scope under
  "Only select packages and scopes". The package does not exist yet and the
  docs do not say it can be selected by name. Choose a short expiry (write
  tokens are capped at 90 days, per the
  [npm changelog](https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/)),
  and check bypass-2FA if your account requires 2FA, since CI cannot enter a
  code ([tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)).
- GitHub, Settings, Environments: create `npm-release`; add Erik as a required
  reviewer; set Deployment branches and tags to "Selected branches and tags"
  with a tag rule `v*`; add the token as the environment secret `NPM_TOKEN`
  (not a repository secret). Environments, protection rules and secrets work
  for public repositories on the Free plan.

**Each release**

1. In one PR: set the version in `package.json`, put the entries under
   `## X.Y.Z` in `CHANGELOG.md` (the section becomes the release notes, so
   links in it are absolute), and, for the first release, make
   `npm install -g @erik-hedstrom/loadout` step 1 of the README quickstart,
   remove its "Until the npm package ... is released" wording, and remove its
   "After the release" bullet, keeping that bullet's note (the command is still
   `loadout`, the plugins find it on `PATH`, `npx` does not put it there so a
   hook cannot use it) where the new step 1 lands. The README ships in the
   tarball, and until this PR it correctly says the package is not released.
2. After it merges, tag the merge commit and push the tag:
   `git tag vX.Y.Z <commit> && git push origin vX.Y.Z`.
3. Approve the `publish` job.

**After the first release**, a trusted publisher can replace the token
([docs](https://docs.npmjs.com/trusted-publishers)). Add it in the package's
npm settings for repository `erik-hedstrom/loadout`, workflow `release.yml`,
and environment name `npm-release`, so a run outside the protected environment
cannot publish. Then remove `NODE_AUTH_TOKEN` and the secret from the workflow
and the environment, and delete the token on npmjs.com (Access Tokens, then the
x next to the token; revocation can take up to an hour,
[docs](https://docs.npmjs.com/revoking-access-tokens)). The job already has
`id-token: write`.