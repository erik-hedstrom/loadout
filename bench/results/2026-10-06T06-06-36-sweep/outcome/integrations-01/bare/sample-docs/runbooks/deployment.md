---
title: Production deployment
owner: platform
---

# Release runbook

Build and test the service before deployment. Ask the on-call engineer to
approve the release, then deploy the tagged artifact to production.

If error rates increase, roll back to the previous artifact and record the
incident in the operations log.
