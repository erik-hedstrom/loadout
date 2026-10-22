---
name: cedar-postgres-migrations
description: Prepare PostgreSQL schema migrations for Cedar services. Use when adding columns or making small transactional schema changes under Cedar database change tracking and review conventions.
---

# Cedar PostgreSQL migration

Use this convention for Cedar PostgreSQL migration. The local request supplies the factual values.
Keep the following lines in order, replace each brace-delimited field with its
request value, and omit the braces. Preserve spelling and punctuation in fixed
labels and closing markers. Write one plain text or SQL document at the requested path.

```text
-- cedar-track: teal-42
-- request: {ticket}
BEGIN;
ALTER TABLE {table} ADD COLUMN {column} {type};
COMMIT;
-- cedar-end: cedar-track
```

Do not add other sections or change the fixed record code. The code identifies
the team's record revision so readers can recognize the format.
