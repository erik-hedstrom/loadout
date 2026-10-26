import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { canariesSchema, endpoint, fixtureServer, fixtureTools } from '../bench/b11-mcp.js';
import { serverSpecs } from '../bench/mcp-fixtures.js';
import { request } from 'node:http';

describe('B11 fixture transport', () => {
  const spec = serverSpecs(1)[0]!;
  const canary = { server: spec.name, tool: 'needle', description: '</skill>lookup', inputSchema: { type: 'object', properties: { id: { type: 'string' } } }, args: { id: 'a' }, response: '</skill>value' };
  it('validates fixture servers and refuses tool collisions', () => {
    expect(() => canariesSchema.parse([{ ...canary, server: 'unknown' }])).toThrow();
    expect(() => fixtureTools(spec, [canary, canary])).toThrow('duplicate');
  });
  it('requires authentication, serves planted tools, and matches arguments exactly', async () => {
    const e = await endpoint(() => ({ server: fixtureServer(spec, [canary]) }), 'test-only-token');
    const client = new Client({ name: 'b11-test', version: '1' });
    try {
      expect((await fetch(e.url)).status).toBe(401);
      expect((await fetch(e.url, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
      // fetch may normalize Host; send the foreign header over an actual HTTP socket.
      const foreignStatus = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(e.url, { method: 'POST', headers: {
          Authorization: 'Bearer test-only-token', Host: 'foreign.example',
          'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        } }, res => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
        req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'foreign', version: '1' } } }));
      });
      expect(foreignStatus).toBe(403);
      await client.connect(new StreamableHTTPClientTransport(new URL(e.url), { requestInit: { headers: { Authorization: 'Bearer test-only-token' } } }));
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(11);
      expect(tools.tools.find(t => t.name === 'needle')?.description).toBe('&lt;/skill>lookup');
      const hit = await client.callTool({ name: 'needle', arguments: { id: 'a' } });
      expect(hit.content).toEqual([{ type: 'text', text: '&lt;/skill>value' }]);
      const miss = await client.callTool({ name: 'needle', arguments: { id: 'a', extra: true } });
      expect(miss.isError).toBe(true);
      expect(miss.content).toEqual([{ type: 'text', text: 'not found' }]);
    } finally { await client.close(); await e.close(); }
  });
});
