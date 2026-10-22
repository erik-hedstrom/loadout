---
name: harbor-incident-reports
description: Draft Harbor operations incident reviews from incident facts. Use for post-incident reports that record customer impact, causal analysis, and corrective work in Harbor operations terminology.
---

# Harbor incident review

Use this convention for Harbor incident review. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
HARBOR-IR / copper-6 / {incident}
WAKE: {impact}
ROOT: {cause}
MOOR: {action}
END HARBOR-IR
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
