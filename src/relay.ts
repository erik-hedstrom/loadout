import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, RequestId } from '@modelcontextprotocol/sdk/types.js';
import { readMcpServers } from './library.js';
import { safeDetail } from './errors.js';

export function relay(front: Transport, back: Transport, secrets: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    let closing = false;
    let initializeId: RequestId | undefined;
    const detail = (error: unknown) => safeDetail(error instanceof Error ? error.message : String(error), secrets);
    const report = (error: unknown) => { console.error(`loadout: ${detail(error)}`); };
    const finish = (error?: Error) => {
      if (closing) return;
      closing = true;
      void Promise.allSettled([front.close(), back.close()]).then((results) => {
        const failed = results.find((r) => r.status === 'rejected');
        if (error) reject(error);
        else if (failed?.status === 'rejected') reject(failed.reason);
        else resolve();
      });
    };
    front.onclose = () => finish();
    back.onclose = () => finish(new Error('MCP server closed the connection'));
    const forward = (source: Transport, target: Transport, message: JSONRPCMessage) => {
      void target.send(message).catch((error: unknown) => {
        if ('method' in message && 'id' in message) void source.send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: detail(error) } }).catch(report);
        else report(error);
      });
    };
    front.onerror = back.onerror = report;
    front.onmessage = (message) => {
      if ('method' in message && message.method === 'initialize' && 'id' in message) initializeId = message.id;
      forward(front, back, message);
    };
    back.onmessage = (message) => {
      if ('id' in message && message.id === initializeId) {
        if ('result' in message && typeof message.result.protocolVersion === 'string') back.setProtocolVersion?.(message.result.protocolVersion);
        initializeId = undefined;
      }
      forward(back, front, message);
    };
    void back.start().then(() => { if (!closing) return front.start(); }).catch(report);
  });
}

export async function launchMcp(key: string, libraryDir: string): Promise<void> {
  const servers = key.startsWith('mcp:') ? readMcpServers(libraryDir) : {};
  const name = key.slice(4);
  if (!Object.hasOwn(servers, name)) throw new Error('mcp-launch requires a library MCP server key');
  const { description, autoApprove, gateway, ...server } = servers[name]!;
  const secrets = [
    ...Object.values(server.env ?? {}),
    ...Object.values(server.headers ?? {}).flatMap((value) => [value, ...value.split(/\s+/).filter((part) => part.length >= 8)]),
    ...(server.url ? [server.url] : []),
  ];
  let back: Transport;
  if (server.url) {
    let url: URL;
    try { url = new URL(server.url); }
    catch { throw new Error('invalid MCP HTTP URL'); }
    if (server.type === 'sse') throw new Error('mcp-launch requires Streamable HTTP, not SSE');
    const headers = new Headers();
    for (const [name, value] of Object.entries(server.headers ?? {})) {
      try { headers.set(name, value); }
      catch { throw new Error(`invalid header value for ${name}`); }
    }
    secrets.push(...[...url.searchParams.values()].filter((value) => value.length >= 8));
    if (url.username || url.password) {
      const user = decodeURIComponent(url.username);
      const password = decodeURIComponent(url.password);
      secrets.push(user, password);
      if (!headers.has('Authorization')) {
        const credential = Buffer.from(`${user}:${password}`).toString('base64');
        const value = `Basic ${credential}`;
        secrets.push(value, ...(credential.length >= 8 ? [credential] : []));
        headers.set('Authorization', value);
      }
      url.username = url.password = '';
    }
    back = new StreamableHTTPClientTransport(url, { requestInit: { headers } });
  } else {
    if (!server.command) throw new Error('library MCP server has no command');
    back = new StdioClientTransport({ ...server, command: server.command });
  }
  const front = new StdioServerTransport();
  const end = () => { front.onclose?.(); };
  let interrupted = false;
  const interrupt = () => { interrupted = true; front.onclose?.(); };
  process.stdin.once('end', end);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    await relay(front, back, secrets);
    if (interrupted) throw new Error('MCP relay interrupted');
  } catch (error) {
    throw new Error(safeDetail(error instanceof Error ? error.message : String(error), secrets));
  } finally {
    process.stdin.off('end', end);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
