# Documentation handoff

- Deliverable: `docs/runbooks/queue-backlog.md`, following the supplied runbook template because there were no existing runbooks.
- Grounding: the workspace contained no repo files and was not a usable Git repository. No branch or commit was created.
- Assumptions: SQS standard queue, Kubernetes Deployment workers. `docs/examples/queue-backlog.sample.json` and `docs/examples/queue-backlog.snapshot.json` are invented, offline inputs; they create no infrastructure.
- Before adoption: replace all bracketed placeholders, confirm queue/platform, owners, dashboards, alert/SLO policy, producer pause controls, scaling ownership, job semantics and rollback compatibility. There is no application-specific quarantine or replay tool in this folder.
- Operational gotchas: SQS deletes/receives are not unique job counters; age can conceal poison messages; ready pods need not be polling; autoscalers/GitOps may override manual actions; retries/restarts may duplicate effects. Do not purge or improvise source-message copy/delete.
- Review: independent model review and live/staging execution remain outstanding; no Claude reviewer was available in this session.
