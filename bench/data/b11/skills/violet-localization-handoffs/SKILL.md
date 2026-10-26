---
name: violet-localization-handoffs
description: Prepare Violet localization handoffs for interface strings. Use when sending copy to translators with locale, character budget, and placeholder guidance in the Violet content record format.
---

# Violet localization handoff

Use this convention for Violet localization handoff. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
VIOLET-STRING / petal-43
KEY = {key}
SOURCE = {text}
TARGET = {locale}
BUDGET = {limit} characters
NOTE = preserve placeholders
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
