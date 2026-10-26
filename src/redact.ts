/** Production shapes must agree with C2's frozen JSON list; the agreement test enforces that boundary. */
export const KEY_PATTERNS = [
  { name: 'sk- key', pattern: '\\bsk-[A-Za-z0-9_-]{20,}' },
  { name: 'AWS access key id', pattern: '\\bAKIA[0-9A-Z]{16}\\b' },
  { name: 'GitHub token', pattern: '\\bgh[pousr]_[A-Za-z0-9]{20,}' },
  { name: 'Slack token', pattern: '\\bxox[baprs]-[A-Za-z0-9-]{10,}' },
  { name: 'Google API key', pattern: '\\bAIza[0-9A-Za-z_-]{30,}' },
  { name: 'private key block', pattern: '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  { name: 'JWT', pattern: '\\beyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}' },
  { name: 'bearer token', pattern: '\\bBearer [A-Za-z0-9._~+/=-]{20,}', flags: 'i' },
];

const patterns = KEY_PATTERNS.map(({ pattern, flags }) => new RegExp(pattern, `${flags ?? ''}g`));

/** A JWT can start repeatedly inside one base64url run; retrying its full regex there is quadratic. */
function replaceJwt(text: string, replacement: () => string): string {
  const parts = [...text.matchAll(/[A-Za-z0-9_-]+/g)];
  const output: string[] = [];
  let from = 0;
  for (let i = 0; i + 2 < parts.length; i++) {
    const [first, second, third] = [parts[i]!, parts[i + 1]!, parts[i + 2]!];
    const endFirst = first.index + first[0].length;
    const endSecond = second.index + second[0].length;
    if (text[endFirst] !== '.' || second.index !== endFirst + 1 || text[endSecond] !== '.' || third.index !== endSecond + 1) continue;
    // The first two segments require eyJ plus ten characters; the third requires ten.
    if (!second[0].startsWith('eyJ') || second[0].length < 13 || third[0].length < 10) continue;
    const start = /\beyJ[A-Za-z0-9_-]{10,}/.exec(first[0]);
    if (!start) continue;
    output.push(text.slice(from, first.index + start.index), replacement());
    from = third.index + third[0].length;
    i += 2;
  }
  return from ? [...output, text.slice(from)].join('') : text;
}

export function redactText(text: string): { text: string; count: number } {
  let count = 0;
  const replacement = () => { count++; return '[REDACTED]'; };
  for (const [i, re] of patterns.entries()) {
    // Other shapes end with their variable run, have fixed width, or cannot
    // restart inside that run (the private-key header). JWT can restart there.
    text = KEY_PATTERNS[i]!.name === 'JWT' ? replaceJwt(text, replacement) : text.replace(re, replacement);
  }
  return { text, count };
}

/** JSON.stringify output only. Decode each string so escapes cannot hide a match or its word boundary. */
export function redactJson(json: string): { json: string; count: number } {
  let count = 0;
  const safe = json.replace(/"(?:[^"\\]|\\.)*"/g, (quoted) => {
    const { text, count: replaced } = redactText(JSON.parse(quoted) as string);
    count += replaced;
    return JSON.stringify(text);
  });
  return { json: safe, count };
}
