import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { resolveApiKey, type Config } from './config.js';
import { HOSTS, type Host } from './launch.js';

/** Starter packs by topic. Each source is one `bench/data/library.sh` installs for the benchmark library. */
export const PACKS: readonly { name: string; about: string; sources: readonly string[] }[] = [
  { name: 'documents', about: "Anthropic's skills, including Word, PDF, PowerPoint and Excel files", sources: ['https://github.com/anthropics/skills'] },
  { name: 'security', about: "Trail of Bits' security auditing skills", sources: ['https://github.com/trailofbits/skills'] },
  { name: 'workflow', about: 'Superpowers: planning, test-driven development, debugging', sources: ['https://github.com/obra/superpowers'] },
];

/** Packs named or numbered (1-based) in `choices`, as the deduplicated sources to add, plus the choices that match none. */
export function packSources(choices: string[]): { sources: string[]; unknown: string[] } {
  const sources = new Set<string>();
  const unknown: string[] = [];
  for (const choice of choices.flatMap((c) => c.split(/[\s,]+/)).filter(Boolean)) {
    const pack = /^\d+$/.test(choice) ? PACKS[Number(choice) - 1] : PACKS.find((p) => p.name === choice.toLowerCase());
    if (pack) for (const s of pack.sources) sources.add(s);
    else unknown.push(choice);
  }
  return { sources: [...sources], unknown };
}

const HOST_BINS: [string, Host][] = [['claude', 'claude-code'], ['codex', 'codex'], ['cursor', 'cursor'], ['opencode', 'opencode']];

/** Hosts whose CLI `find` locates. The Claude desktop app has no CLI to find. */
export const detectHosts = (find: (bin: string) => string | undefined): Host[] => HOST_BINS.filter(([bin]) => find(bin)).map(([, host]) => host);

/** Whether resolveApiKey() finds a key, reading `keyFile` in place of the configured key file when given. */
export function hasKey(config: Config, keyFile?: string): boolean {
  try {
    return Boolean(resolveApiKey(keyFile ? { ...config, jev: { ...config.jev, apiKeyFile: keyFile } } : config));
  } catch {
    // An unreadable key file (a folder, no permission) is no key.
    return false;
  }
}

export interface InitDeps {
  keyFound(keyFile?: string): boolean;
  writeConfig(keyFile?: string): string;
  /** `loadout add` for each source; returns how many failed. */
  add(sources: string[]): number;
  index(): Promise<void>;
  hosts: Host[];
  setup(host: Host): string;
}

/**
 * The interactive `loadout init`. It never reads or prints the key: it asks only for the path of a
 * file holding it, and never echoes an answer back, in case the key itself was pasted.
 */
export async function wizard(input: NodeJS.ReadableStream, output: NodeJS.WritableStream, deps: InitDeps): Promise<number> {
  const lines = createInterface({ input, crlfDelay: Infinity })[Symbol.asyncIterator]();
  const ask = async (question: string) => {
    output.write(question);
    const next = await lines.next();
    return next.done ? '' : next.value.trim();
  };
  const say = (text: string) => output.write(`${text}\n`);

  say('loadout init: sets up the key, starter packs and index in your loadout folder; it edits no host config.\n');
  say('TypeSafe key (Jev routing; without it, routing uses keywords only)');
  let keyFile: string | undefined;
  if (deps.keyFound()) say('  found');
  else {
    say('  not found. Set TYPESAFE_API_KEY in your shell, or enter the path to a file that holds the key.');
    for (;;) {
      const answer = await ask('Key file path, not the key itself (Enter to skip): ');
      if (!answer) break;
      const path = resolve(answer);
      if (!existsSync(path)) say('  no such file');
      else if (!deps.keyFound(path)) say('  that file is empty or cannot be read');
      else {
        keyFile = path;
        break;
      }
    }
  }
  say(`wrote ${deps.writeConfig(keyFile)}\n`);

  say('Starter packs: GitHub repos of third-party skills, copied into the library by `loadout add`');
  PACKS.forEach((p, i) => say(`  ${i + 1}. ${p.name.padEnd(10)} ${p.about}\n     ${p.sources.join(' ')}`));
  let sources: string[] = [];
  for (;;) {
    const choice = packSources([await ask('Packs to add (numbers or names; Enter for none): ')]);
    if (!choice.unknown.length) {
      sources = choice.sources;
      break;
    }
    say(`  unknown pack; choose from ${PACKS.map((p) => p.name).join(', ')}`);
  }
  const failed = sources.length ? deps.add(sources) : 0;
  await deps.index();

  say('\nHost setup: run or paste these yourself.');
  for (const host of deps.hosts) say(`\n${deps.setup(host)}`);
  const others = HOSTS.filter((h) => !deps.hosts.includes(h));
  if (others.length) say(`\n${deps.hosts.length ? 'Other hosts' : 'No host CLI found on PATH'}: loadout setup <${others.join('|')}>`);
  return failed ? 1 : 0;
}
