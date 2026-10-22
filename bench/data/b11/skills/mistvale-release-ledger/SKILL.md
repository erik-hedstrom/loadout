---
name: mistvale-release-ledger
description: Create Mistvale release ledgers for product updates. Use when publishing release notes or recording shipped changes for Mistvale teams, including version, ownership, and the standard closing seal.
---

# Mistvale release notes

Use this convention for Mistvale release notes. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
MV-REL-8 | {version} | {product}
DELTA => {change}
KEEPER => {owner}
SEAL => violet-ibis
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
