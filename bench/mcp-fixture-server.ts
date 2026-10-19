/** B7 fixture MCP server over stdio: `node --import tsx bench/mcp-fixture-server.ts <server name>`. No network, fixed replies. */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MAX_SERVERS, serverInstructions, serverSpecs, serverTools } from './mcp-fixtures.js';

const spec = serverSpecs(MAX_SERVERS).find((s) => s.name === process.argv[2]);
if (!spec) {
  console.error(`unknown fixture server: ${process.argv[2]}`);
  process.exit(2);
}
const tools = serverTools(spec);
const server = new Server({ name: spec.name, version: '0.0.1' }, { capabilities: { tools: {} }, instructions: serverInstructions(spec) });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => tools.some((t) => t.name === params.name)
  ? { content: [{ type: 'text', text: `fixture ${spec.name}.${params.name}: ok` }] }
  : { content: [{ type: 'text', text: `unknown tool ${params.name}` }], isError: true });
await server.connect(new StdioServerTransport());
