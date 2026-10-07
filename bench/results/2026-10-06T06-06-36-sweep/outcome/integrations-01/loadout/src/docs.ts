import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path';
import { parseDocument } from 'yaml';

export interface Page { path: string; title: string; content: string }
export interface SearchHit { path: string; title: string; snippet: string; score: number }

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SNIPPET_LENGTH = 240;
const MAX_BODY_FREQUENCY = 20;
const MIN_TITLE_WEIGHT = 100;

class PageNotFound extends Error {}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

function pageTitle(content: string, path: string): string {
  let body = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const frontMatter = /^---\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(body);
  if (frontMatter) {
    const document = parseDocument(frontMatter[1]!, { uniqueKeys: true });
    if (document.errors.length) throw new Error(`Invalid YAML front matter in ${path}: ${document.errors[0]!.message}`);
    const title: unknown = document.get('title');
    if (typeof title === 'string' && title.trim()) return title.trim();
    body = body.slice(frontMatter[0].length);
  }
  let fence: { character: string; length: number } | undefined;
  let previous = '';
  for (const line of body.split('\n')) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (delimiter) {
      const marker = delimiter[1]!;
      if (!fence) fence = { character: marker[0]!, length: marker.length };
      else if (marker[0] === fence.character && marker.length >= fence.length && !delimiter[2]!.trim()) fence = undefined;
      previous = '';
      continue;
    }
    if (fence) continue;
    const heading = /^ {0,3}#{1,6}[ \t]+(.+?)\s*$/.exec(line);
    if (heading) return heading[1]!.replace(/[ \t]+#+[ \t]*$/, '').trim();
    if (previous.trim() && /^ {0,3}(?:=+|-+)[ \t]*$/.test(line)) return previous.trim();
    previous = line;
  }
  return basename(path, '.md');
}

function literalPattern(term: string): RegExp {
  return new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
}

export class Docs {
  private constructor(private readonly root: string) {}

  static async open(root: string): Promise<Docs> {
    if (!root.trim()) throw new Error('Docs root is required. Set DOCS_ROOT or pass --docs-root.');
    try {
      const canonical = await realpath(resolve(root));
      if (!(await stat(canonical)).isDirectory()) throw new Error('not a directory');
      return new Docs(canonical);
    } catch (error) {
      throw new Error(`Docs root is not an accessible directory: ${root}`, { cause: error });
    }
  }

  async getPage(path: string): Promise<Page> {
    const parts = path.split('/');
    if (!path || isAbsolute(path) || win32.isAbsolute(path) || path.includes('\\') ||
        path.includes('\0') || !path.endsWith('.md') ||
        parts.some(part => !part || part.startsWith('.') || part === 'node_modules')) {
      throw new Error('Invalid page path. Use a relative .md path returned by search_docs, without hidden folders or dot segments.');
    }
    try {
      let candidate = this.root;
      for (const [index, part] of parts.entries()) {
        candidate = join(candidate, part);
        const metadata = await lstat(candidate);
        if (metadata.isSymbolicLink()) throw new Error('Symbolic links are not allowed in page paths.');
        if (index === parts.length - 1 && !metadata.isFile()) {
          throw new Error('Invalid page path: expected a regular Markdown file.');
        }
      }
      const canonical = await realpath(candidate);
      const inside = relative(this.root, canonical);
      if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
        throw new Error('Invalid page path: page is outside the docs root.');
      }
      // O_NOFOLLOW also rejects a final-component symlink introduced after validation.
      const file = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
      try {
        if (!(await file.stat()).isFile()) throw new Error('Invalid page path: expected a regular Markdown file.');
        const content = await file.readFile('utf8');
        return { path, title: pageTitle(content, path), content };
      } finally {
        await file.close();
      }
    } catch (error) {
      if (isMissing(error)) throw new PageNotFound(`Page not found: ${path}. Search for an existing page with search_docs.`);
      throw error;
    }
  }

  async search(query: string, limit = DEFAULT_LIMIT): Promise<SearchHit[]> {
    if (!query.trim()) throw new Error('Query must not be empty. Supply one or more search terms.');
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new Error(`Limit must be an integer between 1 and ${MAX_LIMIT}.`);
    }
    const terms = [...new Set(query.trim().toLowerCase().split(/\s+/))];
    // One title term must outweigh all possible body matches, even for long queries.
    const titleWeight = Math.max(MIN_TITLE_WEIGHT, terms.length * MAX_BODY_FREQUENCY + 1);
    const hits: SearchHit[] = [];
    const scan = async (directory: string, prefix: string): Promise<void> => {
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); }
      catch (error) {
        // A nested folder can disappear during a scan; a lost docs root is an error.
        if (prefix && isMissing(error)) return;
        throw error;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await scan(join(directory, entry.name), path);
        else if (entry.isFile() && entry.name.endsWith('.md')) {
          let page;
          try { page = await this.getPage(path); }
          catch (error) {
            if (error instanceof PageNotFound) continue;
            throw error;
          }
          let score = 0;
          let firstMatch = Infinity;
          const matchesAll = terms.every(term => {
            const bodyMatches = [...page.content.matchAll(literalPattern(term))];
            const titleMatches = [...page.title.matchAll(literalPattern(term))];
            if (!bodyMatches.length && !titleMatches.length) return false;
            // Cap body frequency so a repetitive page cannot swamp a title match.
            score += (titleMatches.length ? titleWeight : 0) + Math.min(bodyMatches.length, MAX_BODY_FREQUENCY);
            firstMatch = Math.min(firstMatch, bodyMatches[0]?.index ?? Infinity);
            return true;
          });
          if (!matchesAll) continue;
          const start = Number.isFinite(firstMatch) ? Math.max(0, firstMatch - 80) : 0;
          const end = start + SNIPPET_LENGTH;
          const snippet = `${start ? '…' : ''}${page.content.slice(start, end).replace(/\s+/g, ' ').trim()}${end < page.content.length ? '…' : ''}`;
          hits.push({ path, title: page.title, snippet, score });
        }
      }
    };
    await scan(this.root, '');
    return hits.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).slice(0, limit);
  }
}
