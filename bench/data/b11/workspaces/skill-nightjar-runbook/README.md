# Nightjar service runbook

- service: Indexer
- symptom: Queue depth above 500
- command: node tools/reindex.mjs
- success: Queue depth below 20
