import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { FitMeasure } from './route.js';
import type { Tier } from './types.js';

export interface Config {
  router: 'jev' | 'lexical';
  jev: {
    baseUrl: string;
    model: string;
    /** Read the key from this file when TYPESAFE_API_KEY is unset. */
    apiKeyFile?: string;
    /** USD per million input tokens; output is free. */
    inputPricePerMTok: number;
  };
  /** Candidates the wide Jev choice ranks (at most 254: one option is "no skill needed"). */
  maxCandidates: number;
  /** Top wide picks reread in detail by the second Jev request. */
  shortlist: number;
  /** How the graded fit becomes one 0..1 number (see Policy in route.ts). */
  fitBy: FitMeasure;
  /** Load a capability when its fit is at least this... */
  threshold: number;
  /** ...and its share of the close comparison is at least this. */
  minShare: number;
  /** Below this need score, select nothing: the request needs no specialised skill. */
  needThreshold: number;
  /** Also load the close comparison's clear winner (share ≥ share) when its expected fit ≥ fit. */
  winner: { share: number; fit: number };
  /** Inject the top skill's full SKILL.md when wide pick, close share and P(exact) all reach these. */
  inject: { enabled: boolean; wide: number; share: number; exact: number };
  maxSkills: number;
  maxMcp: number;
  /** Also offer (not load) capabilities whose expected fit is at least this. */
  showThreshold: number;
  maxShown: number;
  /** Tier used when the router cannot decide (lexical backend). */
  defaultTier: Tier;
  /** Fuse embedding similarity into retrieval when @huggingface/transformers is installed. */
  embeddings: boolean;
  /** Attach `loadout mcp` to launched sessions so the agent can search the library mid-session. */
  search: boolean;
  /**
   * Model (and optionally reasoning effort) per tier, per CLI. A bare string is a model.
   * Presets: whether each fits the work Jev assigns to its tier is unmeasured (C3).
   */
  tiers: Record<'claude' | 'codex', Record<Tier, TierTarget>>;
}

export type TierTarget = string | { model: string; effort?: string };

export function tierTarget(t: TierTarget): { model: string; effort?: string } {
  return typeof t === 'string' ? { model: t } : t;
}

export const DEFAULT_CONFIG: Config = {
  router: 'jev',
  jev: {
    baseUrl: 'https://api.typesafe.ai',
    model: 'jev-latest',
    inputPricePerMTok: 0.042,
  },
  maxCandidates: 200,
  shortlist: 8,
  // Selection policy, tuned on the benchmark's dev split (bench/RESULTS.md).
  fitBy: 'exact',
  // Re-tuned on the judged sweep of detailed requests (bench/RESULTS.md, v4).
  threshold: 0.8,
  minShare: 0.1,
  needThreshold: 0.5,
  winner: { share: 0.5, fit: 0.7 },
  inject: { enabled: true, wide: 0.5, share: 0.8, exact: 0.95 },
  maxSkills: 3,
  maxMcp: 2,
  showThreshold: 0.7,
  maxShown: 4,
  defaultTier: 'medium',
  // On realistic requests, keyword + embedding retrieval kept the judge's best skill in the
  // candidates 87% of the time vs 80% for keywords alone (bench/RESULTS.md, v4).
  embeddings: true,
  search: true,
  tiers: {
    claude: { small: 'haiku', medium: 'sonnet', large: { model: 'opus', effort: 'high' } },
    codex: {
      small: { model: 'gpt-5.6-luna', effort: 'low' },
      medium: { model: 'gpt-6.1-sol', effort: 'medium' },
      large: { model: 'gpt-6.1-sol', effort: 'high' },
    },
  },
};

export function loadoutHome(): string {
  return process.env.LOADOUT_HOME ?? join(homedir(), '.loadout');
}

export const paths = {
  config: () => join(loadoutHome(), 'config.json'),
  library: () => join(loadoutHome(), 'library'),
  sessions: () => join(loadoutHome(), 'sessions'),
  embeddings: () => join(loadoutHome(), 'index', 'embeddings'),
};

/** Reject settings that would make routing silently misbehave (e.g. a negative cap). */
export function validateConfig(c: Config): Config {
  const problems: string[] = [];
  const unit = (k: string, v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1) || problems.push(`${k} must be a number in 0..1`);
  const count = (k: string, v: unknown, max: number) =>
    (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max) || problems.push(`${k} must be an integer in 0..${max}`);
  unit('threshold', c.threshold);
  unit('minShare', c.minShare);
  unit('needThreshold', c.needThreshold);
  unit('showThreshold', c.showThreshold);
  for (const k of ['wide', 'share', 'exact'] as const) unit(`inject.${k}`, c.inject?.[k]);
  for (const k of ['share', 'fit'] as const) unit(`winner.${k}`, c.winner?.[k]);
  if (typeof c.inject?.enabled !== 'boolean') problems.push('inject.enabled must be true or false');
  if (typeof c.search !== 'boolean') problems.push('search must be true or false');
  if (typeof c.embeddings !== 'boolean') problems.push('embeddings must be true or false');
  count('maxCandidates', c.maxCandidates, 254);
  count('shortlist', c.shortlist, 64);
  count('maxSkills', c.maxSkills, 50);
  count('maxMcp', c.maxMcp, 20);
  count('maxShown', c.maxShown, 50);
  if (!['jev', 'lexical'].includes(c.router)) problems.push('router must be "jev" or "lexical"');
  if (!['helps', 'expected', 'exact'].includes(c.fitBy)) problems.push('fitBy must be "helps", "expected" or "exact"');
  if (problems.length) throw new Error(`invalid ${paths.config()}: ${problems.join('; ')}`);
  return c;
}

function readConfigFile(file: string): Partial<Config> {
  const text = readFileSync(file, 'utf8');
  try {
    return JSON.parse(text) as Partial<Config>;
  } catch {
    throw new Error('config.json is not valid JSON');
  }
}

export function loadConfig(): Config {
  const file = paths.config();
  if (!existsSync(file)) return DEFAULT_CONFIG;
  const user = readConfigFile(file);
  return validateConfig({
    ...DEFAULT_CONFIG,
    ...user,
    jev: { ...DEFAULT_CONFIG.jev, ...user.jev },
    inject: { ...DEFAULT_CONFIG.inject, ...user.inject },
    winner: { ...DEFAULT_CONFIG.winner, ...user.winner },
    tiers: {
      claude: { ...DEFAULT_CONFIG.tiers.claude, ...user.tiers?.claude },
      codex: { ...DEFAULT_CONFIG.tiers.codex, ...user.tiers?.codex },
    },
  });
}

/**
 * Create or update the config, keeping the user's existing settings. Only the
 * user's own choices are stored; everything else follows DEFAULT_CONFIG as it evolves.
 */
export function writeDefaultConfig(overrides: Partial<Config['jev']> = {}): string {
  const file = paths.config();
  mkdirSync(loadoutHome(), { recursive: true });
  const existing = existsSync(file) ? readConfigFile(file) : {};
  const config: Partial<Config> = Object.keys(overrides).length ? { ...existing, jev: { ...existing.jev, ...overrides } as Config['jev'] } : existing;
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  return file;
}

/** The environment for a child process that needs no loadout credential. Windows matches env names in any case. */
export function withoutKey(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => name.toUpperCase() !== 'TYPESAFE_API_KEY'));
}

export function resolveApiKey(config: Config): string | undefined {
  const fromEnv = process.env.TYPESAFE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (config.jev.apiKeyFile && existsSync(config.jev.apiKeyFile)) {
    return readFileSync(config.jev.apiKeyFile, 'utf8').trim() || undefined;
  }
  return undefined;
}
