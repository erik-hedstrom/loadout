import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildPlan, copyPack, execute, main, parseClaude, parseCodex, runStudy, summarize, parsePromptInput, validateFeatures, inspectCodex, preflight, DISABLED_FEATURES, type Command, type Plan } from '../bench/overhead.js';

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
  { type: 'result', subtype: 'success', num_turns: 1, usage: { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 200, output_tokens: 1 }, modelUsage: { 'haiku-resolved': { inputTokens: 10 }, 'another-model': { inputTokens: 2 } } },
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
  writeFileSync(join(library, 'popular.jsonl'), Array.from({ length: 50 }, (_, i) => JSON.stringify({ name: `popular-${i}`, repo: `owner/repo-${i}`, popularity: i * 3 + 1 })).reverse().join('\n'));
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
function fakeStudy(plan: Plan) {
  const features = DISABLED_FEATURES.map((name) => `${name} stable false`).join('\n');
  const run = async (command: Command, host: 'claude' | 'codex') => {
    const call = plan.calls.find((c) => c.command.cwd === command.cwd)!;
    if (command.args.includes('features')) return features;
    if (command.args.includes('prompt-input')) {
      const lines = Array.from({ length: call.copiedSkills }, (_, i) => `- name-${i}: SECRET DESCRIPTION (file: r1/b1-${i.toString().padStart(4, '0')}/SKILL.md)`);
      const context = `<skills_instructions>\n- \`r0\` = \`${command.cwd}/ambient\`\n- \`r1\` = \`${command.cwd}/.agents/skills\`\n- ambient: Existing (file: r0/ambient/SKILL.md)\n${lines.join('\n')}\n</skills_instructions>\n# AGENTS.md instructions for ${command.cwd}\nSECRET AGENTS`;
      return JSON.stringify([{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: context }] }]);
    }
    if (host === 'codex') return codex.replace('"input_tokens":310', `"input_tokens":${310 + call.copiedSkills * 10}`);
    const events = claude.split('\n').map((line) => JSON.parse(line));
    events[0].plugins = [{ name: 'ambient' }, ...(call.copiedSkills ? [{ name: 'b1' }] : [])];
    events[0].skills = ['ambient', ...Array.from({ length: call.copiedSkills }, (_, i) => `b1:folder-${i}`)];
    events[0].slash_commands = ['ambient-command'];
    events[0].mcp_servers = call.configuration === 'loadout' ? [{ name: 'loadout', status: 'connected' }] : [];
    events[2].usage.input_tokens += call.copiedSkills * 10;
    return jsonl(...events);
  };
  const inspect = async (command: Command) => {
    const call = plan.calls.find((c) => c.command.cwd === command.cwd)!;
    return { discoveredSkills: call.copiedSkills + 1, discoveredPackSkills: call.copiedSkills, tools: call.configuration === 'loadout' ? ['find_tools', 'load_skill'] : [] };
  };
  return { run, inspect };
}

describe('overhead host events', () => {
  it('parses usage and init from fake Claude and Codex executables without retaining transcripts', async () => {
    const command = { bin: '', args: [], cwd: temp() };
    const c = parseClaude(await fake('claude', claude)(command));
    expect(c).toMatchObject({ input: 310, uncached: 10, cacheCreation: 100, cacheRead: 200, output: 1,
      inventory: { skills: ['b1-0000'], plugins: ['b1'], slashCommands: ['b1:command'], mcp: [{ name: 'loadout', status: 'connected' }] } });
    expect(parseCodex(await fake('codex', codex)(command))).toMatchObject({ input: 310, uncached: 110, cacheCreation: 0, cacheRead: 200, output: 1 });
    expect(JSON.stringify(c)).not.toContain('TRANSCRIPT');
    expect(c.modelUsage).toEqual({ 'haiku-resolved': { inputTokens: 10 }, 'another-model': { inputTokens: 2 } });
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

describe('round 2 validity', () => {
  it('preserves UTF-8 context when a fake executable splits a character across chunks', async () => {
    const cwd = temp();
    const file = join(cwd, 'codex.cjs');
    writeFileSync(file, "process.stdout.write(Buffer.from([0xc3])); setTimeout(()=>process.stdout.write(Buffer.from([0xa9])),100);");
    expect(await execute({ bin: process.execPath, args: [file], cwd })).toBe('é');
  });
  it('refuses enabled and misspelled disabled features', () => {
    expect(() => validateFeatures('hooks stable true', ['hooks'])).toThrow('hooks');
    expect(() => validateFeatures('hooks stable false', ['hookss'])).toThrow('hookss');
    expect(validateFeatures('hooks stable false', ['hooks'])).toEqual({ hooks: false });
  });
  it('sanitizes visible context, resolves roots, and detects AGENTS text without retaining it', () => {
    const cwd = temp();
    const context = `<skills_instructions>\n### Skill roots\n- \`r0\` = \`${cwd}/.agents/skills\`\n### Available skills\n- different-frontmatter-name: SECRET DESCRIPTION (file: r0/b1-0000/SKILL.md)\n</skills_instructions>\n# AGENTS.md instructions for ${cwd}\nSECRET AGENTS`;
    const extra = 'SECRET SECOND BLOCK';
    const visible = parsePromptInput(JSON.stringify([{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: context }, { type: 'input_text', text: extra }] }]), cwd);
    expect(visible).toMatchObject({ visibleSkills: 1, visiblePackSkills: 1, agentsPresent: true, renderedCharacters: context.length + 1 + extra.length });
    expect(visible.contextHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(visible)).not.toContain('SECRET');
    expect(() => parsePromptInput('{}', cwd)).toThrow();
  });
  it('rejects missing listing metadata before estimates and copies', () => {
    for (const host of ['claude', 'codex'] as const) {
      for (const body of ['no frontmatter', '---\nname: okay\n---\nBody', '---\nname: 42\ndescription: Text\n---\nBody', '---\nname: okay\ndescription: ""\n---\nBody']) {
        const source = temp();
        writeFileSync(join(source, 'SKILL.md'), body);
        const dest = temp();
        expect(copyPack([source], dest, host)).toMatchObject({ skills: 0, rejected: 1, characters: 0 });
        expect(readdirSync(dest)).toEqual([]);
      }
    }
  });
  // buildPlan copies the corpus into every arm.
  it('uses nested supersets of the validated corpus for cap arms', () => {
    const library = fixture();
    for (let i = 0; i < 20; i++) {
      const dir = join(library, 'skills', `extra-${i}`);
      mkdirSync(dir);
      writeFileSync(join(dir, 'SKILL.md'), `---\nname: extra-${i}\ndescription: Extra\n---\nBody`);
    }
    const plan = buildPlan(library, temp());
    const nested = plan.calls.filter((c) => c.host === 'codex' && c.repeat === 1 && (c.configuration.startsWith('cap-') || c.configuration === 'library')).sort((a, b) => a.copiedSkills - b.copiedSkills);
    expect(nested.map((c) => c.copiedSkills)).toEqual([16, 64, 73]);
    for (let i = 1; i < nested.length; i++) {
      const a = join(nested[i - 1]!.command.cwd, '.agents', 'skills');
      const b = join(nested[i]!.command.cwd, '.agents', 'skills');
      for (const name of readdirSync(a)) expect(readFileSync(join(a, name, 'SKILL.md'), 'utf8')).toBe(readFileSync(join(b, name, 'SKILL.md'), 'utf8'));
    }
    expect(plan.calls.length).toBeLessThanOrEqual(36);
  }, 60_000);
  it('saves offline Codex rows before paid calls despite refusal, without blocking Claude', async () => {
    const plan = buildPlan(fixture(), temp());
    const good = fakeStudy(plan);
    for (const failure of ['feature', 'tools', 'discovery', 'startup']) {
      const paid: string[] = [];
      const out = temp();
      const deps = {
        run: async (command: Command, host: 'claude' | 'codex') => {
          if (command.args.includes('-p') || command.args.includes('exec')) {
            paid.push(host);
            expect(readFileSync(join(out, 'preflight.jsonl'), 'utf8').trim().split('\n')).toHaveLength(8);
          }
          const output = await good.run(command, host);
          return failure === 'feature' && command.args.includes('features') ? output.replace('unified_exec stable false', 'unified_exec stable true') : output;
        },
        inspect: async (command: Command) => {
          if (failure === 'startup') throw new Error('startup failed');
          const result = await good.inspect(command);
          return failure === 'tools' ? { ...result, tools: [] } : failure === 'discovery' ? { ...result, discoveredPackSkills: 0 } : result;
        },
      };
      const { rows, offline } = await runStudy(plan, out, deps);
      expect(paid).toEqual(Array(14).fill('claude'));
      expect(rows).toHaveLength(14);
      expect(offline.size).toBe(8);
      const saved = readFileSync(join(out, 'preflight.jsonl'), 'utf8');
      const free = saved.trim().split('\n').map((line) => JSON.parse(line));
      expect(free.every((r) => r.renderedCharacters > 0 && r.contextHash)).toBe(true);
      expect(free.some((r) => r.refusals.length > 0)).toBe(true);
      if (failure === 'feature') expect(free.every((r) => r.discoveredSkills > 0 && r.refusals.join(' ').includes('unified_exec'))).toBe(true);
      expect(saved).not.toContain('SECRET');
      expect(summarize(rows, offline)).toContain('Codex paid calls deferred');
    }
  });
  it('requires positive Codex visibility and input deltas', async () => {
    const plan = buildPlan(fixture(), temp());
    const good = fakeStudy(plan);
    const offline = await preflight(plan, { ...good, run: (command, host) => command.cwd.endsWith('superpowers') && command.args.includes('prompt-input') ? good.run({ ...command, cwd: plan.calls.find((c) => c.host === 'codex' && c.configuration === 'baseline')!.command.cwd }, host) : good.run(command, host) });
    expect(offline.get('superpowers')!.refusals.join(' ')).toContain('visibility');
    await expect(runStudy(plan, temp(), { ...good, run: (command, host) => command.args.includes('exec') ? Promise.resolve(codex) : good.run(command, host) })).rejects.toThrow('input delta');
  });
  it('rejects Claude ambient plugin drift and labels omissions without claiming truncation', async () => {
    const plan = buildPlan(fixture(), temp());
    const good = fakeStudy(plan);
    await expect(runStudy(plan, temp(), { ...good, run: async (command, host) => {
      const output = await good.run(command, host);
      return host === 'claude' && command.cwd.endsWith('superpowers') ? output.replace('"name":"b1"', '"name":"unexpected"') : output;
    } })).rejects.toThrow('inventory drift');
    const { rows } = await runStudy(plan, temp(), { ...good, run: async (command, host) => {
      const output = await good.run(command, host);
      if (host !== 'claude') return output;
      const events = output.split('\n').map((s) => JSON.parse(s));
      if (command.cwd.endsWith('library')) events[0].skills = ['ambient', 'b1:one'];
      return jsonl(...events);
    } });
    expect(summarize(rows)).toContain('omitted, cause unverified');
    expect(summarize(rows)).not.toContain('Claude truncation');
  });
  it('rejects ambient skill, plugin, command and MCP inventory changes before saving a treatment row', async () => {
    const plan = buildPlan(fixture(), temp());
    const good = fakeStudy(plan);
    const mutations = [
      (init: any) => init.skills.push('new-account-skill'),
      (init: any) => { init.plugins = init.plugins.filter((p: any) => p.name !== 'ambient'); },
      (init: any) => init.slash_commands.push('new-account-command'),
      (init: any) => init.mcp_servers.push({ name: 'new-account-server', status: 'connected' }),
      (init: any) => { init.mcp_servers[0].status = 'failed'; },
    ];
    for (const mutate of mutations) {
      const out = temp();
      await expect(runStudy(plan, out, { ...good, run: async (command, host) => {
        const output = await good.run(command, host);
        if (host !== 'claude') return output;
        const events = output.split('\n').map((s) => JSON.parse(s));
        events[0].mcp_servers.push({ name: 'ambient-server', status: 'connected' });
        if (command.cwd.endsWith('superpowers')) mutate(events[0]);
        return jsonl(...events);
      } })).rejects.toThrow('inventory drift');
      const rows = readFileSync(join(out, 'rows.jsonl'), 'utf8').trim().split('\n').map((s) => JSON.parse(s));
      expect(rows.map((r) => r.configuration)).toEqual(['baseline', 'baseline']);
    }
  });
  it('accepts reordered ambient inventory and the declared b1 and loadout additions', async () => {
    const plan = buildPlan(fixture(), temp());
    const good = fakeStudy(plan);
    const { rows } = await runStudy(plan, temp(), { ...good, run: async (command, host) => {
      const output = await good.run(command, host);
      if (host !== 'claude') return output;
      const events = output.split('\n').map((s) => JSON.parse(s));
      events[0].skills.push('second-ambient-skill');
      events[0].plugins.push({ name: 'second-ambient-plugin' });
      events[0].slash_commands.push('second-ambient-command');
      events[0].mcp_servers.push({ name: 'ambient-server', status: 'connected' }, { name: 'second-ambient-server', status: 'connected' });
      if (!command.cwd.endsWith('baseline')) for (const field of ['skills', 'plugins', 'slash_commands', 'mcp_servers']) events[0][field].reverse();
      return jsonl(...events);
    } });
    expect(rows).toHaveLength(30);
    expect(summarize(rows)).toContain('Claude baseline: isolated CLI configuration');
    expect(summarize(rows)).toContain("Codex baseline: user's ambient setup");
  });
  it('runs the smallest Claude pack first and rejects zero discovery or either nonpositive paired delta before other packs', async () => {
    const library = fixture();
    const extra = join(library, 'skills', 'super-extra');
    mkdirSync(extra);
    writeFileSync(join(extra, 'SKILL.md'), '---\nname: extra\ndescription: Extra\n---\nBody');
    writeFileSync(join(extra, '.loadout-source.json'), JSON.stringify({ origin: 'obra/superpowers' }));
    const plan = buildPlan(library, temp());
    const good = fakeStudy(plan);
    for (const failure of ['discovery', 'first-delta', 'second-delta', 'later-discovery']) {
      const paid: string[] = [];
      const out = temp();
      await expect(runStudy(plan, out, { ...good, run: async (command, host) => {
        const output = await good.run(command, host);
        if (host !== 'claude') return output;
        const arm = plan.calls.find((c) => c.command.cwd === command.cwd)!;
        paid.push(arm.configuration);
        const events = output.split('\n').map((s) => JSON.parse(s));
        if ((failure === 'discovery' && arm.configuration === 'anthropics') || (failure === 'later-discovery' && arm.configuration === 'superpowers')) events[0].skills = ['ambient'];
        if (arm.configuration === 'anthropics' && ((failure === 'first-delta' && paid.length === 3) || (failure === 'second-delta' && paid.length === 4))) events[2].usage.input_tokens = 10;
        return jsonl(...events);
      } })).rejects.toThrow(failure.endsWith('discovery') ? 'discovery' : 'input delta');
      expect(paid.slice(0, 3)).toEqual(['baseline', 'baseline', 'anthropics']);
      if (failure !== 'later-discovery') expect(paid).not.toContain('superpowers');
      const rows = readFileSync(join(out, 'rows.jsonl'), 'utf8').trim().split('\n').map((s) => JSON.parse(s));
      expect(rows).toHaveLength(paid.length - 1);
    }
  });
  it('a required Codex MCP startup failure cannot produce a loadout row', async () => {
    const plan = buildPlan(fixture(), temp());
    const good = fakeStudy(plan);
    const out = temp();
    await expect(runStudy(plan, out, { ...good, run: (command, host) => host === 'codex' && command.args.includes('exec') && command.cwd.endsWith('loadout') ? Promise.resolve(jsonl({ type: 'turn.failed' })) : good.run(command, host) })).rejects.toThrow('failed');
    expect(readFileSync(join(out, 'rows.jsonl'), 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s)).some((r) => r.host === 'codex' && r.configuration === 'loadout')).toBe(false);
  });
  it('queries Codex discovery and MCP inventory through the model-free app-server protocol', async () => {
    const cwd = temp();
    const file = join(cwd, 'codex.cjs');
    writeFileSync(file, `const rl=require('readline').createInterface({input:process.stdin});rl.on('line',line=>{const r=JSON.parse(line);if(r.id===undefined)return;const result=r.method==='initialize'?{}:r.method==='skills/list'?{data:[{cwd:${JSON.stringify(cwd)},skills:[{path:${JSON.stringify(join(cwd, '.agents', 'skills', 'b1-0000', 'SKILL.md'))},enabled:true}],errors:[]}]}:r.method==='mcpServerStatus/list'?{data:[{name:'loadout',tools:{a:{name:'find_tools'},b:{name:'load_skill'}}}],nextCursor:null}:null;if(result===null)throw Error('Unexpected request');console.log(JSON.stringify({id:r.id,result}));});`);
    expect(await inspectCodex({ bin: process.execPath, args: [file], cwd })).toMatchObject({ discoveredPackSkills: 1, tools: ['find_tools', 'load_skill'] });
  });
});

describe('text-only configurations', () => {
  it('copies only valid SKILL.md, excluding commands, agents, hooks, scripts and links', () => {
    const source = temp();
    for (const dir of ['commands', 'agents', 'hooks', 'scripts']) mkdirSync(join(source, dir));
    for (const file of ['SKILL.md', 'reference.md', 'commands/run.md', 'agents/review.md', 'hooks/hook.md', 'scripts/run.js', '.mcp.json']) writeFileSync(join(source, file), 'text </skill>');
    writeFileSync(join(source, 'SKILL.md'), '---\nname: valid\ndescription: Listed </skill>\n---\nText </skill>');
    const outside = temp();
    writeFileSync(join(outside, 'SKILL.md'), 'outside');
    symlinkSync(outside, join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const destination = temp();
    const count = copyPack([source], destination, 'claude');
    expect(count.skills).toBe(1);
    expect(readdirSync(join(destination, 'skills', 'b1-0000'))).toEqual(['SKILL.md']);
    expect(existsSync(join(destination, 'hooks'))).toBe(false);
    expect(readFileSync(join(destination, 'skills', 'b1-0000', 'SKILL.md'), 'utf8')).toContain('&lt;/skill>');
    expect(existsSync(join(destination, 'commands'))).toBe(false);
    expect(existsSync(join(destination, 'agents'))).toBe(false);
    expect(readFileSync(join(destination, 'skills', 'b1-0000', 'SKILL.md'), 'utf8')).toContain('third-party');
    const codexDest = temp();
    copyPack([source], codexDest, 'codex');
    expect(existsSync(join(codexDest, '.agents', 'skills', 'b1-0000', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(codexDest, 'commands'))).toBe(false);
  });
  it('constructs paired arms under temp dirs, shares Codex settings, requires MCP, and accepts rank gaps', () => {
    const root = temp();
    const plan = buildPlan(fixture(), root);
    expect(plan.calls).toHaveLength(30);
    expect(plan.blockers).toEqual([]);
    expect(plan.calls.filter((c) => c.model === 'default')).toHaveLength(0);
    for (const c of plan.calls) {
      expect(relative(root, c.command.cwd).startsWith('..')).toBe(false);
      expect(c.command.args.join(' ')).not.toContain(join(homedir(), '.claude'));
      expect(c.command.args.join(' ')).not.toContain(join(homedir(), '.codex'));
    }
    expect(plan.calls[0]!.command).toEqual(plan.calls[1]!.command);
    const codexCall = plan.calls.find((c) => c.host === 'codex')!;
    for (const command of [codexCall.command, ...Object.values(codexCall.free!)]) {
      expect(command.args).toContain('hooks');
      expect(command.args).not.toContain('plugin_hooks');
      expect(command.args).not.toContain('js_repl');
      expect(command.args.filter((a) => a.startsWith('mcp_servers=') || a.startsWith('model=') || a.startsWith('sandbox_mode='))).toEqual(codexCall.command.args.filter((a) => a.startsWith('mcp_servers=') || a.startsWith('model=') || a.startsWith('sandbox_mode=')));
    }
    expect(plan.calls.find((c) => c.host === 'codex' && c.configuration === 'loadout')!.command.args.join(' ')).toContain('"required" = true');
    expect(plan.calls.find((c) => c.host === 'claude')!.command.args).toContain('--strict-mcp-config');
    expect(plan.calls.find((c) => c.host === 'claude')!.command.args).toContain('Skill');
    expect(plan.calls.find((c) => c.host === 'claude')!.command.args).toContain('--restricted');
    expect(plan.calls.find((c) => c.host === 'claude')!.command.args).toContain('--setting-sources');
    expect(existsSync(join(root, 'auth.json'))).toBe(false);
    expect(plan.calls.find((c) => c.configuration === 'top50')!.copiedSkills).toBe(50);
    expect(() => buildPlan(fixture(), join(homedir(), '.codex', 'overhead'))).toThrow('temporary');
  });
  it('does not follow linked skills, provenance, command folders or destination junctions', () => {
    const library = fixture();
    const outside = temp();
    writeFileSync(join(outside, 'SKILL.md'), 'outside');
    symlinkSync(outside, join(library, 'skills', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const plan = buildPlan(library, temp());
    expect(plan.calls.find((c) => c.configuration === 'library')!.copiedSkills).toBe(53);
    const source = join(library, 'skills', 'super');
    symlinkSync(outside, join(source, 'commands'), process.platform === 'win32' ? 'junction' : 'dir');
    const destination = temp();
    copyPack([source], destination, 'claude');
    expect(existsSync(join(destination, 'commands'))).toBe(false);
    const redirected = temp();
    symlinkSync(homedir(), join(redirected, 'skills'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => copyPack([source], redirected, 'claude')).toThrow('temporary');
    expect(readFileSync(join(outside, 'SKILL.md'), 'utf8')).toBe('outside');
  });
  it('removes inline hooks from skill frontmatter', () => {
    const source = temp();
    const markdown = '---\nname: inline-hook\ndescription: Listed description\nhooks:\n  SessionStart:\n    - hooks:\n        - type: command\n          command: echo EXECUTABLE-HOOK\n---\nNormal body.';
    writeFileSync(join(source, 'SKILL.md'), markdown);
    const destination = temp();
    copyPack([source], destination, 'claude');
    for (const path of ['skills/b1-0000/SKILL.md']) {
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
    await expect(runStudy(plan, temp(), { run: async () => { calls++; return claude; } })).rejects.toThrow('preflight');
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
      expect((await client.listTools()).tools.map((t) => t.name)).toEqual(['find_tools', 'load_skill']);
    } finally {
      await client.close();
    }
  });
  it('--plan distinguishes 14 Claude calls from 16 gated Codex calls and makes no host call', async () => {
    const printed: string[] = [];
    let calls = 0;
    await main(['--plan', '--library', fixture()], { print: (s) => printed.push(s), run: async () => { calls++; throw new Error('called'); } });
    expect(calls).toBe(0);
    const output = printed.join('\n');
    const plannedRoot = printed.find((s) => s.startsWith('temp root: '))!.slice('temp root: '.length);
    temps.push(plannedRoot);
    expect(output).toContain('Claude: 14 paid calls; Codex: 0 while deferred');
    expect(output).toContain('16 conditional Codex calls');
    expect(output).toContain('cwd=');
    expect(output).toContain('stream-json');
    expect(output).toContain('Cost computed in analysis');
    expect(output).toContain('FREE');
  });
  it('writes only raw metrics, keeps observed cache counts, and labels baseline uncertainty', async () => {
    const plan = buildPlan(fixture(), temp());
    const out = temp();
    const { rows, offline } = await runStudy(plan, out, fakeStudy(plan));
    const raw = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    expect(raw).not.toContain('TRANSCRIPT');
    expect(raw).not.toContain('thread_id');
    expect(rows).toHaveLength(30);
    expect(rows[1]!.cacheRead).toBe(200);
    expect(summarize(rows)).toContain("user's ambient setup");
    expect(summarize(rows, offline)).toContain('nested');
    expect(rows.find((r) => r.host === 'claude' && r.configuration === 'superpowers')!.discoveredPackSkills).toBe(1);
    const free = readFileSync(join(out, 'preflight.jsonl'), 'utf8');
    expect(raw + free).not.toContain('SECRET');
    expect(rows.find((r) => r.host === 'codex')!.agentsPresent).toBe(true);
  });
});
