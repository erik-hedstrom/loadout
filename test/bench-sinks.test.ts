import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { fakeClient } from '../bench/hook-latency.js';
import { envSecrets, persistJson } from '../bench/redact.js';

const secret = 'FAKE-opaque-benchmark-key';
const argv = process.argv;
let root: string;
function unexpectedWriter(fakeCli = false, only?: string, credential = secret) {
  vi.doMock('node:fs', async (original) => {
    const fs = await original<typeof import('node:fs')>();
    const contaminate = (file: unknown, data: unknown) => {
      const chosen = !only || (only === 'frontier' ? String(data).includes('"arm":"frontier"') : String(file).endsWith(only));
      if (chosen && /(?:rows|answers|decisions|judge-blind|judge-verdicts|mismatch-probe|verdicts)\.jsonl$|(?:latency|bare|loadout|protocol)\.json$/.test(String(file))) {
        fs.writeFileSync(join(dirname(String(file)), 'unknown-writer.txt'), credential.replaceAll('-', '%2d'));
      }
    };
    return { ...fs,
      existsSync: (file: Parameters<typeof fs.existsSync>[0]) => fakeCli && String(file).endsWith(join('dist', 'cli.js')) || fs.existsSync(file),
      appendFileSync: (...args: Parameters<typeof fs.appendFileSync>) => { fs.appendFileSync(...args); if (String(args[1]).length) contaminate(args[0], args[1]); },
      writeFileSync: (...args: Parameters<typeof fs.writeFileSync>) => { fs.writeFileSync(...args); contaminate(args[0], args[1]); },
    };
  });
}
afterEach(() => {
  process.argv = argv;
  vi.unstubAllEnvs(); vi.restoreAllMocks();
  for (const module of ['../bench/lib.js', '../src/launch.js', '../src/jev.js', '../src/route.js', '../src/hook.js', 'node:fs', 'node:child_process', '../bench/b11-sandbox.js', '../bench/b11-library.js', '../bench/b11-mcp.js', 'node:crypto']) vi.doUnmock(module);
  if (root) rmSync(root, { recursive: true, force: true });
});

it.each(['content', 'filename', 'final message', 'unanticipated artifact'])('outcome withholds %s credentials before copying or judging', async (where) => {
  root = mkdtempSync(join(tmpdir(), 'loadout-outcome-screen-'));
  vi.stubEnv('LOADOUT_HOME', root); vi.stubEnv('TYPESAFE_API_KEY', secret);
  const encoded = encodeURIComponent(secret).replaceAll('-', '%2d');
  writeFileSync(join(root, 'decisions.jsonl'), JSON.stringify({ id: 'fixture', request: 'fake', tier: 'medium', loaded: [], offered: [] }) + '\n');
  const judge = vi.fn(async () => { throw new Error('must not judge credential-bearing outputs'); });
  let calls = 0;
  vi.doMock('../src/launch.js', async (original) => ({ ...await original<typeof import('../src/launch.js')>(), which: () => 'fake-codex' }));
  vi.doMock('../bench/lib.js', async (original) => ({ ...await original<typeof import('../bench/lib.js')>(),
    claudeJson: judge, run: async (_bin: string, _args: string[], cwd: string) => {
      const tainted = calls++ === 0;
      writeFileSync(join(cwd, tainted && where === 'filename' ? encoded : 'answer.txt'), tainted && where === 'content' ? encoded : 'safe');
      if (tainted && where === 'unanticipated artifact') writeFileSync(join(root, 'outcome', 'unknown-writer.txt'), encoded);
      const stdout = tainted && where === 'final message' ? JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: encoded } }) : '';
      return { stdout, stderr: '', code: 0, timedOut: false };
    },
  }));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  process.argv = [process.execPath, 'bench/outcome.ts', root, '--ids', 'fixture'];
  vi.resetModules();
  if (where === 'unanticipated artifact') await expect(import('../bench/outcome.js')).rejects.toThrow(/UNUSABLE.*unknown-writer.txt/);
  else {
    await import('../bench/outcome.js');
    const metadata = JSON.parse(readFileSync(join(root, 'outcome', 'fixture', 'bare.json'), 'utf8'));
    expect(metadata.invalid).toBe('UNUSABLE: credential in output');
    expect(readdirSync(join(root, 'outcome', 'fixture'))).not.toContain('bare');
  }
  expect(judge).not.toHaveBeenCalled();
});

it.each(['TypeSafe', 'fixture transport', 'session transport', 'unknown writer', 'session transport unknown writer'])('redacts B11 public rows, protocol metadata and console (%s)', async (source) => {
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
  if (source.includes('unknown writer')) unexpectedWriter(false, undefined, source.startsWith('session transport') ? sessionToken : secret);
  vi.resetModules();
  const { main } = await import('../bench/b11.js');
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const execute = () => main(['--run', '--tasks', tasks, '--opencode', binary, '--library', root, '--models', 'opencode/glm-5.3-flash-free', '--arms', source === 'TypeSafe' ? 'bare' : 'gateway', '--reps', '1', '--out', out]);
    if (source.includes('unknown writer')) { await expect(execute()).rejects.toThrow(/UNUSABLE.*unknown-writer/); return; }
    await execute();
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
  const env = { GITHUB_TOKEN: secret, aws_secret_access_key: 'FAKE-AWS-opaque-secret', DB_PASSWORD: 'FAKE-password-opaque', ODD_ENV: github, GITHUB_PAT: 'FAKE-pat-opaque-value', EMPTY_TOKEN: '', PATH: 'ordinary' };
  Object.defineProperty(env, 'TYPESAFE_API_KEY', { enumerable: true, get() { throw new Error('must use resolveApiKey'); } });
  expect(JSON.parse(persistJson({ goal: `${secret} FAKE-AWS-opaque-secret FAKE-password-opaque ${github} FAKE-pat-opaque-value ordinary` }, envSecrets(env))))
    .toEqual({ goal: '<credential> <credential> <credential> <credential> <credential> ordinary' });
});

it('blocks credential-bearing judge inputs before asking the judge', async () => {
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
  await expect(judgeSweep([root])).rejects.toThrow(/UNUSABLE.*decisions.jsonl/);
  expect(error.mock.calls).toEqual([]);
});

it.each((['sweep', 'route-bench', 'need-probe', 'mismatch-probe', 'outcome', 'judge', 'hook-latency'] as const)
  .flatMap((script) => [{ script, unexpected: false, stage: 'normal' }, { script, unexpected: true, stage: 'normal' },
    ...(script === 'judge' ? ['late', 'pending-blind', 'pending-verdict'].map((stage) => ({ script, unexpected: true, stage }))
      : script === 'route-bench' || script === 'outcome' ? [{ script, unexpected: true, stage: 'late' }] : [])]))
('redacts and gates $script (unknown writer: $unexpected, stage: $stage)', async ({ script, unexpected, stage }) => {
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
  const model = vi.fn(async () => {
    if (script === 'judge' && (stage === 'pending-blind' || stage === 'pending-verdict') && model.mock.calls.length === (stage === 'pending-blind' ? 1 : 2)) {
      writeFileSync(join(root, 'unknown-writer.txt'), secret.replaceAll('-', '%2d'));
      return null;
    }
    return { output: { results: [{ id: 'fixture', need: 'none', useful: [], note: secret, loaded: [{ key: 'safe', rating: 'misleading' }], missed_better: null }] }, costUsd: 0 };
  });
  const judge = vi.fn(async () => ({ output: { skills: [], winner: 'first', confidence: 'high', reasons: secret }, costUsd: 0 }));
  vi.doMock('../bench/lib.js', async (original) => {
    const lib = await original<typeof import('../bench/lib.js')>();
    return { ...lib, RESULTS: root, loadCorpus: () => [capability], loadTasks: () => [task],
      isEntry: (url: string) => url.endsWith(`/${script}.ts`),
      splitOf: script === 'hook-latency' ? () => 'dev' : lib.splitOf,
      readJsonl: (file: string) => file.endsWith('popular.jsonl') ? [{ name: secret }]
        : script === 'hook-latency' && file.endsWith('requests.jsonl') ? [{ id: secret, request: 'fake' }] : lib.readJsonl(file),
      modelJson: model,
      claudeJson: judge,
      run: async (_bin: string, _args: string[], cwd: string) => {
        writeFileSync(join(cwd, 'answer.md'), 'fake answer');
        return { stdout: '', stderr: '', code: 0, timedOut: false };
      },
    };
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const args: Record<typeof script, string[]> = {
    sweep: ['--requests', join(root, 'requests.jsonl')], 'route-bench': ['--sizes', '1', '--arms', 'popular', ...(unexpected ? ['--frontier', '1'] : [])],
    'need-probe': [root], 'mismatch-probe': [root], outcome: [root, '--ids', 'fixture'], judge: [root, '--model', secret], 'hook-latency': ['--limit', '1'],
  };
  if (script === 'outcome') {
    // The process boundary is faked; launch still builds the real session and argv.
    const bin = join(root, process.platform === 'win32' ? 'codex.exe' : 'codex');
    writeFileSync(bin, '', { mode: 0o755 }); vi.stubEnv('PATH', root);
  }
  if (script === 'judge') {
    // Source inputs are clean; only the fake judge response and requested model carry a credential.
    rmSync(join(root, 'library', 'skills', secret), { recursive: true });
    for (const file of ['config.json', 'decisions.jsonl', 'requests.jsonl', 'rows.jsonl']) {
      writeFileSync(join(root, file), readFileSync(join(root, file), 'utf8').replaceAll(secret, 'safe'));
    }
    // Force both judging phases rather than resuming the fake input verdicts.
    rmSync(join(root, 'judge-blind.jsonl')); rmSync(join(root, 'judge-verdicts.jsonl'));
  }
  process.argv = [process.execPath, `bench/${script}.ts`, ...args[script]];
  if (unexpected && !stage.startsWith('pending')) unexpectedWriter(script === 'hook-latency', stage === 'late'
    ? script === 'route-bench' ? 'frontier' : script === 'outcome' ? 'verdicts.jsonl' : 'judge-verdicts.jsonl' : undefined);
  vi.resetModules();
  const execute = () => ({ sweep: () => import('../bench/sweep.js'), 'route-bench': () => import('../bench/route-bench.js'),
    'need-probe': () => import('../bench/need-probe.js'), 'mismatch-probe': () => import('../bench/mismatch-probe.js'),
    outcome: () => import('../bench/outcome.js'), judge: () => import('../bench/judge.js'), 'hook-latency': () => import('../bench/hook-latency.js') })[script]();
  if (unexpected) {
    await expect(execute()).rejects.toThrow(/UNUSABLE.*unknown-writer/);
    expect(judge).toHaveBeenCalledTimes(stage === 'late' ? script === 'route-bench' ? 1 : script === 'outcome' ? 2 : 0 : 0);
    if (script === 'judge') expect(model).toHaveBeenCalledTimes(stage === 'late' || stage === 'pending-verdict' ? 2 : 1);
    return;
  }
  if (script === 'mismatch-probe') await expect(execute()).rejects.toThrow(/UNUSABLE/);
  else await execute();
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

it.each(['tune', 'need-audit'])('gates %s analysis output without knowing its writers', async (script) => {
  root = mkdtempSync(join(tmpdir(), 'loadout-analysis-gate-'));
  const home = join(root, 'home'); mkdirSync(home);
  vi.stubEnv('LOADOUT_HOME', home); vi.stubEnv('TYPESAFE_API_KEY', secret);
  const raw = { shortlist: ['safe'], wide: { pick: { safe: 1 } }, close: { pick: { safe: 1 }, fit: { safe: { '3': 1 } } } };
  const row = { id: 'fixture', task: 'fixture', request: 'safe', arm: 'loadout', size: 1, split: 'dev', gold: ['safe'], loaded: [], offered: [], raw };
  writeFileSync(join(root, 'rows.jsonl'), JSON.stringify(row) + '\n');
  writeFileSync(join(root, 'decisions.jsonl'), JSON.stringify({ ...row, raw: undefined }) + '\n');
  writeFileSync(join(root, 'labels.jsonl'), '{"id":"fixture","need":"none","useful":[]}\n');
  writeFileSync(join(root, 'unknown-writer.txt'), secret.replaceAll('-', '%2d'));
  vi.doMock('../src/route.js', async (original) => ({ ...await original<typeof import('../src/route.js')>(),
    decide: () => ({ selected: [{ capability: { name: 'safe' } }], suggested: [], quiet: false }),
  }));
  vi.doMock('../bench/lib.js', async (original) => ({ ...await original<typeof import('../bench/lib.js')>(), splitOf: () => 'dev', isEntry: () => true }));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  process.argv = [process.execPath, `bench/${script}.ts`, ...(script === 'tune' ? [root] : ['--labels', join(root, 'labels.jsonl'), '--out', join(root, 'report.md'), root])];
  vi.resetModules();
  await expect(script === 'tune' ? import('../bench/tune.js') : import('../bench/need-audit.js')).rejects.toThrow(/UNUSABLE.*unknown-writer/);
});
