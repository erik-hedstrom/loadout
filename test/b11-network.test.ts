import { afterEach, describe, expect, it, vi } from 'vitest';
import * as cp from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect, createServer, type Server } from 'node:net';
import { createSocket } from 'node:dgram';
import { setTimeout as delay } from 'node:timers/promises';
import { HarnessError } from '../bench/b11-errors.js';
import { executeSandbox, requireNetwork, sandboxCheck, SANDBOX_NODE } from '../bench/b11-sandbox.js';

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof cp>();
  return { ...actual, spawn: vi.fn(actual.spawn), spawnSync: vi.fn(actual.spawnSync) };
});
const realCp = await vi.importActual<typeof cp>('node:child_process');
const pastaMissing = process.platform === 'linux' && (realCp.spawnSync('pasta', ['--version'], { env: { PATH: '/usr/bin:/bin' }, stdio: 'ignore' }).error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
const MISSING_PASTA = 'pasta (passt) not installed; CI installs passt';

const roots: string[] = [];
const sandbox = () => {
  const root = mkdtempSync(join(tmpdir(), 'b11-network-')); roots.push(root);
  const home = join(root, 'home'), workspace = join(root, 'work');
  mkdirSync(home); mkdirSync(workspace);
  return { home, workspace, binary: '/usr/bin/true' };
};
afterEach(() => {
  vi.mocked(cp.spawn).mockReset().mockImplementation(realCp.spawn);
  vi.mocked(cp.spawnSync).mockReset().mockImplementation(realCp.spawnSync);
  roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true }));
});

describe.runIf(process.platform === 'linux')('B11 network dependency and preflight diagnostics', () => {
  it('pairs DNS-only forwarding with a read-only resolver file and removes it after exit', async () => {
    let resolver = '';
    vi.mocked(cp.spawn).mockImplementation((...args: Parameters<typeof cp.spawn>) => {
      expect(args[0]).toBe('pasta');
      const argv = args[1] as string[];
      const address = argv[argv.indexOf('--dns-forward') + 1];
      expect(address).toBe('169.254.1.1');
      const mount = argv.indexOf('/etc/resolv.conf');
      expect(argv[mount - 2]).toBe('--ro-bind');
      resolver = argv[mount - 1]!;
      expect(readFileSync(resolver, 'utf8')).toBe(`nameserver ${address}\n`);
      expect(argv).toContain('--no-map-gw');
      for (const flag of ['-t', '-u', '-T', '-U']) expect(argv[argv.indexOf(flag) + 1]).toBe('none');
      return realCp.spawn(process.execPath, ['-e', 'process.exit(0)']);
    });
    const run = await executeSandbox(sandbox(), [SANDBOX_NODE, '--version'], 5000);
    expect(run.code, run.stderr).toBe(0);
    expect(existsSync(resolver)).toBe(false);
  });
  it('requires pasta without falling back to the host network', async () => {
    vi.mocked(cp.spawnSync).mockReturnValue({ status: null, error: Object.assign(new Error('missing'), { code: 'ENOENT' }), pid: 0, output: [], stdout: '', stderr: '', signal: null });
    expect(() => requireNetwork()).toThrow(/pasta.*passt.*required/i);
    expect(() => requireNetwork()).toThrow(HarnessError);
    vi.mocked(cp.spawn).mockImplementation((...args: Parameters<typeof cp.spawn>) => realCp.spawn('b11-deliberately-missing-pasta', args[1], args[2]));
    await expect(executeSandbox(sandbox(), ['/usr/bin/true'], 5000)).rejects.toThrow(/pasta.*passt.*required/i);
    await expect(executeSandbox(sandbox(), ['/usr/bin/true'], 5000)).rejects.toBeInstanceOf(HarnessError);
  });

  it('rejects a pasta installation that cannot execute', () => {
    vi.mocked(cp.spawnSync).mockReturnValue({ status: 1, pid: 0, output: [], stdout: '', stderr: '', signal: null });
    expect(() => requireNetwork()).toThrow(/pasta.*passt.*required/i);
  });

  it('reports trusted bubblewrap startup stderr', async () => {
    vi.mocked(cp.spawn).mockImplementation(() => realCp.spawn(process.execPath, ['-e', 'console.error("bwrap: uid map failed: Operation not permitted");process.exit(1)']));
    const failed = sandboxCheck('/usr/bin/true');
    await expect(failed).rejects.toBeInstanceOf(HarnessError);
    await expect(failed).rejects.toThrow('bwrap: uid map failed: Operation not permitted');
  });

  it('does not promote command stderr after the preflight script starts', async () => {
    vi.mocked(cp.spawn).mockImplementation(() => realCp.spawn(process.execPath, ['-e', 'console.log("B11_PREFLIGHT_STARTED");console.error("untrusted command text");process.exit(1)']));
    try { await sandboxCheck('/usr/bin/true'); throw new Error('expected preflight failure'); }
    catch (error) {
      expect((error as Error).message).toContain('sandbox preflight failed');
      expect((error as Error).message).not.toContain('untrusted command text');
    }
  });
});

const listen = async (server: Server, port = 0): Promise<number> => {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return (server.address() as { port: number }).port;
};
const close = (server: Server) => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

describe.runIf(process.platform === 'linux')('B11 real pasta namespace', () => {
  it('resolves through a host loopback DNS server without mapping its other TCP or UDP ports', ctx => {
    if (pastaMissing) { ctx.skip(MISSING_PASTA); return; }
    const s = sandbox(), resolver = join(s.home, 'host-resolv.conf');
    writeFileSync(resolver, 'nameserver 127.0.0.54\n');
    const inner = `const dns=require('node:dns').promises,fs=require('node:fs'),assert=require('node:assert/strict'),net=require('node:net'),dgram=require('node:dgram');
      const port=Number(process.argv[1]),address=fs.readFileSync('/etc/resolv.conf','utf8').match(/^nameserver (.+)$/m)[1];
      assert.throws(()=>fs.writeFileSync('/etc/resolv.conf','tampered'),{code:'EROFS'});
      const tcp=()=>new Promise(resolve=>{let text='';const c=net.connect(port,address);c.setTimeout(300,()=>c.destroy());c.on('data',b=>text+=b);c.on('error',()=>{});c.on('close',()=>resolve(text))});
      const udp=()=>new Promise(resolve=>{const c=dgram.createSocket('udp4'),timer=setTimeout(()=>{c.close();resolve('')},300);c.on('message',b=>{clearTimeout(timer);c.close();resolve(b.toString())});c.send('probe',port,address)});
      (async()=>{assert.deepEqual(await dns.resolve4('b11.test'),['192.0.2.11']);assert.equal((await dns.lookup('b11.test',{family:4})).address,'192.0.2.11');
        assert.deepEqual(await Promise.all([tcp(),udp()]),['','']);console.log('dns-only-ok')})().catch(e=>{console.error(e);process.exit(1)});`;
    const module = new URL('../bench/b11-sandbox.ts', import.meta.url).href;
    const fixture = `import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createSocket} from 'node:dgram';import {createServer} from 'node:net';
      import {executeSandbox,SANDBOX_NODE} from ${JSON.stringify(module)};
      for(const args of [['link','set','lo','up'],['link','add','eth0','type','dummy'],['addr','add','192.0.2.1/24','dev','eth0'],['link','set','eth0','up'],['route','add','default','via','192.0.2.254','dev','eth0']])execFileSync('ip',args);
      const dns=createSocket('udp4'),udp=createSocket('udp4'),tcp=createServer(socket=>socket.end('unrelated-tcp'));
      dns.on('message',(query,remote)=>{let end=12;while(query[end])end+=query[end]+1;const answer=query.readUInt16BE(end+1)===1,header=Buffer.alloc(12);
        query.copy(header,0,0,2);header.writeUInt16BE(0x8180,2);header.writeUInt16BE(1,4);header.writeUInt16BE(answer?1:0,6);
        dns.send(Buffer.concat([header,query.subarray(12,end+5),...(answer?[Buffer.from('c00c000100010000003c0004c000020b','hex')]:[])]),remote.port,remote.address)});
      udp.on('message',(_,remote)=>udp.send('unrelated-udp',remote.port,remote.address));
      await new Promise((resolve,reject)=>{dns.once('error',reject);dns.bind(53,'127.0.0.54',resolve)});
      await new Promise((resolve,reject)=>{tcp.once('error',reject);tcp.listen(0,'127.0.0.54',resolve)});
      const port=tcp.address().port;
      await new Promise((resolve,reject)=>{udp.once('error',reject);udp.bind(port,'127.0.0.54',resolve)});
      try{const run=await executeSandbox(${JSON.stringify(s)},[SANDBOX_NODE,'-e',${JSON.stringify(inner)},String(port)],10000);
        assert.equal(run.code,0,run.stderr);assert.match(run.stdout,/dns-only-ok/);console.log('dns-only-ok');
      }finally{dns.close();udp.close();tcp.close()}`;
    // DNS needs privileged port 53. Give the trusted fixture that capability
    // only in its own user/network namespace, with no host network or sysctl edits.
    const run = realCp.spawnSync('bwrap', [
      '--unshare-all', '--uid', '0', '--gid', '0', '--cap-add', 'CAP_NET_ADMIN', '--cap-add', 'CAP_NET_BIND_SERVICE',
      '--bind', '/', '/', '--proc', '/proc', '--dev', '/dev', '--ro-bind', resolver, '/etc/resolv.conf',
      '--clearenv', '--setenv', 'PATH', '/usr/sbin:/usr/bin:/bin', '--', process.execPath,
      '--import', import.meta.resolve('tsx'), '--input-type=module', '-e', fixture,
    ], { timeout: 12000, encoding: 'utf8' });
    expect(run.error, run.stderr).toBeUndefined();
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('dns-only-ok');
  }, 15000);

  it('forwards only allowed host loopback ports', async ctx => {
    if (pastaMissing) { ctx.skip(MISSING_PASTA); return; }
    const fixture = createServer(socket => socket.end('fixture'));
    const unrelated = createServer(socket => socket.end('unrelated'));
    const fixturePort = await listen(fixture), unrelatedPort = await listen(unrelated);
    const udp = createSocket('udp4');
    udp.on('message', (_, remote) => udp.send('unrelated-udp', remote.port, remote.address));
    await new Promise<void>(resolve => udp.bind(unrelatedPort, '127.0.0.1', resolve));
    try {
      const s = sandbox();
      const script = `const net=require('node:net'),fs=require('node:fs'),dgram=require('node:dgram');
        const read=(port,host='127.0.0.1')=>new Promise(resolve=>{let text='';const c=net.connect({port,host});c.setTimeout(1000,()=>c.destroy());c.on('data',b=>text+=b);c.on('error',()=>{});c.on('close',()=>resolve(text));});
        const readUdp=()=>new Promise(resolve=>{const c=dgram.createSocket('udp4');const timer=setTimeout(()=>{c.close();resolve('')},500);c.on('message',b=>{clearTimeout(timer);c.close();resolve(b.toString())});c.send('probe',${unrelatedPort},'127.0.0.1')});
        (async()=>{const route=fs.readFileSync('/proc/net/route','utf8').split('\\n').slice(1).map(l=>l.trim().split(/\\s+/)).find(r=>r[1]==='00000000');
        if(!route)throw Error('missing namespace default route');const gateway=route[2].match(/../g).reverse().map(h=>parseInt(h,16)).join('.');
        const allowed=await read(${fixturePort});const blocked=await read(${unrelatedPort});const v6=await read(${unrelatedPort},'::1');const alias=await read(${unrelatedPort},'127.0.0.2');const gatewayResult=await read(${unrelatedPort},gateway);const udpResult=await readUdp();
        console.log(JSON.stringify({allowed,blocked,v6,alias,gatewayResult,udpResult}));if(allowed!=='fixture'||blocked||v6||alias||gatewayResult||udpResult)process.exit(1)})()`;
      const run = await executeSandbox({ ...s, ports: [fixturePort] }, [SANDBOX_NODE, '-e', script], 10000);
      expect(run.stderr).not.toContain('Failed');
      expect(run.code, run.stderr).toBe(0);
      expect(JSON.parse(run.stdout)).toEqual({ allowed: 'fixture', blocked: '', v6: '', alias: '', gatewayResult: '', udpResult: '' });
      // No explicit ports must not trigger pasta's default automatic forwarding.
      const empty = await executeSandbox(s, [SANDBOX_NODE, '-e', script], 10000);
      expect(empty.code, empty.stderr).toBe(1);
      expect(JSON.parse(empty.stdout).allowed).toBe('');
    } finally { udp.close(); await Promise.all([close(fixture), close(unrelated)]); }
  }, 25000);

  it('does not automatically publish namespace TCP or UDP listeners to the host', async ctx => {
    if (pastaMissing) { ctx.skip(MISSING_PASTA); return; }
    const reservation = createServer();
    let port = 0;
    // pasta does not automatically publish ephemeral ports. Reserve a free
    // ordinary port so removing the explicit 'none' flags exposes the listener.
    for (let i = 0; i < 32 && !port; i++) {
      try { port = await listen(reservation, 20000 + Math.floor(Math.random() * 10000)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error; }
    }
    expect(port).toBeGreaterThan(0); await close(reservation);
    const s = sandbox();
    const script = `const net=require('node:net'),dgram=require('node:dgram'),fs=require('node:fs');
      const tcp=net.createServer(c=>c.end('namespace-only')),udp=dgram.createSocket('udp4');
      udp.on('message',(_,r)=>udp.send('namespace-only',r.port,r.address));
      tcp.listen(${port},'127.0.0.1',()=>udp.bind(${port},'127.0.0.1',()=>fs.writeFileSync('/work/ready','yes')));
      setInterval(()=>{if(fs.existsSync('/work/done'))process.exit(0)},50);`;
    const pending = executeSandbox(s, [SANDBOX_NODE, '-e', script], 10000);
    try {
      for (let i = 0; i < 75 && !existsSync(join(s.workspace, 'ready')); i++) await delay(20);
      expect(existsSync(join(s.workspace, 'ready'))).toBe(true);
      // pasta's automatic forwarding scans periodically, so allow a scan first.
      await delay(1500);
      const tcp = await new Promise<string>(resolve => {
        let text = ''; const c = connect(port, '127.0.0.1');
        c.setTimeout(300, () => c.destroy()); c.on('data', b => text += b); c.on('error', () => {}); c.on('close', () => resolve(text));
      });
      const udp = await new Promise<string>(resolve => {
        const c = createSocket('udp4'), timer = setTimeout(() => { c.close(); resolve(''); }, 300);
        c.on('message', b => { clearTimeout(timer); c.close(); resolve(b.toString()); });
        c.send('probe', port, '127.0.0.1');
      });
      expect(tcp).toBe(''); expect(udp).toBe('');
      for (const protocol of ['tcp', 'tcp6', 'udp', 'udp6']) {
        const listeners = readFileSync(`/proc/net/${protocol}`, 'utf8').split('\n').slice(1);
        expect(listeners.some(line => parseInt(line.trim().split(/\s+/)[1]?.split(':')[1] ?? '', 16) === port), protocol).toBe(false);
      }
    } finally { writeFileSync(join(s.workspace, 'done'), 'yes'); await pending; }
  }, 15000);

  it('rejects invalid forwarding ports before starting a namespace', async () => {
    for (const port of [0, -1, 65536, 1.5, NaN]) {
      await expect(executeSandbox({ ...sandbox(), ports: [port] }, ['/usr/bin/true'], 5000)).rejects.toThrow('invalid sandbox port');
    }
  });

  it('preserves command exit status, timeout cleanup and usage-limit termination', async ctx => {
    if (pastaMissing) { ctx.skip(MISSING_PASTA); return; }
    const s = sandbox();
    const exited = await executeSandbox(s, [SANDBOX_NODE, '-e', 'process.exit(23)'], 5000);
    expect(exited.code, exited.stderr).toBe(23);
    const timeout = await executeSandbox(s, [SANDBOX_NODE, '-e', 'setInterval(()=>{},1000)'], 300);
    expect(timeout.timedOut).toBe(true);
    const quota = await executeSandbox(s, [SANDBOX_NODE, '-e', 'console.error("AI_APICallError: free usage limit reached");setInterval(()=>{},1000)'], 5000, true, true);
    expect(quota.usageLimited).toBe(true); expect(quota.timedOut).toBe(false);
  }, 15000);

  it('keeps offline commands independent of pasta', async () => {
    vi.mocked(cp.spawn).mockImplementation((...args: Parameters<typeof cp.spawn>) => {
      expect(args[0]).toBe('bwrap');
      const argv = args[1] as string[];
      expect(argv).not.toContain('--share-net');
      expect(argv).not.toContain('/etc/resolv.conf');
      expect(argv).not.toContain('--dns-forward');
      return realCp.spawn(...args);
    });
    const run = await executeSandbox(sandbox(), ['/usr/bin/true'], 5000, false);
    expect(run.code, run.stderr).toBe(0);
  });

  it('permits outbound Internet when the host has outbound connectivity', async ctx => {
    if (pastaMissing) { ctx.skip(MISSING_PASTA); return; }
    if (process.env.B11_TEST_INTERNET !== '1') { ctx.skip('set B11_TEST_INTERNET=1 to enable the Internet-only probe'); return; }
    const script = 'fetch("https://example.com",{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)process.exit(1);console.log("outbound-ok")}).catch(()=>process.exit(2))';
    const host = cp.spawnSync(process.execPath, ['-e', script], { timeout: 7000, encoding: 'utf8' });
    if (host.status !== 0) { ctx.skip('host outbound HTTPS is unavailable'); return; }
    const run = await executeSandbox(sandbox(), [SANDBOX_NODE, '-e', script], 10000);
    expect(run.code, run.stderr).toBe(0); expect(run.stdout).toContain('outbound-ok');
  }, 20000);
});
