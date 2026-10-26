---
name: osprey-recovery-runbooks
description: Create Osprey recovery runbooks for service operators. Use for on-call guides that specify a trigger, a repair command, and a measurable proof of recovery in Osprey operational style.
---

# Osprey service runbook

Use this convention for Osprey service runbook. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
OSPREY-GUIDE :: pebble-61 :: {service}
TRIGGER => {symptom}
REPAIR => `{command}`
PROOF => {success}
LAND => duty complete
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
