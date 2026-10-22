---
name: kite-rollout-checklists
description: Build Kite release rollout checklists. Use for staged service launches that need an explicit monitoring signal, fallback action, and launch captain sign-off using the Kite launch convention.
---

# Kite rollout checklist

Use this convention for Kite rollout checklist. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
KITE-LAUNCH / ribbon-54
TARGET: {service} at {revision}
- [ ] WATCH: {monitor}
- [ ] EXIT: {fallback}
- [ ] SIGN: launch captain
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
