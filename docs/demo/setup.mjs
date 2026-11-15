import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readConfined } from '../../dist/library.js';

const { A5_ROOT: root, A5_RUN: run, A5_REPO: repo, A5_NODE: node, A5_LIBRARY_DIR: source } = process.env;
const home = join(root, 'home');
const code = join(root, 'code');
const runtime = join(run, 'runtime');
const loadout = join(home, 'loadout');
const claude = join(home, 'claude');
const bin = join(runtime, 'bin');
const plugin = join(runtime, 'plugin');
for (const dir of [bin, join(runtime, 'work'), join(home, 'work'), claude, join(home, 'codex')]) mkdirSync(dir, { recursive: true });

// These real manifests are data only; no downloaded scripts or references are copied or run.
const installed = [
  'canvas-design', 'docx', 'frontend-design', 'mcp-builder', 'pdf', 'pptx', 'webapp-testing', 'xlsx',
  'ai-podcast-creation', 'managed-airflow-dag-authoring', 'use-js-interop', 'nextflow-development',
  'chatgpt-apps', 'compose-outreach', 'zoom-general', 'azure-validate', 'clinical-decision-support',
  'migrate-dotnet8-to-dotnet9', 'handle-objection', 'setup-zoom-webhooks', 'social-content-engine',
  'linear', 'qutip', 'speech-to-text',
];
const hashes = [];
for (const name of [...installed, 'obsidian-markdown']) {
  let text;
  try { text = readConfined(resolve(source, name), 'SKILL.md'); }
  catch { throw new Error(`Cannot copy the required ${name} manifest.`); }
  hashes.push(`${createHash('sha256').update(text).digest('hex')}  ${name}/SKILL.md`);
  for (const base of [join(loadout, 'library', 'skills'), ...(installed.includes(name) ? [join(claude, 'skills')] : [])]) {
    mkdirSync(join(base, name), { recursive: true });
    writeFileSync(join(base, name, 'SKILL.md'), text);
  }
}
writeFileSync(join(run, 'skills.sha256'), `${hashes.join('\n')}\n`);
// No key is read here. Only loadout's resolveApiKey may open the supplied file in paid mode.
writeFileSync(join(loadout, 'config.json'), JSON.stringify({
  embeddings: false,
  ...(process.env.A5_MODE === 'paid' ? { jev: { apiKeyFile: process.env.A5_JEV_KEY_FILE } } : { router: 'lexical' }),
}) + '\n', { mode: 0o600 });
writeFileSync(join(claude, 'settings.json'), JSON.stringify({
  permissions: { allow: ['mcp__plugin_loadout_loadout__load_skill', 'mcp__plugin_loadout_loadout__find_tools'] },
}) + '\n');

// Same WSL bridge as bench/invoke.ts: Windows starts a WSL node for the shipped server.
// The plugin hooks and metadata are copied unchanged from this checkout.
cpSync(join(repo, 'plugins', 'loadout'), plugin, { recursive: true });
const fixed = [`HOME=${home}`, `LOADOUT_HOME=${loadout}`];
const bridge = ['-d', process.env.WSL_DISTRO_NAME, '--exec', '/usr/bin/env', ...fixed, node, join(code, 'dist', 'cli.js')];
writeFileSync(join(plugin, '.mcp.json'), JSON.stringify({ mcpServers: { loadout: {
  command: 'wsl.exe', args: [...bridge, 'mcp', '--windows-paths'],
} } }, null, 2) + '\n');

const quote = (s) => `'${s.replaceAll("'", "'\\''")}'`;
// Git Bash rewrites single-slash absolute arguments before invoking a Windows executable.
const bashBridge = bridge.map((s) => s.replace(/^((?:--)?[A-Za-z_][\w-]*=)?\/(?!\/)/, '$1//'));
// Linux audit and Git Bash's Windows hook resolve the same command name.
writeFileSync(join(bin, 'loadout'), `#!/bin/sh\ncase "$(uname -s)" in\n  *MINGW*|*MSYS*) exec wsl.exe ${bashBridge.map(quote).join(' ')} "$@" --windows-paths ;;\n  *) exec ${quote(node)} ${quote(join(code, 'dist', 'cli.js'))} "$@" ;;\nesac\n`, { mode: 0o700 });
// Paths are translated only in --plugin-dir. The recording displays a relative public path.
writeFileSync(join(runtime, 'windows-plugin.txt'), execFileSync('wslpath', ['-w', plugin], { encoding: 'utf8' }).trim());
