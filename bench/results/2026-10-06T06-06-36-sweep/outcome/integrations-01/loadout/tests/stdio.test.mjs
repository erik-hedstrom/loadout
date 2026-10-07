import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const executable = resolve('dist/index.js');
const docsRoot = resolve('sample-docs');
const probe = spawnSync(process.execPath, ['--version'], { encoding: 'utf8' });
const spawnBlocked = probe.error?.code === 'EPERM';

for (const mode of ['CLI', 'environment']) {
  test(`MCP handshake, discovery, search, retrieval and errors over stdio (${mode})`, { timeout: 15000, skip: spawnBlocked && 'Sandbox blocks Node child processes (EPERM); use scripts/check-stdio.sh.' }, async (t) => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [executable, ...(mode === 'CLI' ? ['--docs-root', docsRoot] : [])],
      env: { DOCS_ROOT: mode === 'CLI' ? '/nonexistent/cli-must-override' : docsRoot },
      cwd: '/tmp',
      stderr: 'pipe'
    });
    let diagnostics = '';
    transport.stderr.on('data', chunk => { diagnostics += chunk.toString(); });
    const client = new Client({ name: 'docs-integration-test', version: '1.0.0' });
    t.after(() => client.close());
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['get_page', 'search_docs']);
    assert.ok(tools.every(tool => tool.outputSchema && tool.annotations.readOnlyHint));
    const search = await client.callTool({ name: 'search_docs', arguments: { query: 'rollback', limit: 1 } });
    assert.equal(search.isError, undefined);
    assert.equal(search.structuredContent.results.length, 1);
    assert.equal(search.structuredContent.results[0].path, 'operations/rollback.md');
    assert.match(search.structuredContent.results[0].snippet, /rollback/i);
    const page = await client.callTool({ name: 'get_page', arguments: { path: search.structuredContent.results[0].path } });
    assert.equal(page.structuredContent.title, 'Production rollback');
    assert.match(page.structuredContent.content, /previous image digest/);
    for (const [name, args, message] of [
      ['search_docs', { query: '  ' }, /empty/],
      ['search_docs', { query: 'rollback', limit: 0 }, /1/],
      ['get_page', { path: '../README.md' }, /Invalid page path/],
      ['get_page', { path: 'missing.md' }, /Page not found/]
    ]) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, message);
    }
    const none = await client.callTool({ name: 'search_docs', arguments: { query: 'no-such-word-9182' } });
    assert.deepEqual(none.structuredContent.results, []);
    assert.equal(diagnostics, '');
  });
}

test('startup reports missing configuration, bad roots and unknown arguments on stderr', { skip: spawnBlocked && 'Sandbox blocks Node child processes (EPERM); use scripts/check-stdio.sh.' }, () => {
  for (const args of [[], ['--docs-root', '/missing-docs-root'], ['--bogus']]) {
    const result = spawnSync(process.execPath, [executable, ...args], {
      env: { ...process.env, DOCS_ROOT: '' }, encoding: 'utf8'
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Error:/);
  }
  const help = spawnSync(process.execPath, [executable, '--help'], { encoding: 'utf8' });
  assert.ifError(help.error);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /DOCS_ROOT/);
});
