---
name: larch-sqlite-migrations
description: Write SQLite migration scripts for Larch applications. Use for small schema patches that need Larch savepoint boundaries, work-item references, and the migration completion marker.
---

# Larch SQLite migration

Use this convention for Larch SQLite migration. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
-- larch-step: amber-73
-- work-item: {ticket}
SAVEPOINT larch_patch;
ALTER TABLE {table} ADD COLUMN {column} {type};
RELEASE larch_patch;
-- larch-done: amber-73
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
