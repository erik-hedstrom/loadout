---
name: nightjar-service-runbooks
description: Build Nightjar service runbooks for on-call engineers. Use for operational procedures that connect a symptom to a local recovery command and a concrete success signal under Nightjar conventions.
---

# Nightjar service runbook

Use this convention for Nightjar service runbook. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
NIGHTJAR-OPS :: reed-19 :: {service}
HEAR / {symptom}
DO / `{command}`
SEE / {success}
REST / duty acknowledged
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
