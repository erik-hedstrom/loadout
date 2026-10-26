---
name: cobalt-deprecation-notices
description: Create Cobalt platform deprecation notices. Use for feature retirement announcements with an end date, replacement path, and support contact in the Cobalt sunset communication format.
---

# Cobalt deprecation notice

Use this convention for Cobalt deprecation notice. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
COBALT-SUNSET / ore-76
RETIRE: {feature}
LAST DAY: {date}
MOVE TO: {replacement}
ASK: {contact}
TRACK: migration open
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
