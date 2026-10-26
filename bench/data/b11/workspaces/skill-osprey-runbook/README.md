# Osprey service runbook

- service: Notifier
- symptom: Delivery lag above 8 minutes
- command: node tools/replay.mjs
- success: Lag below 30 seconds
