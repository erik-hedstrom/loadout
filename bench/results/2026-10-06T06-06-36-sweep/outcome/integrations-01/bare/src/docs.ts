import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface Page { path: string; title: string; content: string }
export interface SearchHit { path: string; title: string; snippet: string; score: number }

function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

function titleOf(content: string, path: string): string {
  let body = content.replace(/^\uFEFF/, '');
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(body);
  if (frontMatter) {
    let metadata: unknown;
    try { metadata = parseYaml(frontMatter[1]!, { maxAliasCount: 20 }); }
    catch { throw new Error(`Invalid YAML front matter in ${path}`); }
    if (metadata && typeof metadata === 'object' && 'title' in metadata &&
        typeof metadata.title === 'string' && metadata.title.trim()) {
      return metadata.title.trim();
    }
    body = body.slice(frontMatter[0].length);
  }
  let fence: string | undefined;
  let previous = '';
  for (const line of body.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      previous = '';
      continue;
    }
    if (fence) continue;
    const heading = /^ {0,3}#{1,6}[ \t]+(.+)$/.exec(line)?.[1];
    if (heading) return heading.replace(/[ \t]+#+[ \t]*$/, '').trim();
    if (previous.trim() && /^ {0,3}(?:=+|-+)\s*$/.test(line)) return previous.trim();
    previous = line;
  }
  return basename(path, '.md');
}

export class DocsStore {
  private constructor(private readonly root: string) {}

  static async create(root: string): Promise<DocsStore> {
    try {
      const canonical = await realpath(resolve(root));
      if (!(await stat(canonical)).isDirectory()) throw new Error('Not a directory');
      return new DocsStore(canonical);
    } catch {
      throw new Error(`Docs root must be an existing readable directory: ${root}`);
    }
  }

  private inside(path: string): boolean {
    const rel = relative(this.root, path);
    return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
  }

  async getPage(path: string): Promise<Page> {
    const parts = path.split('/');
    if (!path.endsWith('.md') || isAbsolute(path) || path.includes('\\') || path.includes('\0') ||
        parts.some(part => !part || part.startsWith('.') || part === 'node_modules')) {
      throw new Error('Invalid page path: use a relative .md path without hidden folders or traversal');
    }
    const candidate = join(this.root, ...parts);
    if (!this.inside(candidate)) throw new Error('Invalid page path: outside docs root');
    try {
      let current = this.root;
      for (const part of parts) {
        current = join(current, part);
        const info = await lstat(current);
        if (info.isSymbolicLink()) throw new Error('Invalid page path: symlinks are not allowed');
        // Refuse FIFOs and devices before open(), which could block or have side effects.
        if (current === candidate && !info.isFile()) throw new Error('Invalid page path: expected a regular .md file');
      }
      if (!this.inside(await realpath(candidate))) throw new Error('Invalid page path: outside docs root');
      const file = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const opened = await file.stat();
        if (!opened.isFile()) throw new Error('Invalid page path: expected a regular .md file');
        // Validate the opened inode as well as the name before reading, to catch replacements.
        const canonical = await realpath(candidate);
        if (!this.inside(canonical)) throw new Error('Invalid page path: outside docs root');
        const named = await stat(canonical);
        if (opened.dev !== named.dev || opened.ino !== named.ino) {
          throw new Error('Page changed while opening; retry the request');
        }
        const content = await file.readFile('utf8');
        return { path, title: titleOf(content, path), content };
      } finally { await file.close(); }
    } catch (error) {
      if (missing(error)) throw new Error(`Page not found: ${path}`);
      throw error;
    }
  }

  private async paths(directory = this.root): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        try { files.push(...await this.paths(full)); }
        catch (error) { if (!missing(error)) throw error; }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(relative(this.root, full).split(sep).join('/'));
      }
    }
    return files;
  }

  async search(query: string, limit = 10): Promise<SearchHit[]> {
    if (!query.trim()) throw new Error('Query must not be empty');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Limit must be an integer between 1 and 100');
    }
    const terms = [...new Set(query.toLowerCase().trim().split(/\s+/))];
    const hits: SearchHit[] = [];
    for (const path of await this.paths()) {
      let page: Page;
      try { page = await this.getPage(path); }
      catch (error) {
        // Deletion between enumeration and reading is normal in an actively edited corpus.
        if (error instanceof Error && error.message.startsWith('Page not found:')) continue;
        throw error;
      }
      const title = page.title.toLowerCase();
      const body = page.content.toLowerCase();
      if (!terms.every(term => title.includes(term) || body.includes(term))) continue;
      const score = terms.reduce((total, term) =>
        total + (title.includes(term) ? 10 : 0) + Math.min(body.split(term).length - 1, 5), 0);
      const text = page.content.replace(/\s+/g, ' ').trim();
      const positions = terms.map(term => text.toLowerCase().indexOf(term)).filter(index => index >= 0);
      const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 60);
      const end = Math.min(text.length, start + 240);
      const snippet = `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
      hits.push({ path, title: page.title, snippet, score });
    }
    return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
  }
}
