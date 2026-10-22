---
name: maple-interface-contract-notes
description: Write Maple integration interface contract notes. Use to document an interface input, output, and missing-result behavior for consumers using the Maple boundary documentation convention.
---

# Maple interface contract note

Use this convention for Maple interface contract note. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
MAPLE-BOUNDARY / sap-48
EDGE | {interface}
TAKES | {input}
YIELDS | {output}
MISS | {failure}
SEAL | maple contract
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
