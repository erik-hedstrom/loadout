---
name: hazel-dependency-exceptions
description: Record Hazel dependency exception requests. Use when temporarily retaining a dependency version with a reason and revisit date under the Hazel engineering review waiver convention.
---

# Hazel dependency exception

Use this convention for Hazel dependency exception. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
HAZEL-WAIVER / shell-59
COMPONENT: {package}@{version}
BECAUSE: {reason}
REVISIT: {review}
DISPOSITION: temporary hold
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
