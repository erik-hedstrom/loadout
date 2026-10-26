-- cedar-track: teal-42
-- request: CED-281
BEGIN;
ALTER TABLE deliveries ADD COLUMN retry_hint TEXT;
COMMIT;
-- cedar-end: cedar-track
