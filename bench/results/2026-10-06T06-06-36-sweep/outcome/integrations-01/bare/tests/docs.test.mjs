import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocsStore } from '../dist/docs.js';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'internal-docs-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'docs');
  await mkdir(root);
  await writeFile(join(root, 'deploy.md'), '---\ntitle: "Deploy: production"\n---\n# Release\nDeploy the service after approval.\n');
  await writeFile(join(root, 'guide.md'), '# Operations\n' + 'Background information. '.repeat(40) + 'Deploy the service with a rollback plan.\n');
  await writeFile(join(base, 'secret.md'), '# Secret\nDeploy credentials');
  return { base, root, store: await DocsStore.create(root) };
}

test('ranks title matches, limits results, and centers snippets on matches', async t => {
  const { store } = await fixture(t);
  const hits = await store.search('deploy');
  assert.deepEqual(hits.map(hit => hit.path), ['deploy.md', 'guide.md']);
  assert.equal(hits[0].title, 'Deploy: production');
  assert.match(hits[1].snippet, /Deploy the service/);
  assert.ok(hits[1].snippet.length <= 243);
  assert.equal((await store.search('deploy service', 1)).length, 1);
  assert.deepEqual(await store.search('nonexistent'), []);
});

test('returns complete Markdown and sees changed, added, and removed files', async t => {
  const { store, root } = await fixture(t);
  assert.deepEqual(await store.getPage('deploy.md'), {
    path: 'deploy.md', title: 'Deploy: production',
    content: '---\ntitle: "Deploy: production"\n---\n# Release\nDeploy the service after approval.\n'
  });
  await writeFile(join(root, 'guide.md'), '# Updated\nRotate certificates.\n');
  assert.equal((await store.search('certificates'))[0].title, 'Updated');
  assert.equal((await store.getPage('guide.md')).title, 'Updated');
  await writeFile(join(root, 'new.md'), 'No heading; certificates here.');
  assert.equal((await store.search('certificates')).length, 2);
  assert.equal((await store.getPage('new.md')).title, 'new');
  await rm(join(root, 'new.md'));
  assert.equal((await store.search('certificates')).length, 1);
  await assert.rejects(store.getPage('new.md'), /Page not found/);
});

test('rejects traversal, absolute paths, non-Markdown, ignored paths, and symlinks', async t => {
  const { store, root, base } = await fixture(t);
  for (const folder of ['.hidden', 'node_modules', 'nested/.private']) {
    await mkdir(join(root, folder), { recursive: true });
    await writeFile(join(root, folder, 'ignored.md'), '# Ignored\nDeploy');
    await assert.rejects(store.getPage(`${folder}/ignored.md`), /Invalid page path/);
  }
  await symlink(join(base, 'secret.md'), join(root, 'linked.md'));
  await symlink(base, join(root, 'linked-dir'));
  for (const path of ['../secret.md', join(base, 'secret.md'), 'guide.txt', 'a/../guide.md', '..\\secret.md', 'linked.md', 'linked-dir/secret.md', '']) {
    await assert.rejects(store.getPage(path), /Invalid page path/);
  }
  assert.equal((await store.search('deploy')).length, 2);
  await assert.rejects(store.getPage('missing.md'), /Page not found/);
});

test('validates query and limit; permits an empty corpus', async t => {
  const { store, root, base } = await fixture(t);
  await assert.rejects(store.search('  '), /Query must not be empty/);
  for (const limit of [0, -1, 1.5, 101, NaN]) {
    await assert.rejects(store.search('deploy', limit), /Limit must/);
  }
  await mkdir(join(base, 'empty'));
  assert.deepEqual(await (await DocsStore.create(join(base, 'empty'))).search('anything'), []);
  await assert.rejects(DocsStore.create(join(root, 'missing')), /Docs root/);
});

test('preserves literal hashes in headings and trims Markdown closing markers', async t => {
  const { store, root } = await fixture(t);
  await writeFile(join(root, 'language.md'), '# C#\nLanguage guide.');
  await writeFile(join(root, 'closing.md'), '# Title ###\nBody.');
  assert.equal((await store.getPage('language.md')).title, 'C#');
  assert.equal((await store.getPage('closing.md')).title, 'Title');
});
