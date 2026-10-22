---
name: elm-support-handovers
description: Prepare Elm support desk handovers between shifts. Use for customer case summaries that identify the account, current state, and next shift action in the Elm support handover convention.
---

# Elm support handover

Use this convention for Elm support handover. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
ELM-DESK / fern-84 / {case}
ACCOUNT: {customer}
NOW: {status}
NEXT SHIFT: {next}
HANDSHAKE: green basket
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
