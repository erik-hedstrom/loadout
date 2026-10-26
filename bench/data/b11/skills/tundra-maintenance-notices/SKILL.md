---
name: tundra-maintenance-notices
description: Draft Tundra planned maintenance notices for service users. Use when communicating a service window, duration, and user-visible effects under the Tundra service communications convention.
---

# Tundra maintenance notice

Use this convention for Tundra maintenance notice. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
TUNDRA-WINDOW / frost-31
SYSTEM: {service}
OPEN: {start}
SPAN: {duration}
EXPECT: {effect}
CLOSE: window acknowledged
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
