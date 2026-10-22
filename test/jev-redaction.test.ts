import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.js';
import { promptContext } from '../src/hook.js';
import { jevClient, type Question, type SystemOneClient } from '../src/jev.js';
import { materialize } from '../src/launch.js';
import { findTools } from '../src/mcp.js';
import { askJev, decide, policyFrom, route } from '../src/route.js';
import { KEY_PATTERNS, redactJson } from '../src/redact.js';
import { reportJson, type Capability } from '../src/types.js';

// Synthetic strings, assembled so repository scans do not mistake them for credentials.
const samples = [
  ['sk- key', 'sk-' + 'a'.repeat(24)],
  ['AWS access key id', 'AKIA' + 'A'.repeat(16)],
  ['GitHub token', 'ghp_' + 'a'.repeat(24)],
  ['Slack token', 'xoxb-' + 'a'.repeat(16)],
  ['Google API key', 'AIza' + 'a'.repeat(32)],
  ['private key block', '-----BEGIN ' + 'RSA PRIVATE KEY-----'],
  ['JWT', 'eyJ' + 'a'.repeat(12) + '.eyJ' + 'b'.repeat(12) + '.' + 'c'.repeat(12)],
  ['bearer token', 'bEaReR ' + 'a'.repeat(24)],
];

const fakeClient: SystemOneClient = {
  async ask(_state, questions) {
    return {
      model: 'fake',
      answers: Object.fromEntries(Object.entries(questions).map(([id, q]) => {
        if (q.type === 'noul') return [id, { type: 'noul', noul: id === 'general_enough' ? 0 : 1 }];
        if (q.type === 'score') return [id, { type: 'score', score: 3, confidence: 1, probabilities: { '3': 1 } }];
        const choice = Object.keys(q.criteria)[0]!;
        return [id, { type: 'choice', choice, confidence: 1, probabilities: { [choice]: 1 } }];
      })),
      usage: { input_tokens: 10, output_tokens: 0 },
    };
  },
};

const config = { ...DEFAULT_CONFIG, embeddings: false, search: false };
const repo = { name: 'project', files: [], dependencies: [], languages: {} };
const library: Capability[] = [{ id: 'skill:canary', kind: 'skill', name: 'canary', description: 'Debug tests', source: join(import.meta.dirname, 'fixtures/library/skills/webapp-testing') }];
const temps: string[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'loadout-redact-')); temps.push(dir); return dir; };

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function upstream() {
  const bodies: string[] = [];
  const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    bodies.push(String(init!.body));
    const payload = JSON.parse(bodies.at(-1)!) as { state: unknown; questions: Record<string, Question> };
    return new Response(JSON.stringify(await fakeClient.ask(payload.state, payload.questions)));
  });
  return { bodies, diagnostics, client: jevClient({ apiKey: 'fake-auth', baseUrl: 'https://example.invalid', model: 'fake', retries: 0 }) };
}

describe('Jev key redaction', () => {
  it('preserves two token-shaped option identities and skips aliases already in use', async () => {
    const names = [samples[0]![1]!, 'sk-' + 'b'.repeat(24), 'redacted-option-1'];
    const capabilities = names.map((name, i) => ({ ...library[0]!, id: `skill:${i}`, name }));
    const { client, bodies } = upstream();
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      bodies.push(String(init!.body));
      const { state, questions } = JSON.parse(bodies.at(-1)!);
      const answer = await fakeClient.ask(state, questions);
      const options = Object.keys(questions.pick.criteria);
      answer.answers.pick = { type: 'choice', choice: options[0]!, confidence: 1, probabilities: { [options[0]!]: 0.4, [options[1]!]: 0.6 } };
      return new Response(JSON.stringify(answer));
    });
    const { raw, keys } = await askJev(client, {}, capabilities, 3);
    const decision = decide(raw, keys, policyFrom(config));
    expect(raw.wide.pick).toEqual({ [names[0]!]: 0.4, [names[1]!]: 0.6 });
    expect(raw.close.pick).toEqual({ [names[1]!]: 0.4, [names[0]!]: 0.6 });
    expect(decision.selected.map((s) => [s.capability.name, s.share])).toEqual([[names[0], 0.6], [names[1], 0.4]]);
    const sent = JSON.parse(bodies[0]!).questions.pick.criteria;
    expect(Object.keys(sent)).toEqual(['redacted-option-2', 'redacted-option-3', 'redacted-option-1', 'no_skill_needed']);
    for (const name of names.slice(0, 2)) expect(bodies.join('')).not.toContain(name!);
  });

  it('preserves distinct token-shaped report keys and probabilities while redacting values', () => {
    const first = samples[0]![1]!;
    const second = 'sk-' + 'b'.repeat(24);
    const report = JSON.parse(reportJson({ pick: { [first]: 0.4, [second]: 0.6 }, task: first }));
    expect(report).toEqual({ pick: { [first]: 0.4, [second]: 0.6 }, task: '[REDACTED]' });
  });

  it('matches the frozen regexes on normal and adversarial strings', () => {
    const corpus = ['ordinary prose', 'quoted " text\\path\n', ...samples.map(([, text]) => text!), ...samples.map(([, text]) => `before ${text} after ${text}`)];
    const jwt = samples[6]![1]!;
    corpus.push(`x${jwt}`, `-${jwt}`, `_${jwt}`, `${jwt}.${jwt}.${jwt}`, 'eyJ-'.repeat(100), `${'eyJ-'.repeat(100)}.${jwt}`, `${jwt}..${jwt}`);
    for (const [, sample] of samples) for (const prefix of ['', 'x', '_', '-', '.', 'é', '\\', '"\n']) corpus.push(prefix + sample);
    for (let n = 0; n < 16; n++) corpus.push(`eyJ${'a'.repeat(n)}.eyJ${'b'.repeat(n)}.${'c'.repeat(n)}`);
    const segment = 'eyJ' + 'a'.repeat(12);
    corpus.push(Array.from({ length: 9 }, () => segment).join('.'));
    for (const first of [segment, 'a'.repeat(15), `_${segment}`, 'eyJ' + 'a'.repeat(9)]) {
      for (const second of [segment, 'a'.repeat(13), 'eyJ' + 'b'.repeat(9)]) {
        for (const third of ['c'.repeat(9), 'c'.repeat(10)]) corpus.push(`${first}.${second}.${third}`);
      }
    }
    for (const separator of [' ', '..', '. ', '\n', '!']) corpus.push(`${segment}${separator}${segment}.${segment}`, `${segment}.${segment}${separator}${segment}`);
    let seed = 42;
    const atoms = ['eyJ', '-', '_', '.', 'a'.repeat(10), 'sk-', 'Bearer ', 'AKIA', 'PRIVATE KEY-----', ' ', '\n'];
    for (let row = 0; row < 300; row++) {
      let text = '';
      for (let col = 0; col < 30; col++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; text += atoms[seed % atoms.length]; }
      corpus.push(text);
    }
    for (const text of corpus) {
      let expected = text;
      let count = 0;
      for (const { pattern, flags } of KEY_PATTERNS) expected = expected.replace(new RegExp(pattern, `${flags ?? ''}g`), () => { count++; return '[REDACTED]'; });
      const result = redactJson(JSON.stringify({ value: text }));
      expect({ value: JSON.parse(result.json).value, count: result.count }, text).toEqual({ value: expected, count });
    }
  });

  it('bounds restart-heavy matching for every shape', () => {
    // Linear matching takes under 30 ms here on WSL; the quadratic JWT matcher took 3.5 s at 64 KiB, so a
    // 1 s bound at 256 KiB still catches a regression without flaking on a slow CI worker.
    const BOUND_MS = 1000;
    // Each prefix repeats inside the suffix class, or stops just before a required literal.
    const worst = [
      'sk-', 'AKIA', 'ghp_', 'xoxb-', 'AIza', '-----BEGIN ' + 'A'.repeat(100), 'eyJ-', 'Bearer ', 'eyJ-.eyJ-.',
      'sk-' + 'a'.repeat(19) + '!', 'AKIA' + 'A'.repeat(15) + '!', 'ghp_' + 'a'.repeat(19) + '!',
      'xoxb-' + 'a'.repeat(9) + '!', 'AIza' + 'a'.repeat(29) + '!', 'Bearer ' + 'a'.repeat(19) + '!',
    ];
    for (const unit of worst) {
      const input = JSON.stringify({ value: unit.repeat(Math.ceil(256 * 1024 / unit.length)) });
      const started = performance.now();
      redactJson(input);
      expect(performance.now() - started, unit).toBeLessThan(BOUND_MS);
    }
    const privateHeader = JSON.stringify({ value: '-----BEGIN ' + 'PRIVATE KEY '.repeat(24 * 1024) });
    const started = performance.now();
    redactJson(privateHeader);
    expect(performance.now() - started).toBeLessThan(BOUND_MS);
  });

  it.each(samples)('redacts every %s occurrence in goals, keywords, prompts and questions', async (_shape, secret) => {
    const { bodies, diagnostics, client } = upstream();
    const state = { goal: `Keep context\n${secret}`, keywords: ['debug', `before ${secret} middle ${secret} after`], prompt: secret };
    const questions: Record<string, Question> = { check: { type: 'noul', instructions: { trust: 'third-party', text: secret } } };
    const original = JSON.stringify({ state, questions });
    await expect(client.ask(state, questions)).resolves.toMatchObject({ redactions: 5 });
    expect(JSON.parse(bodies[0]!)).toMatchObject({
      state: { goal: 'Keep context\n[REDACTED]', keywords: ['debug', 'before [REDACTED] middle [REDACTED] after'], prompt: '[REDACTED]' },
      questions: { check: { instructions: { trust: 'third-party', text: '[REDACTED]' } } },
    });
    expect(JSON.stringify({ state, questions })).toBe(original);
    expect(diagnostics.mock.calls).toEqual([['loadout: redacted 5 key-shaped strings before Jev']]);
    expect(bodies.join('\n') + JSON.stringify(diagnostics.mock.calls)).not.toContain(secret!);
  });

  it.each(['route', 'find_tools', 'hook'] as const)('protects the real %s path and its session logs', async (entry) => {
    const secret = samples[2]![1]!;
    const { bodies, diagnostics, client } = upstream();
    const task = `Debug the failing tests\n${secret}`;
    const dir = temp();
    let logs = '';
    if (entry === 'route') {
      const decision = await route({ task, repo, library, config, client });
      expect(decision.router).toBe('jev');
      expect(decision.stats).toMatchObject({ redactions: 2 });
      const session = materialize(decision, 'claude', config, dir);
      logs += readFileSync(join(session.dir, 'decision.json'), 'utf8');
      expect(JSON.parse(logs).stats).toMatchObject({ redactions: 2 });
    } else if (entry === 'find_tools') {
      logs += await findTools({ library, config, client, repo }, 'Debug the failing tests', [`before ${secret} after`]);
    } else {
      logs += await promptContext({ prompt: task, session_id: 'redaction-test' }, { library, config, client, repo, stateDir: dir });
      for (const file of readdirSync(dir)) logs += readFileSync(join(dir, file), 'utf8');
    }
    expect(bodies).toHaveLength(2);
    expect(bodies.every((body) => body.includes('[REDACTED]'))).toBe(true);
    expect(diagnostics.mock.calls).toEqual(Array.from({ length: 2 }, () => ['loadout: redacted 1 key-shaped strings before Jev']));
    expect(logs + bodies.join('\n') + JSON.stringify(diagnostics.mock.calls)).not.toContain(secret);
  });

  it('redacts object keys as well as values, including after JSON escapes', async () => {
    const secret = samples[0]![1]!;
    const { bodies, client } = upstream();
    await client.ask({ [`prefix\n${secret}`]: ['ordinary'] }, { check: { type: 'noul', instructions: 'Check' } });
    expect(JSON.parse(bodies[0]!).state).toEqual({ 'prefix\n[REDACTED]': ['ordinary'] });
  });

  it('keeps key-shaped third-party metadata out of the decision log', async () => {
    const secret = samples[4]![1]!;
    const { client, diagnostics } = upstream();
    const decision = await route({ task: 'Debug the failing tests', repo, library: [{ ...library[0]!, description: `Debug tests ${secret}` }], config, client });
    const session = materialize(decision, 'claude', config, temp());
    const log = readFileSync(join(session.dir, 'decision.json'), 'utf8');
    expect(log).toContain('[REDACTED]');
    expect(log + reportJson(decision) + JSON.stringify(diagnostics.mock.calls)).not.toContain(secret);
  });

  it('leaves ordinary JSON and authentication unchanged without a redaction diagnostic', async () => {
    const { bodies, diagnostics } = upstream();
    const apiKey = samples[0]![1]!;
    const client = jevClient({ apiKey, baseUrl: 'https://example.invalid', model: 'fake', retries: 0 });
    const state = { request: 'Fix login', number: 2, enabled: true, empty: null, nested: ['ordinary'] };
    await client.ask(state, {});
    expect(JSON.parse(bodies[0]!).state).toEqual(state);
    expect(vi.mocked(fetch).mock.calls[0]![1]!.headers).toMatchObject({ Authorization: `Bearer ${apiKey}` });
    expect(diagnostics).not.toHaveBeenCalled();
  });

  it('does not expose serialization failures that include a match', async () => {
    const secret = samples[0]![1]!;
    const { client, bodies, diagnostics } = upstream();
    const state = { toJSON() { throw new Error(secret); } };
    await expect(client.ask(state, {})).rejects.toMatchObject({ message: 'Jev request could not be serialized', retryable: false });
    expect(bodies).toEqual([]);
    expect(diagnostics).not.toHaveBeenCalled();
  });

  it('validates redacted question identifiers without exposing them in schema errors', async () => {
    const secret = samples[1]![1]!;
    const { client, bodies, diagnostics } = upstream();
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      bodies.push(String(init!.body));
      return new Response(JSON.stringify({ model: 'fake', answers: {}, usage: { input_tokens: 0, output_tokens: 0 } }));
    });
    let failure: unknown;
    try { await client.ask({}, { [secret]: { type: 'noul', instructions: 'Check' } }); } catch (err) { failure = err; }
    expect(failure).toMatchObject({ message: 'Jev response did not match the schema (answer [REDACTED])' });
    expect(bodies.join('\n') + String(failure) + JSON.stringify(diagnostics.mock.calls)).not.toContain(secret);
  });

  it('counts a logical request once and keeps retries and failure diagnostics free of matches', async () => {
    const secret = samples[7]![1]!;
    const { bodies, diagnostics } = upstream();
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      bodies.push(String(init!.body));
      return new Response(JSON.stringify({ detail: secret }), { status: 500 });
    });
    const client = jevClient({ apiKey: 'fake-auth', baseUrl: 'https://example.invalid', model: 'fake', retries: 1 });
    let failure: unknown;
    try { await client.ask({ request: secret }, {}); } catch (err) { failure = err; }
    expect(failure).toMatchObject({ message: 'Jev request failed: HTTP 500' });
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
    expect(diagnostics.mock.calls).toEqual([['loadout: redacted 1 key-shaped strings before Jev']]);
    expect(bodies.join('\n') + String(failure) + JSON.stringify(diagnostics.mock.calls)).not.toContain(secret);
  });
});
