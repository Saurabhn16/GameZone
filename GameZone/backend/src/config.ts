import { fileURLToPath } from 'node:url';

import { MAX_PLAYERS_PER_ROOM, normalizeWinRules } from '../../shared/game-engine.js';
import type { WinRules } from '../../shared/domain.js';

export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly staticDir: string;
  readonly roomCapacity: number;
  readonly defaultRules: WinRules;
  readonly corsOrigin: string | false;
  readonly isProduction: boolean;
}

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function readInteger(
  raw: string | undefined,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} must be an integer between ${min} and ${max}, received "${raw}".`);
  }

  return value;
}

/**
 * Reads and validates configuration. Missing optional values fall back to
 * documented defaults; anything malformed stops the server at boot instead of
 * failing on the first request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = readInteger(env.PORT, 'PORT', 3000, 1, 65_535);
  const roomCapacity = readInteger(env.ROOM_CAPACITY, 'ROOM_CAPACITY', MAX_PLAYERS_PER_ROOM, 2, 16);
  const linesToWin = readInteger(env.LINES_TO_WIN, 'LINES_TO_WIN', 1, 1, 5);

  const rulesResult = normalizeWinRules({
    mode: env.WIN_MODE ?? 'lines',
    linesToWin,
  });

  if (!rulesResult.ok) {
    throw new ConfigError('WIN_MODE must be "lines" or "fullHouse"; LINES_TO_WIN must be 1-5.');
  }

  const corsOrigin = env.CORS_ORIGIN?.trim();

  return {
    port,
    host: env.HOST?.trim() || '0.0.0.0',
    staticDir: env.STATIC_DIR?.trim() || REPO_ROOT,
    roomCapacity,
    defaultRules: rulesResult.rules,
    corsOrigin: corsOrigin === undefined || corsOrigin === '' ? false : corsOrigin,
    isProduction: env.NODE_ENV === 'production',
  };
}
