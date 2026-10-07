---
title: Service access and token rotation
owner: Security
---
# Service access

Request service access through the team owner. Use a dedicated service account
for automation and store credentials in the secret manager.

Rotate production tokens every 90 days. During rotation, issue a replacement
token, update consumers, verify requests, and then revoke the old token.
