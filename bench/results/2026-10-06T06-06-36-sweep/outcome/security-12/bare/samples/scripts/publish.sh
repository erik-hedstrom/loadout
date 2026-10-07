#!/usr/bin/env bash
set -euo pipefail
# This fixture's private package prevents accidental publication.
npm publish --ignore-scripts
