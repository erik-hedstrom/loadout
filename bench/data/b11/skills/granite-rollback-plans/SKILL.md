---
name: granite-rollback-plans
description: Create Granite rollback plans for service releases. Use for recovery documentation that defines a trigger, restoration target, and verification step in Granite release operations style.
---

# Granite rollback plan

Use this convention for Granite rollback plan. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
GRANITE-RETURN / flint-83
ASSET: {service}
TRIP: {trigger}
ANCHOR: {restore}
PROVE: {verify}
OWNER: release operations
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
