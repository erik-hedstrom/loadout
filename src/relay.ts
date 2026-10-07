import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, RequestId } from '@modelcontextprotocol/sdk/types.js';
import { readMcpServers } from './library.js';
import { diagnostic } from './diagnostic.js';

export function relay(front: Transport, back: Transport, key: string, origin?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let closing = false;
    let initializeId: RequestId | undefined;
    const detail = (error: unknown) => diagnostic(`mcp-launch ${key}`, origin, error);
    const report = (error: unknown) => { console.error(`loadout: ${detail(error)}`); };
    const finish = (error?: Error) => {
      if (closing) return;
      closing = true;
      void Promise.allSettled([front.close(), back.close()]).then((results) => {
        const failed = results.find((r) => r.status === 'rejected');
        if (error) reject(new Error(detail(error)));
        else if (failed?.status === 'rejected') reject(new Error(detail(failed.reason)));
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
  let servers: ReturnType<typeof readMcpServers>;
  try {
    servers = key.startsWith('mcp:') ? readMcpServers(libraryDir) : {};
  } catch {
    throw new Error('could not read library MCP config');
  }
  const name = key.slice(4);
  if (!Object.hasOwn(servers, name)) throw new Error('mcp-launch requires a library MCP server key');
  const { description, autoApprove, gateway, ...server } = servers[name]!;
  if (server.url && server.type === 'sse') throw new Error('mcp-launch requires Streamable HTTP, not SSE');
  if (!server.url && !server.command) throw new Error('library MCP server has no command');
  let origin: string | undefined;
  let back: Transport;
  try {
    if (server.url) {
      const url = new URL(server.url);
      origin = url.origin;
      const headers = new Headers(server.headers);
      if (url.username || url.password) {
        const user = decodeURIComponent(url.username);
        const password = decodeURIComponent(url.password);
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`);
        }
        url.username = url.password = '';
      }
      back = new StreamableHTTPClientTransport(url, { requestInit: { headers } });
    } else {
      back = new StdioClientTransport({ ...server, command: server.command! });
    }
  } catch (error) {
    throw new Error(diagnostic(`mcp-launch ${key}`, origin, error));
  }
  const front = new StdioServerTransport();
  const end = () => { front.onclose?.(); };
  let interrupted = false;
  const interrupt = () => { interrupted = true; front.onclose?.(); };
  process.stdin.once('end', end);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    await relay(front, back, key, origin);
    if (interrupted) throw new Error(diagnostic(`mcp-launch ${key}`, origin, undefined));
  } finally {
    process.stdin.off('end', end);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
