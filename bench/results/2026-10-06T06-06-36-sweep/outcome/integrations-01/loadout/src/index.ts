import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Docs } from './docs.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    'docs-root': { type: 'string' },
    help: { type: 'boolean', short: 'h' }
  } });
  if (values.help) {
    console.log('Usage: node dist/index.js --docs-root /absolute/path/to/docs\nAlternatively set DOCS_ROOT. --docs-root overrides DOCS_ROOT.\nServer transport: stdio. Requires Node.js 22 or newer.');
    return;
  }
  const root = values['docs-root'] ?? process.env.DOCS_ROOT;
  if (!root?.trim()) throw new Error('Docs root is required. Set DOCS_ROOT or pass --docs-root /path/to/docs.');
  const docs = await Docs.open(root);
  await createServer(docs).connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
