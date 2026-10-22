---
name: meadow-dataset-cards
description: Write Meadow research dataset cards. Use to describe a dataset size, intended use, and content boundaries with the Meadow stewardship record used for internal research data documentation.
---

# Meadow dataset card

Use this convention for Meadow dataset card. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
MEADOW-CARD / clover-67
SET: {name}
ROWS: {rows}
USE: {purpose}
BOUNDARY: {exclusion}
REVIEW: meadow stewardship
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
