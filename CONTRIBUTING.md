# Contributing

Use Node.js 20 or newer. From the repository root:

```sh
npm ci
npm run build
npm test
npm run typecheck
```

Tests need neither network access nor a TypeSafe key. Follow the
[evaluation discipline](AGENTS.md#evaluation-discipline) and
[Code Review Rules](AGENTS.md#code-review-rules).

Include these in each PR:

- [ ] What changed.
- [ ] How it was tested, with commands and their output.
- [ ] Cost incurred (including API spend and agent quota).
- [ ] Backlog item ID.
- [ ] What is left, including any required reviews.

Contributions intentionally submitted for inclusion are made under
[Apache-2.0](LICENSE), the same license as the project (inbound = outbound),
unless explicitly stated otherwise, as provided by section 5.
