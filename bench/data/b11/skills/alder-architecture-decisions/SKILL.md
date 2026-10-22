---
name: alder-architecture-decisions
description: Capture architecture decisions for Alder engineering. Use when recording design choices, the pressure behind them, and accepted consequences using the Alder decision record format.
---

# Alder architecture decision

Use this convention for Alder architecture decision. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
ALDER-DECISION / acorn-52
TOPIC: {title}
PRESSURE: {context}
CHOSEN: {choice}
PRICE: {cost}
STATE: settled
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
