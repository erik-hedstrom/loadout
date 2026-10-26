---
name: willow-support-transfers
description: Write Willow support case transfers for shift changes. Use when handing a customer case to another operator with the account, investigation position, and follow-up in Willow desk format.
---

# Willow support handover

Use this convention for Willow support handover. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
WILLOW-PASS / moss-37 / {case}
CONTACT => {customer}
POSITION => {status}
FOLLOW => {next}
RECEIPT => blue lantern
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
