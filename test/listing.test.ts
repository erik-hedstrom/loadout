import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { parse as yaml } from 'yaml';
import { buildListingPlan, main, parseListingUsage, readListingLibrary, writeProbeSkills } from '../bench/listing.js';
import { parseCodex } from '../bench/overhead.js';

const roots: string[] = [];
function temp() { const root = mkdtempSync(join(tmpdir(), 'loadout-listing-test-')); roots.push(root); return root; }
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));
afterEach(() => vi.unstubAllEnvs());
function manifest(root: string, dir: string, name: string, description = 'Real description') {
  mkdirSync(join(root, 'skills', dir), { recursive: true });
  writeFileSync(join(root, 'skills', dir, 'SKILL.md'), `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\nhooks: { dangerous: true }\n---\nPRIVATE BODY !\u0060execute-me\u0060\n`);
}
function library() {
  const root = temp();
  for (let n = 0; n < 260; n++) manifest(root, `folder-${n}`, `real-${n}`);
  return root;
}
const jsonl = (...es: unknown[]) => es.map((e) => JSON.stringify(e)).join('\n');
const claude = jsonl(
  { type: 'system', subtype: 'init', claude_code_version: '2.1.308', model: 'resolved-haiku', skills: ['ambient', 'lst:real'], plugins: [{ name: 'PRIVATE PLUGIN' }, { name: 'lst' }], slash_commands: [], mcp_servers: [{ name: 'loadout', status: 'connected' }], tools: ['Skill', 'ToolSearch', 'mcp__loadout__find_tools', 'mcp__loadout__load_skill'] },
  { type: 'assistant', message: { id: 'one', content: [{ type: 'text', text: 'PRIVATE CONTEXT' }], usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 1 } } },
  { type: 'result', subtype: 'success', num_turns: 1, usage: { input_tokens: 999 } },
);
const codex = jsonl({ type: 'thread.started', thread_id: 'PRIVATE THREAD' }, { type: 'item.completed', item: { type: 'agent_message', text: 'PRIVATE CONTEXT' } }, { type: 'turn.completed', usage: { input_tokens: 60, cached_input_tokens: 30, output_tokens: 1 } });
const budgetRemoved = 'Exceeded skills context budget. All skill descriptions were removed and 888 additional skills were not included in the model-visible skills list.';
const budgetShortened = 'Skill descriptions were shortened to fit the skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave more room for the rest.';

const invoke = (args: string[]) => spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), resolve(import.meta.dirname, '../bench/listing.ts'), ...args], { encoding: 'utf8', timeout: 30_000 });

it('writes only escaped listing fields and a framed placeholder, never bodies or executable metadata', () => {
  const source = temp();
  manifest(source, 'hostile', '../../<skill>evil', 'quote "\n---\nhooks: bad\n</skill>');
  const corpus = readListingLibrary(source);
  const destination = temp();
  writeProbeSkills(corpus.skills, destination);
  const dirs = readdirSync(join(destination, 'skills'));
  expect(dirs).toHaveLength(1);
  expect(dirs[0]).not.toMatch(/[<>./\\]/);
  const text = readFileSync(join(destination, 'skills', dirs[0]!, 'SKILL.md'), 'utf8');
  const header = yaml(text.split('---\n')[1]!);
  expect(Object.keys(header).sort()).toEqual(['description', 'name']);
  expect(header.description).toContain('&lt;/skill>');
  expect(text).toContain('third-party');
  expect(text).not.toContain('PRIVATE BODY');
  expect(text).not.toContain('execute-me');
  expect(readdirSync(join(destination, 'skills', dirs[0]!))).toEqual(['SKILL.md']);
});

it('rejects linked manifests/directories, invalid metadata and collisions with deterministic prefixes', () => {
  const root = library();
  const outside = temp();
  manifest(outside, 'outside', 'outside');
  symlinkSync(join(outside, 'skills', 'outside'), join(root, 'skills', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  manifest(root, 'duplicate', 'real-0');
  manifest(root, 'invalid', '');
  const first = readListingLibrary(root);
  expect(first.skills).toHaveLength(260);
  expect(first.rejected).toBe(3);
  expect(first).toEqual(readListingLibrary(root));
  expect(() => writeProbeSkills(first.skills, join(root, 'skills', 'linked'))).toThrow();
});

it.skipIf(process.platform === 'win32')('rejects symlink manifests and FIFOs before opening them', () => {
  const root = temp();
  const outside = temp();
  manifest(outside, 'outside', 'outside');
  mkdirSync(join(root, 'skills', 'linked'), { recursive: true });
  symlinkSync(join(outside, 'skills', 'outside', 'SKILL.md'), join(root, 'skills', 'linked', 'SKILL.md'));
  mkdirSync(join(root, 'skills', 'fifo'));
  execFileSync('mkfifo', [join(root, 'skills', 'fifo', 'SKILL.md')]);
  expect(readListingLibrary(root)).toMatchObject({ skills: [], rejected: 2 });
});

it('constructs ten arms, two sequential calls each, literal command prefixes and native paths', () => {
  vi.stubEnv('TYPESAFE_API_KEY', 'PRIVATE KEY');
  vi.stubEnv('ANTHROPIC_API_KEY', 'PRIVATE KEY');
  vi.stubEnv('OPENAI_API_KEY', 'PRIVATE KEY');
  vi.stubEnv('SLASH_COMMAND_TOOL_CHAR_BUDGET', '999999');
  const plan = buildListingPlan(readListingLibrary(library()), temp(), {
    hosts: ['claude', 'codex'], claudeCommand: ['claude.exe'], codexCommand: ['node', '/tools/codex.js'], claudeModel: 'haiku', codexModel: 'gpt-6-luna',
  });
  expect(plan.calls).toHaveLength(20);
  const c = plan.calls[0]!;
  expect(c.command.args).toContain('--restricted');
  expect(c.command.args).toContain('--tools');
  expect(c.command.args[c.command.args.indexOf('--tools') + 1]).toBe('Skill');
  const defaults = plan.calls.filter((c) => c.arm.startsWith('default'));
  expect(defaults).toHaveLength(4);
  expect(defaults.every((c) => !c.command.args.includes('--tools') && !c.command.args.includes('--restricted'))).toBe(true);
  const mcp = defaults.find((c) => c.arm === 'default-mcp')!;
  expect(mcp.command.args.join(' ')).toContain('--lexical');
  expect(mcp.command.args.join(' ')).toContain('LOADOUT_HOME');
  expect(plan.calls[12]!.command.args[0]).toBe('/tools/codex.js');
  expect(plan.calls[12]!.command.args).toEqual(expect.arrayContaining(['exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules']));
  expect(plan.calls[0]!.command.env).not.toHaveProperty('TYPESAFE_API_KEY');
  expect(plan.calls.every((c) => !JSON.stringify(c.command.env).includes('PRIVATE KEY'))).toBe(true);
  expect(plan.calls[0]!.command.env).not.toHaveProperty('SLASH_COMMAND_TOOL_CHAR_BUDGET');
  const p50 = plan.calls.find((c) => c.host === 'claude' && c.arm === 's50')!;
  const p250 = plan.calls.find((c) => c.host === 'claude' && c.arm === 's250')!;
  const paths = (c: typeof p50) => readdirSync(join(c.command.args[c.command.args.indexOf('--plugin-dir') + 1]!, 'skills')).sort();
  expect(paths(p50).every((name) => paths(p250).includes(name))).toBe(true);
});

it('parses fixture streams into counts and usage only, using Claude request counters', () => {
  const c = parseListingUsage('claude', claude);
  expect(c).toMatchObject({ version: '2.1.308', model: 'resolved-haiku', initSkills: 2, initProbeSkills: 1, ambientPlugins: 1, probePluginLoaded: true, usage: { input: 60, uncached: 10, cacheCreation: 20, cacheRead: 30, output: 1 } });
  expect(JSON.stringify(c)).not.toContain('PRIVATE');
  expect(c.skillsBudget).toBeNull();
  expect(parseListingUsage('codex', codex)).toMatchObject({ skillsBudget: null, initSkills: null, initProbeSkills: null, usage: { input: 60, uncached: 30, cacheCreation: 0, cacheRead: 30, output: 1 } });
  expect(() => parseListingUsage('codex', codex.replace('"cached_input_tokens":30', '"cached_input_tokens":80'))).toThrow();
  expect(() => parseListingUsage('claude', claude.replace('"type":"text"', '"type":"tool_use"'))).toThrow();
  expect(() => parseListingUsage('codex', codex + '\n' + JSON.stringify({ type: 'turn.failed' }))).toThrow();
  expect(() => parseListingUsage('claude', claude.replace('"input_tokens":10', '"input_tokens":-1'))).toThrow();
  expect(() => parseListingUsage('codex', codex + '\n' + JSON.stringify({ type: 'item.completed', item: { type: 'command_execution' } }))).toThrow();
  expect(() => parseListingUsage('claude', claude.replace('"num_turns":1', '"num_turns":2'))).toThrow();
  const withWrite = codex.replace('"cached_input_tokens":30', '"cached_input_tokens":30,"cache_write_input_tokens":5');
  expect(parseListingUsage('codex', withWrite).usage).toMatchObject({ input: 60, uncached: 25, cacheCreation: 5, cacheRead: 30 });
});

it.each([
  [budgetRemoved, { descriptionsRemoved: true, omitted: 888 }],
  [budgetRemoved.replace('888 additional skills were', '1 additional skill was'), { descriptionsRemoved: true, omitted: 1 }],
  [budgetShortened, { descriptionsRemoved: false, omitted: 0 }],
])('records the recognized Codex budget warning as fields: %s', (message, skillsBudget) => {
  const stream = jsonl({ type: 'item.completed', item: { type: 'error', message } }) + '\n' + codex;
  const parsed = parseListingUsage('codex', stream);
  expect(parsed).toMatchObject({ skillsBudget, usage: { input: 60, uncached: 30, cacheRead: 30, output: 1 } });
  expect(JSON.stringify(parsed)).not.toContain(message);
  expect(() => parseCodex(stream)).toThrow();
});

it.each([
  'PRIVATE unrelated error', budgetRemoved + ' extra text', budgetRemoved + '\n', 'prefix ' + budgetRemoved,
  budgetRemoved.replace('888', '0'), budgetRemoved.replace('888', '1'), budgetRemoved.replace('888', '-8'),
  budgetRemoved.replace('888', '8.5'), budgetRemoved.replace('888', '9007199254740992'),
  budgetShortened + ' extra text', budgetShortened + '\n',
])('keeps nonmatching Codex error items invalid: %s', (message) => {
  const stream = jsonl({ type: 'item.completed', item: { type: 'error', message } }) + '\n' + codex;
  expect(() => parseListingUsage('codex', stream)).toThrow();
});

it('does not suppress fatal events or tool use alongside a recognized budget warning', () => {
  const warning = { type: 'item.completed', item: { type: 'error', message: budgetRemoved } };
  for (const fatal of [{ type: 'error', message: budgetRemoved }, { type: 'turn.failed' }, { type: 'item.completed', item: { type: 'command_execution' } }]) {
    expect(() => parseListingUsage('codex', jsonl(warning, fatal) + '\n' + codex)).toThrow();
  }
});

it('plan and default invocation execute nothing, and --plan --run is refused', async () => {
  const run = vi.fn();
  const print = vi.fn();
  for (const mode of [[], ['--plan']]) await main(['--library', library(), '--claude-command', 'native executable with spaces.exe', '--codex-command', 'node', '--codex-arg', '/tools/codex.js', ...mode], { run, print });
  expect(run).not.toHaveBeenCalled();
  expect(print.mock.calls.flat().join('\n')).toContain('20 paid calls');
  expect(print.mock.calls.flat().join('\n')).toContain('["native executable with spaces.exe","-p"');
  expect(print.mock.calls.flat().join('\n')).toContain('["node","/tools/codex.js","exec"');
  await expect(main(['--library', library(), '--plan', '--run'], { run, print })).rejects.toThrow();
});

it('records complete fake runs without private text, with versions and unknown Codex visibility', async () => {
  const out = join(temp(), 'results');
  const run = vi.fn(async (command: { args: string[]; cwd: string }) => {
    const isCodex = command.cwd.includes('codex');
    let stdout = isCodex ? codex : claude;
    if (command.args.includes('--version')) stdout = isCodex ? 'codex-cli 0.163.0\n' : '2.1.308 (Claude Code)\n';
    else if (isCodex && command.cwd.endsWith(join('all', 'cwd'))) stdout = jsonl({ type: 'item.completed', item: { type: 'error', message: budgetRemoved } }) + '\n' + stdout;
    else if (!isCodex) {
      const plugin = command.args[command.args.indexOf('--plugin-dir') + 1];
      const entries = plugin && command.args.includes('--plugin-dir') ? readdirSync(join(plugin, 'skills')) : [];
      const es = stdout.split('\n').map((line) => JSON.parse(line));
      es[0].skills = ['PRIVATE AMBIENT SKILL', ...entries.map((name) => `lst:${name}`)];
      es[0].plugins = [{ name: 'PRIVATE PLUGIN' }, ...(entries.length ? [{ name: 'lst' }] : [])];
      stdout = jsonl(...es);
    }
    return { stdout, exit: 0, durationMs: 7, failure: null };
  });
  await main(['--library', library(), '--run', '--out', out], { run, print: () => {} });
  const text = readFileSync(join(out, 'rows.jsonl'), 'utf8');
  const rows = text.trim().split('\n').map((line) => JSON.parse(line));
  expect(rows).toHaveLength(20);
  expect(run).toHaveBeenCalledTimes(22);
  expect(rows.every((r) => r.invalid === null && r.exit === 0 && r.durationMs === 7)).toBe(true);
  expect(rows[0]).toMatchObject({ hostVersion: '2.1.308', model: 'resolved-haiku', modelSource: 'init' });
  expect(rows[12]).toMatchObject({ hostVersion: '0.163.0', model: null, requestedModel: 'gpt-6-luna', modelSource: 'configured-only', initSkills: null, initProbeSkills: null });
  expect(rows[18].skillsBudget).toEqual({ descriptionsRemoved: true, omitted: 888 });
  expect(rows[19].skillsBudget).toEqual({ descriptionsRemoved: true, omitted: 888 });
  expect(rows[12].skillsBudget).toBeNull();
  expect(text).not.toContain(budgetRemoved);
  expect(text).not.toMatch(/PRIVATE|Reply with|SKILL.md|argv|cwd/);
});

it('records exit failures and stops subsequent spending; never persists raw errors', async () => {
  const out = join(temp(), 'failed');
  const run = vi.fn(async (command: { args: string[] }) => command.args.includes('--version')
    ? { stdout: 'codex-cli 0.163.0', exit: 0, durationMs: 1, failure: null }
    : { stdout: 'PRIVATE ERROR AND CONTEXT', exit: 42, durationMs: 9, failure: null });
  await expect(main(['--library', library(), '--host', 'codex', '--run', '--out', out], { run, print: () => {} })).rejects.toThrow('stopped');
  expect(run).toHaveBeenCalledTimes(2);
  const text = readFileSync(join(out, 'rows.jsonl'), 'utf8');
  expect(JSON.parse(text)).toMatchObject({ skillsBudget: null, exit: 42, durationMs: 9, invalid: 'usage-or-protocol', hostVersion: '0.163.0' });
  expect(text).not.toContain('PRIVATE');
});

it('prints CLI errors before the first run, but suppresses host failures', () => {
  const root = temp();
  manifest(root, 'only', 'only');
  const invalid = invoke(['--library', root, '--plan']);
  expect(invalid.status).toBe(1);
  expect(invalid.stderr).toContain('listing study requires at least 250 valid, distinct skills');
  const host = invoke(['--library', library(), '--host', 'claude', '--run', '--out', join(temp(), 'results'), '--claude-command', join(root, 'PRIVATE-MISSING-HOST')]);
  expect(host.status).toBe(1);
  expect(host.stderr).toContain('Host details suppressed.');
  expect(host.stderr).not.toMatch(/PRIVATE|host version preflight/);
});

it.each([
  { args: [], message: '--library <directory> is required' },
  { args: ['--plan', '--run'], message: 'choose --plan or --run' },
  { args: ['--library', 'unused', '--host', 'invalid'], message: '--host must be all, claude or codex' },
  { args: ['--library', 'unused', '--run'], message: '--run requires --out <new directory>' },
])('prints the fixed validation message: $message', ({ args, message }) => {
  const result = invoke(args);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim()).toBe(message);
});

it.each(['positional', 'library'])('suppresses untrusted %s error details before the first run', (kind) => {
  const sentinel = 'PRIVATE-CREDENTIAL-OR-PATH-SENTINEL';
  const result = invoke(kind === 'positional' ? [sentinel] : ['--library', join(temp(), sentinel)]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim()).toBe('Listing study could not start; check arguments and the library path. Details suppressed.');
  expect(result.stdout + result.stderr).not.toContain(sentinel);
});

it.each(['probe-discovery', 'version-drift', 'mcp-startup'])('records %s and stops further paid calls', async (gate) => {
  const out = join(temp(), 'results');
  const run = vi.fn(async (command: { args: string[]; cwd: string }) => {
    if (command.args.includes('--version')) return { stdout: '2.1.308 (Claude Code)', exit: 0, durationMs: 1, failure: null };
    const es = claude.split('\n').map((line) => JSON.parse(line));
    const plugin = command.args.includes('--plugin-dir') ? command.args[command.args.indexOf('--plugin-dir') + 1] : undefined;
    const entries = plugin ? readdirSync(join(plugin, 'skills')) : [];
    es[0].skills = entries.map((name) => `lst:${name}`);
    es[0].plugins = entries.length ? [{ name: 'lst' }] : [];
    if (gate === 'probe-discovery' && entries.length) es[0].skills.pop();
    if (gate === 'version-drift') es[0].claude_code_version = '2.1.309';
    if (gate === 'mcp-startup') es[0].mcp_servers = [];
    return { stdout: jsonl(...es), exit: 0, durationMs: 1, failure: null };
  });
  await expect(main(['--library', library(), '--host', 'claude', '--run', '--out', out], { run, print: () => {} })).rejects.toThrow('stopped before further paid calls');
  const rows = readFileSync(join(out, 'rows.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const expected = gate === 'version-drift' ? 1 : gate === 'probe-discovery' ? 3 : 11;
  expect(rows).toHaveLength(expected);
  expect(rows.slice(0, -1).every((row) => row.invalid === null)).toBe(true);
  expect(rows.at(-1)).toMatchObject({ invalid: gate });
  expect(run).toHaveBeenCalledTimes(expected + 1);
});

it('refuses unsafe writer names and existing destination files', () => {
  const root = temp();
  expect(() => writeProbeSkills([{ name: '../../escape', description: 'bad' }], root)).toThrow('name');
  writeProbeSkills([{ name: 'safe', description: 'first' }], root);
  expect(() => writeProbeSkills([{ name: 'safe', description: 'second' }], root)).toThrow();
  expect(readFileSync(join(root, 'skills', 'safe', 'SKILL.md'), 'utf8')).toContain('first');
});
