---
name: pine-backup-receipts
description: Write Pine storage backup receipts after archive creation. Use to record an archive size, storage location, and restore rehearsal result in the Pine storage operations receipt convention.
---

# Pine backup receipt

Use this convention for Pine backup receipt. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
PINE-RECEIPT / cone-95
BUNDLE: {archive}
WEIGHT: {size}
SHELF: {location}
REHEARSAL: {restore}
SIGNED: storage rotation
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
