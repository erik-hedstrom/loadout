// Writes one gateway server's tool entry over and over, as another loadout process would (see the concurrency test).
import { rememberTools } from '../../src/toolindex.js';
import type { Capability } from '../../src/types.js';

const [dir, mine, rounds, startAt] = process.argv.slice(2) as [string, string, string, string];
const server = (name: string): Capability => ({ id: `mcp:${name}`, kind: 'mcp', name, description: '', source: '', gateway: true, server: { command: name } });
const gateway = ['a', 'b'].map(server);
// Both processes start together, so their writes overlap.
while (Date.now() < Number(startAt));
for (let i = 0; i < Number(rounds); i++) rememberTools(dir, server(mine), gateway, [{ name: `tool_${i}`, description: mine }]);
