import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { fakeClient } from '../bench/hook-latency.js';
import { envSecrets, persistJson } from '../bench/redact.js';

const secret = 'FAKE-opaque-benchmark-key';
const argv = process.argv;
let root: string;
afterEach(() => {
  process.argv = argv;
  vi.unstubAllEnvs(); vi.restoreAllMocks();
  for (const module of ['../bench/lib.js', '../src/jev.js', '../src/route.js', '../src/hook.js', 'node:fs', 'node:child_process', '../bench/b11-sandbox.js', '../bench/b11-library.js', '../bench/b11-mcp.js', 'node:crypto']) vi.doUnmock(module);
  if (root) rmSync(root, { recursive: true, force: true });
});

it.each(['TypeSafe', 'fixture transport', 'session transport'])('redacts B11 public rows, protocol metadata and console (%s)', async (source) => {
  const fixtureToken = Buffer.from('FAKEfixture-token').toString('hex');
  const sessionToken = Buffer.from('FAKEsession-token').toString('hex');
  const credential = source === 'TypeSafe' ? secret : source === 'fixture transport' ? fixtureToken : sessionToken;
  let randomCalls = 0;
  vi.doMock('node:crypto', async (original) => ({ ...await original<typeof import('node:crypto')>(),
    randomBytes: () => Buffer.from(randomCalls++ === 0 ? 'FAKEfixture-token' : 'FAKEsession-token'),
  }));
  root = mkdtempSync(join(tmpdir(), 'loadout-b11-sink-'));
  vi.stubEnv('LOADOUT_HOME', root); vi.stubEnv('TYPESAFE_API_KEY', secret);
  mkdirSync(join(root, 'workspaces', 'plain'), { recursive: true });
  const binary = join(root, 'fake-opencode'); writeFileSync(binary, '');
  const tasks = join(root, 'tasks.jsonl'), out = join(root, 'out');
  writeFileSync(tasks, JSON.stringify({ id: credential, kind: 'plain', prompt: 'fake', workspace: 'plain', check: { type: 'files', path: 'answer', all: [], none: [] }, needs: {} }));
  vi.doMock('../bench/b11-library.js', () => ({ prepareB11Library: () => ({ skills: [], plantedNames: new Set(), provenance: { fixture: secret } }) }));
  vi.doMock('../bench/b11-mcp.js', async (original) => ({ ...await original<typeof import('../bench/b11-mcp.js')>(), endpoint: async () => ({ url: 'http://127.0.0.1:1', close: async () => {} }) }));
  vi.doMock('../bench/b11-sandbox.js', async (original) => ({
    ...await original<typeof import('../bench/b11-sandbox.js')>(), sandboxCheck: async () => {}, requireNetwork: () => {},
    copyTree: () => {}, removeSession: () => {},
    executeSandbox: async (_sandbox: unknown, args: string[]) => ({
      stdout: args.includes('--version') ? '1.19.3' : '{"type":"error","error":{"name":"APIError","message":"fake provider error"}}\n',
      stderr: '', code: args.includes('--version') ? 0 : 1, timedOut: false, clock: { snapshot: () => ({ startupMs: null, stepsMs: [] }) },
    }),
  }));
  vi.resetModules();
  const { main } = await import('../bench/b11.js');
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    await main(['--run', '--tasks', tasks, '--opencode', binary, '--library', root, '--models', 'opencode/glm-5.3-flash-free', '--arms', source === 'TypeSafe' ? 'bare' : 'gateway', '--reps', '1', '--out', out]);
  } finally { Object.defineProperty(process, 'platform', platform); }
  for (const file of ['rows.jsonl', 'protocol.json']) {
    const saved = readFileSync(join(out, file), 'utf8');
    expect(saved).not.toContain(secret); expect(saved).toContain('<credential>');
  }
  expect(readFileSync(join(out, 'rows.jsonl'), 'utf8')).not.toContain(credential);
  expect(JSON.parse(readFileSync(join(out, 'rows.jsonl'), 'utf8')).taskId).toBe('<credential>');
  expect(log.mock.calls.flat().join('\n')).not.toContain(credential);
});

it('holds credential-named env values without reading TypeSafe outside its resolver', () => {
  const github = `ghp_${'FAKE'.repeat(6)}`;
  const env = { GITHUB_TOKEN: secret, aws_secret_access_key: 'FAKE-AWS', DB_PASSWORD: 'FAKE-password', ODD_ENV: github, GITHUB_PAT: 'FAKE-pat', EMPTY_TOKEN: '', PATH: 'ordinary' };
  Object.defineProperty(env, 'TYPESAFE_API_KEY', { enumerable: true, get() { throw new Error('must use resolveApiKey'); } });
  expect(JSON.parse(persistJson({ goal: `${secret} FAKE-AWS FAKE-password ${github} FAKE-pat ordinary` }, envSecrets(env))))
    .toEqual({ goal: '<credential> <credential> <credential> <credential> <credential> ordinary' });
});

it('redacts missing judge answer IDs at the diagnostic sink', async () => {
  root = mkdtempSync(join(tmpdir(), 'loadout-judge-diagnostic-'));
  vi.stubEnv('LOADOUT_HOME', root); vi.stubEnv('TYPESAFE_API_KEY', secret);
  writeFileSync(join(root, 'decisions.jsonl'), JSON.stringify({ id: secret, request: 'fake', loaded: [], offered: [], shortlist: [], ms: 0, costUsd: 0 }) + '\n');
  vi.doMock('../bench/lib.js', async (original) => ({ ...await original<typeof import('../bench/lib.js')>(),
    isEntry: () => false, modelJson: async () => ({ output: { results: [] }, costUsd: 0 }),
  }));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.resetModules();
  const { judgeSweep } = await import('../bench/judge.js');
  await judgeSweep([root]);
  expect(error.mock.calls.flat().join('\n')).not.toContain(secret);
  expect(error.mock.calls.flat().join('\n')).toContain('<credential>');
});

it.each(['sweep', 'route-bench', 'need-probe', 'mismatch-probe', 'outcome', 'judge', 'hook-latency'] as const)
('redacts public rows from %s with fake providers', async (script) => {
  root = mkdtempSync(join(tmpdir(), 'loadout-bench-sinks-'));
  vi.stubEnv('LOADOUT_HOME', root);
  vi.stubEnv('TYPESAFE_API_KEY', secret);
  writeFileSync(join(root, 'config.json'), JSON.stringify({ embeddings: false, jev: { model: secret } }));
  mkdirSync(join(root, 'library', 'skills', secret), { recursive: true });
  writeFileSync(join(root, 'library', 'skills', secret, 'SKILL.md'), `---\nname: ${secret}\ndescription: fake fixture\n---\n`);
  const capability = { id: `skill:${secret}`, kind: 'skill', name: secret, description: secret, source: join(root, 'library', 'skills', secret), repo: 'fake', stars: 0, rank: 1 };
  const task = { id: 'fixture', task: secret, repo: { name: 'fake', files: [], dependencies: [], languages: {} }, gold: [secret], scope: 'general' };
  const raw = { shortlist: [secret], wide: { pick: { [secret]: 1 } }, close: { pick: { [secret]: 1 }, fit: { [secret]: { '3': 1 } } } };
  const row = { id: 'fixture', task: 'fixture', category: 'fake', request: secret, tier: 'medium', arm: 'loadout', size: 20000,
    loaded: [{ key: secret, fit: 1 }], offered: [], raw, shortlist: [], costUsd: 0, ms: 1 };
  if (script === 'outcome') row.id = secret;
  const decision = { tier: 'medium', selected: [{ capability, p: 1 }], suggested: [], scored: [], router: 'jev', stats: { ms: 1, librarySize: 1, candidates: 1 }, warning: secret };
  if (script === 'judge') {
    row.loaded = [{ key: 'safe', fit: 1 }];
    mkdirSync(join(root, 'library', 'skills', 'safe'));
    writeFileSync(join(root, 'library', 'skills', 'safe', 'SKILL.md'), '---\nname: safe\ndescription: fixture\n---\n');
  }
  const jsonl = (file: string, value: unknown) => writeFileSync(join(root, file), JSON.stringify(value) + '\n');
  jsonl('decisions.jsonl', row); jsonl('rows.jsonl', row); jsonl('requests.jsonl', { id: 'fixture', category: 'fake', request: secret });
  jsonl('judge-blind.jsonl', { id: 'fixture', need: 'none', useful: [], note: secret });
  jsonl('judge-verdicts.jsonl', { id: 'fixture', loaded: [{ key: secret, rating: 'misleading' }], missed_better: null, note: secret });
  vi.doMock('../src/route.js', async (original) => ({ ...await original<typeof import('../src/route.js')>(), route: async () => decision }));
  vi.doMock('../src/jev.js', async (original) => ({ ...await original<typeof import('../src/jev.js')>(), jevClient: () => fakeClient() }));
  if (script === 'hook-latency') {
    vi.doMock('node:fs', async (original) => {
      const fs = await original<typeof import('node:fs')>();
      return { ...fs, existsSync: (file: string) => file.endsWith(join('dist', 'cli.js')) || fs.existsSync(file) };
    });
    vi.doMock('node:child_process', async (original) => ({ ...await original<typeof import('node:child_process')>(),
      spawnSync: () => ({ status: 0, stdout: '', stderr: '' }),
    }));
    vi.doMock('../src/hook.js', async (original) => ({ ...await original<typeof import('../src/hook.js')>(),
      promptContext: async (_input: unknown, deps: { client: import('../src/jev.js').SystemOneClient }) => {
        await deps.client.ask({}, {}); await deps.client.ask({}, {});
      },
    }));
  }
  vi.doMock('../bench/lib.js', async (original) => {
    const lib = await original<typeof import('../bench/lib.js')>();
    return { ...lib, RESULTS: root, loadCorpus: () => [capability], loadTasks: () => [task],
      isEntry: (url: string) => url.endsWith(`/${script}.ts`),
      splitOf: script === 'hook-latency' ? () => 'dev' : lib.splitOf,
      readJsonl: (file: string) => file.endsWith('popular.jsonl') ? [{ name: secret }]
        : script === 'hook-latency' && file.endsWith('requests.jsonl') ? [{ id: secret, request: 'fake' }] : lib.readJsonl(file),
      modelJson: async () => ({ output: { results: [{ id: 'fixture', need: 'none', useful: [], note: secret, loaded: [{ key: 'safe', rating: 'misleading' }], missed_better: null }] }, costUsd: 0 }),
      claudeJson: async () => ({ output: { winner: 'first', confidence: 'high', reasons: secret }, costUsd: 0 }),
      run: async (_bin: string, _args: string[], cwd: string) => {
        writeFileSync(join(cwd, 'answer.md'), 'fake answer');
        return { stdout: '', stderr: '', code: 0, timedOut: false };
      },
    };
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const args: Record<typeof script, string[]> = {
    sweep: ['--requests', join(root, 'requests.jsonl')], 'route-bench': ['--sizes', '1', '--arms', 'popular'],
    'need-probe': [root], 'mismatch-probe': [root], outcome: [root, '--ids', secret], judge: [root, '--model', secret], 'hook-latency': ['--limit', '1'],
  };
  if (script === 'outcome') {
    // The process boundary is faked; launch still builds the real session and argv.
    const bin = join(root, process.platform === 'win32' ? 'codex.exe' : 'codex');
    writeFileSync(bin, '', { mode: 0o755 }); vi.stubEnv('PATH', root);
  }
  if (script === 'judge') {
    // Force both judging phases rather than resuming the fake input verdicts.
    rmSync(join(root, 'judge-blind.jsonl')); rmSync(join(root, 'judge-verdicts.jsonl'));
  }
  process.argv = [process.execPath, `bench/${script}.ts`, ...args[script]];
  vi.resetModules();
  await ({ sweep: () => import('../bench/sweep.js'), 'route-bench': () => import('../bench/route-bench.js'),
    'need-probe': () => import('../bench/need-probe.js'), 'mismatch-probe': () => import('../bench/mismatch-probe.js'),
    outcome: () => import('../bench/outcome.js'), judge: () => import('../bench/judge.js'), 'hook-latency': () => import('../bench/hook-latency.js') })[script]();
  const files = readdirSync(root, { recursive: true }).map(String);
  const generated = files.filter((file) => script === 'sweep' ? file.endsWith('-sweep/decisions.jsonl') || file.endsWith('-sweep\\decisions.jsonl')
    : script === 'route-bench' ? file.includes('-popular') && (file.endsWith('rows.jsonl') || file.endsWith('config.json'))
    : script === 'need-probe' ? file.endsWith('answers.jsonl')
    : script === 'mismatch-probe' ? file.startsWith('mismatch-probe.')
    : script === 'outcome' ? file.startsWith('outcome') && (file.endsWith('.jsonl') || file.endsWith('loadout.json'))
    : script === 'hook-latency' ? file.endsWith('latency.json')
    : ['judge-blind.jsonl', 'judge-verdicts.jsonl', 'report.md'].includes(file));
  expect(generated.length).toBeGreaterThan(0);
  for (const file of generated) {
    const saved = readFileSync(join(root, file), 'utf8');
    expect(saved, file).not.toContain(secret);
    expect(saved, file).toContain('<credential>');
  }
  expect(vi.mocked(console.log).mock.calls.flat().join('\n')).not.toContain(secret);
  expect(vi.mocked(console.error).mock.calls.flat().join('\n')).not.toContain(secret);
});
