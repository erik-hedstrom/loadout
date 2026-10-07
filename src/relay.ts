import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { capabilityKey } from './library.js';
import type { Capability } from './types.js';

export function relay(front: Transport, back: Transport): Promise<void> {
  return new Promise((resolve, reject) => {
    let closing = false;
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
    front.onerror = back.onerror = finish;
    front.onmessage = (message) => { void back.send(message).catch(finish); };
    back.onmessage = (message) => { void front.send(message).catch(finish); };
    void back.start().then(() => { if (!closing) return front.start(); }).catch(finish);
  });
}

export async function launchMcp(key: string, library: Capability[]): Promise<void> {
  const capability = library.find((c) => c.kind === 'mcp' && capabilityKey(c) === key);
  if (!capability?.server) throw new Error('mcp-launch requires a library MCP server key');
  const server = capability.server;
  let back: Transport;
  if (server.url) {
    let url: URL;
    try { url = new URL(server.url); }
    catch { throw new Error('invalid MCP HTTP URL; put credentials in headers'); }
    if (url.username || url.password || url.search || url.hash) throw new Error('MCP URLs cannot contain userinfo, query strings or fragments; put credentials in headers');
    if (server.type === 'sse') throw new Error('mcp-launch requires Streamable HTTP, not SSE');
    back = new StreamableHTTPClientTransport(url, { requestInit: { headers: server.headers ?? {} } });
  } else {
    if (!server.command) throw new Error('library MCP server has no command');
    back = new StdioClientTransport({ ...server, command: server.command, stderr: 'ignore' });
  }
  const front = new StdioServerTransport();
  const end = () => { front.onclose?.(); };
  const interrupt = () => { front.onerror?.(new Error('MCP relay interrupted')); };
  process.stdin.once('end', end);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    await relay(front, back);
  } catch (error) {
    let detail = error instanceof Error ? error.message : String(error);
    for (const value of [...Object.values(server.env ?? {}), ...Object.values(server.headers ?? {}), ...(server.args ?? []), server.url ?? '']) {
      if (value) {
        detail = detail.split(JSON.stringify(value).slice(1, -1)).join('[redacted]');
        detail = detail.split(value).join('[redacted]');
      }
    }
    throw new Error(detail.slice(0, 512));
  } finally {
    process.stdin.off('end', end);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
