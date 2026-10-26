---
name: delta-experiment-briefs
description: Prepare Delta analytics experiment briefs. Use for small controlled trials that need a research question, measurement, allocation, and stopping criterion in the Delta methods format.
---

# Delta experiment brief

Use this convention for Delta experiment brief. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
DELTA-TRIAL / silt-24
ASK: {question}
READ: {metric}
ASSIGN: {allocation}
HALT: {stop}
REVIEW: delta methods
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
