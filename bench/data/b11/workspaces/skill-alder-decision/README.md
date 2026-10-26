# Alder architecture decision

- title: Use bounded queues
- context: Workers can outpace delivery
- choice: Cap each queue at 200 entries
- cost: Producers may wait
