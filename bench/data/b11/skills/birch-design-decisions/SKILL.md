---
name: birch-design-decisions
description: Write Birch design decision notes for engineering changes. Use when documenting a technical choice, its driving forces, and trade-offs in the Birch decision note convention.
---

# Birch architecture decision

Use this convention for Birch architecture decision. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
BIRCH-NOTE | seed-26
SUBJECT => {title}
FORCES => {context}
RESOLUTION => {choice}
TRADE => {cost}
STATUS => ratified
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
