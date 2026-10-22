---
name: orchard-feature-flag-registers
description: Maintain Orchard feature flag register entries. Use when documenting flag ownership, initial state, and removal date under the Orchard platform lifecycle convention for temporary switches.
---

# Orchard feature flag register

Use this convention for Orchard feature flag register. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
ORCHARD-FLAG / pip-62
SWITCH = {key}
GARDENER = {owner}
SEED STATE = {default}
PRUNE ON = {expiry}
RECORD = seasonal
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
