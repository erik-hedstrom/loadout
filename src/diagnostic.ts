import { constants } from 'node:os';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

// SDK messages can contain upstream bodies, command arguments and credential-bearing URLs.
export function diagnostic(prefix: string, origin: string | undefined, error: unknown): string {
  if (origin && error instanceof StreamableHTTPError && error.code !== undefined && Number.isInteger(error.code) && error.code >= 100 && error.code <= 599) return `${prefix}: upstream HTTP ${error.code} from ${origin}`;
  if (error instanceof McpError && Number.isInteger(error.code)) return `${prefix}: upstream MCP error (${error.code})`;
  if (!origin && error instanceof Error && 'code' in error && typeof error.code === 'string' && Object.hasOwn(constants.errno, error.code)) return `${prefix}: stdio transport failed (${error.code})`;
  return `${prefix}: transport failed${origin ? ` from ${origin}` : ''}`;
}
