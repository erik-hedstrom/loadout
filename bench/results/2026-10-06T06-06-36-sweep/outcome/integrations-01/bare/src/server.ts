import { parseArgs } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DocsStore } from './docs.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'docs-root': { type: 'string' } }, strict: true });
  const root = values['docs-root'] ?? process.env.DOCS_ROOT;
  if (!root?.trim()) throw new Error('Set DOCS_ROOT or pass --docs-root /absolute/path/to/docs');
  const docs = await DocsStore.create(root);
  const server = new McpServer({ name: 'internal-docs', version: '1.0.0' });
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  async function result(operation: () => Promise<unknown>) {
    try {
      return { content: [{ type: 'text' as const, text: JSON.stringify(await operation(), null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const,
        text: error instanceof Error ? error.message : 'Unexpected docs operation failure' }] };
    }
  }

  server.registerTool('search_docs', {
    description: 'Search Markdown docs. All whitespace-separated terms must match; title matches rank higher. Results include path, title, snippet, and score.',
    inputSchema: { query: z.string(), limit: z.number().int().min(1).max(100).optional() },
    annotations
  }, ({ query, limit }) => result(() => docs.search(query, limit)));

  server.registerTool('get_page', {
    description: 'Read a complete Markdown page by its relative path returned from search_docs.',
    inputSchema: { path: z.string() },
    annotations
  }, ({ path }) => result(() => docs.getPage(path)));

  await server.connect(new StdioServerTransport());
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
