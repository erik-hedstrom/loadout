const REASONS: Record<string, string> = {
  ENOENT: 'not found',
  ENOTDIR: 'not a directory',
  EISDIR: 'is a directory',
  EACCES: 'permission denied',
  EPERM: 'permission denied',
  EADDRINUSE: 'address already in use',
  EADDRNOTAVAIL: 'address not available',
  ENOTFOUND: 'host not found',
  EAI_AGAIN: 'name lookup temporarily unavailable',
  ENOSPC: 'no space left',
  EROFS: 'read-only filesystem',
};

/** Error messages, paths and even an unrecognized code can contain a credential-bearing argument. */
export function systemError(error: unknown): string {
  const code = error instanceof Error && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && Object.hasOwn(REASONS, code) ? `${REASONS[code]} (${code})` : 'operation failed';
}
