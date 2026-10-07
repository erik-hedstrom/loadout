import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudeHookBlock } from '../src/launch.js';

const ROOT = join(import.meta.dirname, '..');

describe('Claude Code plugin', () => {
  it('ships the same hook block as the settings snippet, running loadout from PATH', () => {
    const hooks = JSON.parse(readFileSync(join(ROOT, 'plugins/loadout/hooks/hooks.json'), 'utf8'));
    expect(hooks).toEqual(claudeHookBlock('loadout hook claude'));
  });

  it('ships a hook-only marketplace plugin', () => {
    const marketplace = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
    expect(marketplace.name).toBe('loadout');
    expect(marketplace.plugins).toHaveLength(1);
    const entry = marketplace.plugins[0];
    expect(entry.name).toBe('loadout');
    expect(entry.source).toBe('./plugins/loadout');
    const dir = join(ROOT, entry.source);
    const plugin = JSON.parse(readFileSync(join(dir, '.claude-plugin/plugin.json'), 'utf8'));
    expect(plugin.name).toBe('loadout');
    for (const key of ['version', 'mcpServers', 'userConfig']) expect(plugin).not.toHaveProperty(key);
    expect(existsSync(join(dir, 'bin'))).toBe(false);
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
  });
});
