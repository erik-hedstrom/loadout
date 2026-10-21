import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.js';
import { doctor, onPath } from '../src/doctor.js';
import { detectHosts } from '../src/init.js';
import { launch, which } from '../src/launch.js';

const BATCH_REFUSAL = "Cannot safely pass these arguments to a Windows batch host. Install the host's native .exe or enter the prompt inside the session.";

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'loadout-launch-'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

it('still finds an extensionless executable', () => {
  const bin = join(home, 'host');
  writeFileSync(bin, '');
  chmodSync(bin, 0o755);
  expect(which('host', [home])).toBe(bin);
  expect(which('missing', [home])).toBeUndefined();
});

it.skipIf(process.platform === 'win32')('does not apply PATHEXT on POSIX', () => {
  vi.stubEnv('PATHEXT', '.EXE');
  const bin = join(home, 'host.exe');
  writeFileSync(bin, '');
  chmodSync(bin, 0o755);
  expect(which('host', [home])).toBeUndefined();
});

describe.skipIf(process.platform !== 'win32')('Windows host commands', () => {
  it.each(['doctor', 'launch'])('does not run cwd node.cmd through a trusted batch host (%s)', (caller) => {
    const trusted = join(home, 'trusted');
    const project = join(home, 'project');
    mkdirSync(trusted);
    mkdirSync(project);
    copyFileSync(process.execPath, join(trusted, 'node.exe'));
    writeFileSync(join(trusted, 'claude.cmd'), '@echo off\r\nnode "%~dp0capture.cjs" %*\r\n');
    writeFileSync(join(trusted, 'capture.cjs'), 'require("node:fs").writeFileSync(__dirname + "/seen.json", JSON.stringify({args: process.argv.slice(2), key: process.env.TYPESAFE_API_KEY, callerEnv: process.env.LOADOUT_TEST_ENV})); console.log("trusted-node-version");');
    writeFileSync(join(project, 'node.cmd'), '@echo off\r\necho PLANTED_NODE_RAN>planted-marker\r\necho PLANTED_NODE_RAN\r\n');
    const module = (name: string) => JSON.stringify(pathToFileURL(join(import.meta.dirname, `../src/${name}.ts`)).href);
    const script = caller === 'doctor'
      ? `import {doctor} from ${module('doctor')}; import {DEFAULT_CONFIG} from ${module('config')}; console.log(JSON.stringify(await doctor({...DEFAULT_CONFIG, router: 'lexical', embeddings: false}, () => {throw new Error('unexpected Jev call')})));`
      : `import {launch, which} from ${module('launch')}; process.exitCode = await launch(which('claude'), ['plain task'], {headless: true});`;
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'nodefaultcurrentdirectoryinexepath'));
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', script], {
      cwd: project, encoding: 'utf8', timeout: 20_000,
      env: { ...env, PATH: trusted, PATHEXT: '.CMD;.EXE;.BAT;.COM',
        LOADOUT_HOME: join(home, 'loadout'), CLAUDE_CONFIG_DIR: join(home, 'claude-config'), CODEX_HOME: join(home, 'codex-config'),
        TYPESAFE_API_KEY: 'caller-key-canary', LOADOUT_TEST_ENV: 'caller-env-canary' },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(project, 'planted-marker'))).toBe(false);
    expect(result.stdout).toContain('trusted-node-version');
    const seen = JSON.parse(readFileSync(join(trusted, 'seen.json'), 'utf8'));
    expect(seen).toEqual(caller === 'doctor' ? { args: ['--version'] } : { args: ['plain task'], key: 'caller-key-canary', callerEnv: 'caller-env-canary' });
  });

  it.each([
    ['codex', '.cmd', 'fix tests', []],
    ['codex', '.bat', 'fix tests', []],
    ['claude', '.cmd', 'private-canary\nnext line', []],
    ['claude', '.bat', 'fix tests', ['--', 'private-canary&value']],
  ] as const)('refuses predictable %s%s input before Jev or session writes (%#)', async (agent, ext, task, extra) => {
    const loadout = join(home, 'loadout');
    mkdirSync(loadout);
    cpSync(join(import.meta.dirname, 'fixtures/library'), join(loadout, 'library'), { recursive: true });
    writeFileSync(join(loadout, 'config.json'), JSON.stringify({ embeddings: false }));
    writeFileSync(join(home, `${agent}${ext}`), '@echo off\r\nexit /b 0\r\n');
    const fakeClient = vi.fn();
    const server = createServer((req, res) => { fakeClient(); req.resume(); res.writeHead(400).end('fake Jev must not be called'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    try {
      const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', join(import.meta.dirname, '../src/cli.ts'), agent, task, ...extra], {
          stdio: ['ignore', 'ignore', 'pipe'], timeout: 20_000,
          env: { ...process.env, PATH: home, PATHEXT: '.COM;.EXE;.BAT;.CMD', LOADOUT_HOME: loadout,
            TYPESAFE_API_KEY: 'fake-jev-key', TYPESAFE_BASE_URL: `http://127.0.0.1:${address.port}` },
        });
        let stderr = '';
        child.stderr!.on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stderr }));
      });
      expect(fakeClient).not.toHaveBeenCalled();
      expect(existsSync(join(loadout, 'sessions'))).toBe(false);
      expect(result).toEqual({ code: 1, stderr: `loadout: ${BATCH_REFUSAL}\n` });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  });

  it.each(['.exe', '.cmd'])('finds a host installed only as %s for init and doctor', async (ext) => {
    const bin = join(home, `claude${ext}`);
    if (ext === '.exe') copyFileSync(process.execPath, bin);
    else writeFileSync(bin, '@echo off\r\necho host-version %TYPESAFE_API_KEY% %GITHUB_TOKEN%\r\n');
    vi.stubEnv('PATH', home);
    vi.stubEnv('PATHEXT', '.COM;.EXE;.BAT;.CMD');
    vi.stubEnv('LOADOUT_HOME', join(home, 'loadout'));
    vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, 'claude-config'));
    vi.stubEnv('CODEX_HOME', join(home, 'codex-config'));
    vi.stubEnv('TYPESAFE_API_KEY', 'doctor-key-canary');
    vi.stubEnv('GITHUB_TOKEN', 'doctor-token-canary');
    expect(which('claude')).toBe(bin);
    expect(onPath('claude')).toBe(bin);
    expect(detectHosts(onPath)).toEqual(['claude-code']);
    // No real client or key is needed for host detection.
    const checks = await doctor({ ...DEFAULT_CONFIG, router: 'lexical', embeddings: false }, () => { throw new Error('unexpected Jev call'); });
    expect(checks.find((c) => c.name === 'Claude Code')?.detail).toMatch(ext === '.cmd' ? /^host-version;/ : /^v\d/);
    expect(JSON.stringify(checks)).not.toContain('canary');
  });

  it('honours PATH order, PATHEXT order and explicit extensions', () => {
    const second = join(home, 'second');
    mkdirSync(second);
    for (const file of ['host.exe', 'host.cmd', 'host.exe.cmd']) writeFileSync(join(home, file), '');
    writeFileSync(join(second, 'host.com'), '');
    vi.stubEnv('PATHEXT', '.CMD;.EXE;.COM');
    expect(which('host', [home, second])).toBe(join(home, 'host.cmd'));
    expect(which('host.exe', [home])).toBe(join(home, 'host.exe'));
    vi.stubEnv('PATHEXT', '.COM;.EXE;.CMD');
    expect(which('host', [home, second])).toBe(join(home, 'host.exe'));
    writeFileSync(join(home, 'host.custom'), '');
    vi.stubEnv('PATHEXT', '.CUSTOM');
    expect(which('host', [home])).toBe(join(home, 'host.custom'));
  });

  it.each(['.com', '.exe', '.bat', '.cmd'])('uses default PATHEXT for %s', (ext) => {
    vi.stubEnv('PATHEXT', undefined);
    writeFileSync(join(home, `host${ext}`), '');
    expect(which('host', [home])).toBe(join(home, `host${ext}`));
  });

  it('prefers a Windows command over an npm-style extensionless shell shim', () => {
    vi.stubEnv('PATHEXT', '.EXE;;.CMD');
    writeFileSync(join(home, 'host'), '#!/bin/sh\n');
    writeFileSync(join(home, 'host.cmd'), '');
    expect(which('host', [home])).toBe(join(home, 'host.cmd'));
  });

  it('keeps doctor from resolving relative PATH entries', () => {
    const planted = join(home, 'planted');
    const real = join(home, 'real');
    mkdirSync(planted);
    mkdirSync(real);
    writeFileSync(join(planted, 'host.exe'), '');
    writeFileSync(join(real, 'host.cmd'), '');
    vi.stubEnv('PATH', [relative(process.cwd(), planted), real].join(delimiter));
    expect(onPath('host')).toBe(join(real, 'host.cmd'));
  });

  function shim(ext: string) {
    const bin = join(home, `host shim (x86)${ext}`);
    const capture = join(home, 'capture.cjs');
    vi.stubEnv('LOADOUT_TEST_ARGV', join(home, 'argv.json'));
    writeFileSync(capture, 'require("node:fs").writeFileSync(process.env.LOADOUT_TEST_ARGV, JSON.stringify(process.argv.slice(2)));');
    writeFileSync(bin, `@echo off\r\n"${process.execPath}" "${capture}" %*\r\n`);
    return bin;
  }

  it.each(['.cmd', '.bat'])('launches %s with plain arguments verbatim', async (ext) => {
    shim(ext);
    // A PATH-controlled interpreter must not replace the system cmd.exe.
    copyFileSync(process.execPath, join(home, 'cmd.exe'));
    vi.stubEnv('PATH', home);
    const bin = which('host shim (x86)')!;
    const args = ['plain task', '', '--model', 'host-1.2', 'C:\\some folder\\file', 'a_b/c:d=e+f,g@h'];
    expect(await launch(bin, args, { headless: true })).toBe(0);
    expect(JSON.parse(readFileSync(join(home, 'argv.json'), 'utf8'))).toEqual(args);
  });

  const unsupported = ['a\nb', 'a\rb', 'a\n', '%LOADOUT_TEST_VAR%', 'a"b', '&', '|', '<', '>', '^', '!', '(x)', '\t', '*', '?', ';', '`', 'C:\\trailing\\', 'pasted-key-canary\n&echo injected'];
  it.each(unsupported)('refuses unsupported batch input without starting the shim (%#)', async (arg) => {
    const bin = shim('.cmd');
    await expect(launch(bin, [arg], { headless: true })).rejects.toEqual(new Error(BATCH_REFUSAL));
    expect(existsSync(join(home, 'argv.json'))).toBe(false);
  });

  it('refuses a batch command exceeding the cmd.exe length limit', async () => {
    await expect(launch(shim('.bat'), ['a'.repeat(8191)], { headless: true })).rejects.toEqual(new Error(BATCH_REFUSAL));
    expect(existsSync(join(home, 'argv.json'))).toBe(false);
  });

  it('refuses a NUL byte before passing arguments to cmd.exe', async () => {
    await expect(launch(shim('.cmd'), ['a\0b'], { headless: true })).rejects.toEqual(new Error(BATCH_REFUSAL));
  });

  it.each(['%', '!', '&', '^'])('refuses unsafe batch paths without echoing their content (%#)', async (char) => {
    const bin = join(home, `private-path-canary${char}.cmd`);
    writeFileSync(bin, '@echo off\r\nexit /b 0\r\n');
    await expect(launch(bin, ['plain'], { headless: true })).rejects.toEqual(new Error(BATCH_REFUSAL));
  });

  it.each(['.exe', '.com'])('passes the same metacharacters unchanged to a native %s', async (ext) => {
    const bin = join(home, `host${ext}`);
    copyFileSync(process.execPath, bin);
    vi.stubEnv('PATH', home);
    const capture = join(home, 'capture.cjs');
    const out = join(home, 'native-argv.json');
    writeFileSync(capture, 'require("node:fs").writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)));');
    expect(await launch(which('host')!, [capture, out, ...unsupported], { headless: true })).toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(unsupported);
  });
});
