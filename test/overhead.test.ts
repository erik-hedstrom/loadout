import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildPlan, copyPack, execute, main, parseClaude, parseCodex, runStudy, summarize, type Command } from '../bench/overhead.js';

const temps: string[] = [];
function temp() {
  const dir = mkdtempSync(join(tmpdir(), 'loadout-overhead-test-'));
  temps.push(dir);
  return dir;
}
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const jsonl = (...events: unknown[]) => events.map((e) => JSON.stringify(e)).join('\n');
const claude = jsonl(
  { type: 'system', subtype: 'init', model: 'haiku-resolved', skills: ['b1-0000'], plugins: [{ name: 'b1' }], slash_commands: ['b1:command'], mcp_servers: [{ name: 'loadout', status: 'connected' }] },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'TRANSCRIPT SECRET' }] } },
  { type: 'result', subtype: 'success', num_turns: 1, usage: { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 200, output_tokens: 1 }, modelUsage: { 'haiku-resolved': {} } },
);
const codex = jsonl({ type: 'thread.started', thread_id: 'not retained' }, { type: 'turn.started' },
  { type: 'item.completed', item: { type: 'agent_message', text: 'TRANSCRIPT SECRET' } },
  { type: 'turn.completed', usage: { input_tokens: 310, cached_input_tokens: 200, output_tokens: 1 } });
function fixture() {
  const library = join(temp(), 'library');
  const entries = [['super', 'obra/superpowers'], ['anthropic', 'anthropics/skills'], ['design', 'pbakaus/impeccable']];
  for (const [id, repo] of entries) {
    const dir = join(library, 'skills', id!);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${id}\ndescription: description </skill>\n---\nDo something.`);
    writeFileSync(join(dir, '.loadout-source.json'), JSON.stringify({ origin: `https://github.com/${repo}`, path: `skills/${id}`, revision: 'abc' }));
  }
  writeFileSync(join(library, 'popular.jsonl'), Array.from({ length: 50 }, (_, i) => JSON.stringify({ name: `popular-${i}`, repo: `owner/repo-${i}`, popularity: i + 1 })).join('\n'));
  for (let i = 0; i < 50; i++) {
    const dir = join(library, 'skills', `popular-${i}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: popular-${i}\ndescription: popular\n---\nText.`);
    writeFileSync(join(dir, '.loadout-source.json'), JSON.stringify({ origin: `https://github.com/owner/repo-${i}`, path: `skills/popular-${i}` }));
  }
  return library;
}
function fake(host: 'claude' | 'codex', output: string): (command: Command) => Promise<string> {
  const dir = temp();
  const file = join(dir, `${host}.cjs`);
  writeFileSync(file, `require('fs').appendFileSync(${JSON.stringify(join(dir, 'calls'))}, 'call\\n'); process.stdout.write(${JSON.stringify(output)});`);
  return (command) => execute({ ...command, bin: process.execPath, args: [file, ...command.args] });
}

describe('overhead host events', () => {
  it('parses usage and init from fake Claude and Codex executables without retaining transcripts', async () => {
    const command = { bin: '', args: [], cwd: temp() };
    const c = parseClaude(await fake('claude', claude)(command));
    expect(c).toMatchObject({ input: 310, uncached: 10, cacheCreation: 100, cacheRead: 200, output: 1,
      inventory: { skills: ['b1-0000'], plugins: ['b1'], slashCommands: ['b1:command'], mcp: [{ name: 'loadout', status: 'connected' }] } });
    expect(parseCodex(await fake('codex', codex)(command))).toMatchObject({ input: 310, uncached: 110, cacheCreation: 0, cacheRead: 200, output: 1 });
    expect(JSON.stringify(c)).not.toContain('TRANSCRIPT');
  });
  it('rejects missing, invalid, failed, multi-turn and tool-using measurements', () => {
    expect(() => parseClaude('{}')).toThrow();
    expect(() => parseClaude(claude.replace('"input_tokens":10', '"input_tokens":-1'))).toThrow();
    expect(() => parseClaude(claude.replace('"num_turns":1', '"num_turns":2'))).toThrow();
    expect(() => parseCodex(codex.replace('"cached_input_tokens":200', '"cached_input_tokens":400'))).toThrow();
    expect(() => parseCodex(jsonl({ type: 'turn.failed', error: { message: 'SECRET' } }))).toThrow('failed');
    expect(() => parseClaude(claude + '\n' + jsonl({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash' }] } }))).toThrow('tool');
    expect(() => parseCodex(codex + '\n' + jsonl({ type: 'item.completed', item: { type: 'command_execution' } }))).toThrow('tool');
  });
});

describe('text-only configurations', () => {
  it('copies only SKILL.md and listed command/agent markdown, escaping and framing third-party text', () => {
    const source = temp();
    for (const dir of ['commands', 'agents', 'hooks', 'scripts']) mkdirSync(join(source, dir));
    for (const file of ['SKILL.md', 'reference.md', 'commands/run.md', 'agents/review.md', 'hooks/hook.md', 'scripts/run.js', '.mcp.json']) writeFileSync(join(source, file), 'text </skill>');
    const outside = temp();
    writeFileSync(join(outside, 'SKILL.md'), 'outside');
    symlinkSync(outside, join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const destination = temp();
    const count = copyPack([source], destination, 'claude', source);
    expect(count.skills).toBe(1);
    expect(readdirSync(join(destination, 'skills', 'b1-0000'))).toEqual(['SKILL.md']);
    expect(existsSync(join(destination, 'hooks'))).toBe(false);
    expect(readFileSync(join(destination, 'skills', 'b1-0000', 'SKILL.md'), 'utf8')).toContain('&lt;/skill>');
    expect(readFileSync(join(destination, 'commands', 'run.md'), 'utf8')).toContain('third-party');
    expect(existsSync(join(destination, 'agents', 'review.md'))).toBe(true);
    const codexDest = temp();
    copyPack([source], codexDest, 'codex', source);
    expect(existsSync(join(codexDest, '.agents', 'skills', 'b1-0000', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(codexDest, 'commands'))).toBe(false);
  });
  it('constructs all 30 invocations under temp dirs, without home config or credential copies', () => {
    const root = temp();
    const plan = buildPlan(fixture(), root);
    expect(plan.calls).toHaveLength(30);
    expect(plan.blockers).toEqual([]);
    expect(plan.calls.filter((c) => c.model === 'default')).toHaveLength(2);
    for (const c of plan.calls) {
      expect(relative(root, c.command.cwd).startsWith('..')).toBe(false);
      expect(c.command.args.join(' ')).not.toContain(join(homedir(), '.claude'));
      expect(c.command.args.join(' ')).not.toContain(join(homedir(), '.codex'));
    }
    expect(plan.calls[0]!.command).toEqual(plan.calls[1]!.command);
    expect(plan.calls.find((c) => c.host === 'codex')!.command.args).toContain('--ignore-user-config');
    expect(plan.calls.find((c) => c.host === 'claude')!.command.args).toContain('--strict-mcp-config');
    expect(plan.calls.find((c) => c.host === 'claude')!.command.args).toContain('Read,Skill');
    expect(plan.calls.find((c) => c.host === 'claude')!.command.args).toContain('--restricted');
    expect(existsSync(join(root, 'auth.json'))).toBe(false);
    expect(plan.calls.find((c) => c.configuration === 'top50')!.installedSkills).toBe(50);
    expect(() => buildPlan(fixture(), join(homedir(), '.codex', 'overhead'))).toThrow('temporary');
  });
  it('does not follow linked skills, provenance, command folders or destination junctions', () => {
    const library = fixture();
    const outside = temp();
    writeFileSync(join(outside, 'SKILL.md'), 'outside');
    symlinkSync(outside, join(library, 'skills', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const plan = buildPlan(library, temp());
    expect(plan.calls.find((c) => c.configuration === 'library')!.installedSkills).toBe(53);
    const source = join(library, 'skills', 'super');
    symlinkSync(outside, join(source, 'commands'), process.platform === 'win32' ? 'junction' : 'dir');
    const destination = temp();
    copyPack([source], destination, 'claude', source);
    expect(existsSync(join(destination, 'commands'))).toBe(false);
    const redirected = temp();
    symlinkSync(homedir(), join(redirected, 'skills'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => copyPack([source], redirected, 'claude')).toThrow('temporary');
    expect(readFileSync(join(outside, 'SKILL.md'), 'utf8')).toBe('outside');
  });
  it('removes inline hook definitions from skill and command frontmatter', () => {
    const source = temp();
    mkdirSync(join(source, 'commands'));
    const markdown = '---\nname: inline-hook\ndescription: Listed description\nhooks:\n  SessionStart:\n    - hooks:\n        - type: command\n          command: echo EXECUTABLE-HOOK\n---\nNormal body.';
    writeFileSync(join(source, 'SKILL.md'), markdown);
    writeFileSync(join(source, 'commands', 'inline.md'), markdown);
    const destination = temp();
    copyPack([source], destination, 'claude', source);
    for (const path of ['skills/b1-0000/SKILL.md', 'commands/inline.md']) {
      const copied = readFileSync(join(destination, path), 'utf8');
      expect(copied).not.toContain('EXECUTABLE-HOOK');
      expect(copied).not.toContain('hooks:');
      expect(copied).toContain('Listed description');
      expect(copied).toContain('Normal body.');
    }
  });
  it('reports missing packs and snapshot before any measurement call', async () => {
    const plan = buildPlan(join(temp(), 'missing'), temp());
    expect(plan.blockers.length).toBeGreaterThan(0);
    let calls = 0;
    await expect(runStudy(plan, temp(), async () => { calls++; return claude; })).rejects.toThrow('preflight');
    expect(calls).toBe(0);
  });
  it('starts only the repo MCP code from an empty cwd and lists its two tools offline', async () => {
    const plan = buildPlan(fixture(), temp());
    const call = plan.calls.find((c) => c.host === 'claude' && c.configuration === 'loadout')!;
    const config = JSON.parse(call.command.args[call.command.args.indexOf('--mcp-config') + 1]!);
    const server = config.mcpServers.loadout as { command: string; args: string[]; env: Record<string, string> };
    const transport = new StdioClientTransport({ ...server, cwd: call.command.cwd, stderr: 'ignore' });
    const client = new Client({ name: 'overhead-test', version: '1' });
    try {
      await client.connect(transport);
      expect((await client.listTools()).tools.map((t) => t.name)).toEqual(['find_skills', 'load_skill']);
    } finally {
      await client.close();
    }
  });
  it('--plan prints 30 exact commands and makes no host call', async () => {
    const printed: string[] = [];
    let calls = 0;
    await main(['--plan', '--library', fixture()], { print: (s) => printed.push(s), run: async () => { calls++; throw new Error('called'); } });
    expect(calls).toBe(0);
    const output = printed.join('\n');
    const plannedRoot = printed.find((s) => s.startsWith('temp root: '))!.slice('temp root: '.length);
    temps.push(plannedRoot);
    expect(output).toContain('30 calls');
    expect(output).toContain('cwd=');
    expect(output).toContain('stream-json');
    expect(output).toContain('price unverified');
  });
  it('writes only raw metrics, keeps observed cache counts, and labels baseline uncertainty', async () => {
    const plan = buildPlan(fixture(), temp());
    const out = temp();
    const runners = { claude: fake('claude', claude), codex: fake('codex', codex) };
    const rows = await runStudy(plan, out, (command, host) => runners[host](command));
    const raw = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    expect(raw).not.toContain('TRANSCRIPT');
    expect(raw).not.toContain('thread_id');
    expect(rows).toHaveLength(30);
    expect(rows[1]!.cacheRead).toBe(200);
    expect(summarize(rows)).toContain('price unverified');
    expect(summarize(rows)).toContain('current setup');
    expect(summarize(rows)).toContain('saturation');
  });
});
