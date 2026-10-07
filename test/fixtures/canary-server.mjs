// A tiny MCP server for gateway tests: one tool that returns a fixed memo.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'canary', version: '0.0.1' });
server.registerTool(
  'ledger_memo',
  { description: 'The memo of a ZX Ledger entry', inputSchema: { entry: z.number().int() } },
  async ({ entry }) => ({ content: [{ type: 'text', text: `entry ${entry}: LOADOUT-MCP-CANARY-5521` }] }),
);
server.registerTool('crash', { description: 'Exit, to test reconnection', inputSchema: {} }, async () => {
  setTimeout(() => process.exit(0), 10);
  return { content: [{ type: 'text', text: 'bye' }] };
});
await server.connect(new StdioServerTransport());
