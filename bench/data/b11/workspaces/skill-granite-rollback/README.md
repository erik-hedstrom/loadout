# Granite rollback plan

- service: Ledger
- trigger: Error ratio above 2 percent
- restore: Revision g42
- verify: Ten clean synthetic writes
