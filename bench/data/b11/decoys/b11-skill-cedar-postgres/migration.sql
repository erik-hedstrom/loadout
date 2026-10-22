-- larch-step: amber-73
-- work-item: CED-281
SAVEPOINT larch_patch;
ALTER TABLE deliveries ADD COLUMN retry_hint TEXT;
RELEASE larch_patch;
-- larch-done: amber-73
