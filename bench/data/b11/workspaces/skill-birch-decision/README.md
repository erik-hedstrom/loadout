# Birch architecture decision

- title: Keep immutable snapshots
- context: Readers share cached objects
- choice: Freeze snapshots before publication
- cost: Copy on update
