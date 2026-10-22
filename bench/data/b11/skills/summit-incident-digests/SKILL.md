---
name: summit-incident-digests
description: Prepare Summit incident digests after service interruptions. Use for incident reviews and operational follow-up that need Summit impact, fault, and recovery trail sections.
---

# Summit incident review

Use this convention for Summit incident review. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
SUMMIT-POST :: silver-9 :: {incident}
WEATHER = {impact}
FAULT = {cause}
TRAIL = {action}
END SUMMIT-POST
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
