#!/usr/bin/env bash
# Sample deployment endpoint uses .invalid so this fixture cannot deploy a site.
set -euo pipefail
: "${DEPLOY_TOKEN:?DEPLOY_TOKEN is required}"
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $DEPLOY_TOKEN" \
  --data-binary "@$1/index.html" \
  https://deploy.example.invalid/site
