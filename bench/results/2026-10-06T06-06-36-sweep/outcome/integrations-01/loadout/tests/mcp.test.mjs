import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../dist/server.js';
import { Docs } from '../dist/docs.js';

test('SDK client discovers tools and receives structured search, retrieval and clear errors', async (t) => {
  const server = createServer(await Docs.open(resolve('sample-docs')));
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['get_page', 'search_docs']);
  assert.ok(tools.every(tool => tool.outputSchema && tool.annotations.readOnlyHint));
  const search = await client.callTool({ name: 'search_docs', arguments: { query: 'rollback', limit: 1 } });
  assert.equal(search.structuredContent.results.length, 1);
  assert.equal(search.structuredContent.results[0].path, 'operations/rollback.md');
  const page = await client.callTool({ name: 'get_page', arguments: { path: 'operations/rollback.md' } });
  assert.equal(page.structuredContent.title, 'Production rollback');
  assert.match(page.structuredContent.content, /previous image digest/);
  for (const [name, args, expected] of [
    ['search_docs', { query: '\t ' }, /empty/],
    ['search_docs', { query: 'rollback', limit: 0 }, /1/],
    ['search_docs', { query: 'rollback', unexpected: true }, /unrecognized|Unrecognized/],
    ['get_page', { path: '../README.md' }, /Invalid page path/],
    ['get_page', { path: 'missing.md' }, /Page not found/]
  ]) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, expected);
  }
  const noMatches = await client.callTool({ name: 'search_docs', arguments: { query: 'no-such-word-9182' } });
  assert.deepEqual(noMatches.structuredContent.results, []);
});
