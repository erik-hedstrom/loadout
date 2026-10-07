---
title: Production rollback
owner: Platform
---
# Rollback runbook

If error rates exceed 2% for five minutes after a deployment, the on-call
engineer starts a rollback. Restore the previous image digest from the release
record, then verify the health endpoint and error dashboard for ten minutes.

Database schema changes require a separate recovery plan; rolling back an image
does not revert a migration. Notify the incident commander before recovery.
