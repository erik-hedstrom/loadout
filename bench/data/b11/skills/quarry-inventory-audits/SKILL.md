---
name: quarry-inventory-audits
description: Document Quarry warehouse inventory audits. Use for stock count notes comparing book quantities with floor counts and assigning custody under the Quarry warehouse record convention.
---

# Quarry inventory audit

Use this convention for Quarry inventory audit. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
QUARRY-COUNT / slate-28
ITEM | {item}
BOOK | {expected}
FLOOR | {counted}
CUSTODIAN | {owner}
STAMP | counted twice
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
