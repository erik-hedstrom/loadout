import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Docs } from './docs.js';

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};

async function resultOf(operation: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const data = await operation();
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
}

export function createServer(docs: Docs): McpServer {
  const server = new McpServer({ name: 'internal-docs-mcp-server', version: '1.0.0' });
  server.registerTool('search_docs', {
    title: 'Search internal Markdown docs',
    description: 'Search all visible .md pages, refreshed on every call. All whitespace-separated literal terms must match (case-insensitive). Ranked by title matches then capped body frequency. Returns relative path, title, short snippet and score. Use a returned path with get_page.',
    inputSchema: z.object({
      query: z.string().describe('Nonempty search terms, e.g. production rollback. No regex or query operators.'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum results, 1–100; default 10.')
    }).strict(),
    outputSchema: z.object({ results: z.array(z.object({
      path: z.string(), title: z.string(), snippet: z.string(), score: z.number()
    })) }),
    annotations
  }, ({ query, limit }) => resultOf(async () => ({ results: await docs.search(query, limit) })));

  server.registerTool('get_page', {
    title: 'Retrieve a Markdown page',
    description: 'Read the full current Markdown content and title of one page inside the configured docs root. Hidden paths, node_modules, dot segments and symlinks are excluded. Returns path, title and unmodified content.',
    inputSchema: z.object({ path: z.string().min(1).describe('Relative .md path from search_docs, e.g. operations/rollback.md.') }).strict(),
    outputSchema: z.object({ path: z.string(), title: z.string(), content: z.string() }),
    annotations
  }, ({ path }) => resultOf(async () => ({ ...await docs.getPage(path) })));
  return server;
}
