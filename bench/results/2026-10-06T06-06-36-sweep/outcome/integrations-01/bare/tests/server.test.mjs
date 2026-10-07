import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Explicit opt-in for restricted runners; tests run normally on developer machines.
const skip = process.env.DOCS_TEST_NO_SPAWN === '1' ? 'Runner blocks Node child processes; run python3 tests/smoke.py' : false;

for (const configuration of ['cli', 'env']) {
  test(`stdio MCP search, retrieval, and errors (${configuration} config)`, { timeout: 15000, skip }, async t => {
    const root = resolve('sample-docs');
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/server.js'), ...(configuration === 'cli' ? ['--docs-root', root] : [])],
      env: configuration === 'env' ? { DOCS_ROOT: root } : {},
      stderr: 'pipe'
    });
    const client = new Client({ name: 'docs-integration-test', version: '1.0.0' });
    t.after(() => client.close());
    let stderr = '';
    transport.stderr.on('data', data => { stderr += data; });
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ['get_page', 'search_docs']);
    const result = await client.callTool({ name: 'search_docs', arguments: { query: 'deployment', limit: 1 } });
    assert.ok(!result.isError);
    const hits = JSON.parse(result.content[0].text);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].path, 'runbooks/deployment.md');
    assert.equal(hits[0].title, 'Production deployment');
    assert.match(hits[0].snippet, /deployment/i);
    const page = await client.callTool({ name: 'get_page', arguments: { path: hits[0].path } });
    assert.ok(!page.isError);
    assert.match(JSON.parse(page.content[0].text).content, /roll back to the previous artifact/);
    for (const [name, args, pattern] of [
      ['search_docs', { query: ' ' }, /Query must not be empty/],
      ['get_page', { path: 'missing.md' }, /Page not found/],
      ['get_page', { path: '../README.md' }, /Invalid page path/]
    ]) {
      const failure = await client.callTool({ name, arguments: args });
      assert.equal(failure.isError, true);
      assert.match(failure.content[0].text, pattern);
    }
    assert.equal(stderr, '');
  });
}

test('fails startup clearly when docs root is unconfigured or missing', { skip }, () => {
  for (const args of [[], ['--docs-root', resolve('nonexistent-docs')]]) {
    const result = spawnSync(process.execPath, ['dist/server.js', ...args], {
      env: {}, encoding: 'utf8', timeout: 5000
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Set DOCS_ROOT|Docs root must/);
  }
});
