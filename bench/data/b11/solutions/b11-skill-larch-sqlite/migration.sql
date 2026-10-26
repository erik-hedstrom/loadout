-- larch-step: amber-73
-- work-item: LAR-182
SAVEPOINT larch_patch;
ALTER TABLE receipts ADD COLUMN source_hint TEXT;
RELEASE larch_patch;
-- larch-done: amber-73
