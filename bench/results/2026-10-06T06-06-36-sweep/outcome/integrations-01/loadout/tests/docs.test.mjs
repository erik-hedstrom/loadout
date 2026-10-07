import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, unlink, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Docs } from '../dist/docs.js';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'docs-mcp-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'docs');
  await mkdir(root);
  const put = async (path, text) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), text);
  };
  return { base, root, put, docs: await Docs.open(root) };
}

test('ranks title matches above body matches, returns match snippets and respects limit', async (t) => {
  const { docs, put } = await fixture(t);
  await put('body.md', '# Operations\n' + 'context '.repeat(80) + 'rotate tokens tokens tokens');
  await put('title.md', '# Tokens\nRotate credentials every 90 days.');
  const results = await docs.search('TOKENS');
  assert.deepEqual(results.map(r => r.path), ['title.md', 'body.md']);
  assert.equal(results[0].title, 'Tokens');
  assert.match(results[1].snippet, /tokens/);
  assert.ok(results[1].snippet.length <= 242);
  assert.equal((await docs.search('tokens', 1)).length, 1);
  assert.deepEqual((await docs.search('rotate tokens')).map(r => r.path), ['title.md', 'body.md']);
  assert.deepEqual(await docs.search('tokens nonexistent'), []);
});

test('retrieves exact Markdown with YAML title, headings and filename fallback', async (t) => {
  const { docs, put } = await fixture(t);
  const markdown = '---\ntitle: "Deploy: production"\nowner: Platform\n---\n# Old heading\nDeploy carefully.\n';
  await put('deploy.md', markdown);
  assert.deepEqual(await docs.getPage('deploy.md'), { path: 'deploy.md', title: 'Deploy: production', content: markdown });
  await put('heading.md', '```md\n# Not a title\n```\n## First heading ##\n');
  assert.equal((await docs.getPage('heading.md')).title, 'First heading');
  await put('plain.md', 'No heading here.');
  assert.equal((await docs.getPage('plain.md')).title, 'plain');
  await put('setext.md', 'Setext title\n============\nBody');
  assert.equal((await docs.getPage('setext.md')).title, 'Setext title');
});

test('title ranking remains stronger than body repetition for long queries', async (t) => {
  const { docs, put } = await fixture(t);
  await put('body.md', '# Body\n' + 'alpha beta gamma delta epsilon zeta '.repeat(20));
  await put('title.md', '# Alpha\nbeta gamma delta epsilon zeta');
  assert.deepEqual((await docs.search('alpha beta gamma delta epsilon zeta')).map(r => r.path), ['title.md', 'body.md']);
});

test('reflects added, changed and deleted files without restarting', async (t) => {
  const { docs, put, root } = await fixture(t);
  assert.deepEqual(await docs.search('release'), []);
  await put('release.md', '# Release\nRelease on Tuesday.');
  assert.equal((await docs.search('release')).length, 1);
  await put('release.md', '# Updated\nShip on Wednesday.');
  assert.deepEqual(await docs.search('release'), []);
  assert.match((await docs.getPage('release.md')).content, /Wednesday/);
  await unlink(join(root, 'release.md'));
  assert.deepEqual(await docs.search('Wednesday'), []);
  await assert.rejects(docs.getPage('release.md'), /Page not found/);
});

test('ignores hidden entries, node_modules and symlink escapes in both tools', async (t) => {
  const { docs, put, root, base } = await fixture(t);
  await put('public.md', '# Public\nsecretword');
  await put('.hidden/page.md', 'secretword');
  await put('.hidden.md', 'secretword');
  await put('node_modules/lib/page.md', 'secretword');
  await writeFile(join(base, 'outside.md'), 'secretword');
  await symlink(join(base, 'outside.md'), join(root, 'linked.md'));
  await symlink(base, join(root, 'linked-dir'));
  assert.deepEqual((await docs.search('secretword')).map(r => r.path), ['public.md']);
  for (const path of ['../outside.md', 'sub/../../outside.md', '/etc/passwd.md', 'C:\\docs\\page.md', 'page.txt', '.hidden/page.md', '.hidden.md', 'node_modules/lib/page.md', 'linked.md', 'linked-dir/outside.md', 'public.md/../public.md', 'bad\0.md']) {
    await assert.rejects(docs.getPage(path), /Invalid page path|Symbolic links/);
  }
});

test('reports invalid queries, limits, roots and missing pages clearly', async (t) => {
  const { docs, root } = await fixture(t);
  await assert.rejects(docs.search(' \n\t '), /Query must not be empty/);
  for (const limit of [0, -1, 1.5, 101, NaN]) {
    await assert.rejects(docs.search('test', limit), /Limit must be an integer/);
  }
  await assert.rejects(docs.getPage('missing.md'), /Page not found/);
  await assert.rejects(Docs.open(join(root, 'missing')), /Docs root/);
  await assert.rejects(Docs.open(''), /Docs root/);
});
