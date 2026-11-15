import { ERROR_CODES } from '../../../shared/game-engine.js';

/**
 * Domain error carrying a machine-readable code plus the HTTP status the API
 * should answer with. Socket handlers forward `code` and `message` verbatim.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details ?? null;
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  [ERROR_CODES.ROOM_NOT_FOUND]: 404,
  [ERROR_CODES.ROOM_CODE_INVALID]: 400,
  [ERROR_CODES.ROOM_FULL]: 409,
  [ERROR_CODES.ROOM_CLOSED]: 409,
  [ERROR_CODES.ROOM_PRIVATE]: 403,
  [ERROR_CODES.PLAYER_NOT_IN_ROOM]: 403,
  [ERROR_CODES.NOT_ROOM_HOST]: 403,
  [ERROR_CODES.NOT_ENOUGH_PLAYERS]: 409,
  [ERROR_CODES.INVALID_NICKNAME]: 400,
  [ERROR_CODES.INVALID_BOARD]: 400,
  [ERROR_CODES.INVALID_RULES]: 400,
  [ERROR_CODES.NOT_YOUR_TURN]: 409,
  [ERROR_CODES.NUMBER_ALREADY_CALLED]: 409,
  [ERROR_CODES.NUMBER_OUT_OF_RANGE]: 400,
  [ERROR_CODES.MATCH_NOT_STARTED]: 409,
  [ERROR_CODES.MATCH_FINISHED]: 409,
};

export function statusForCode(code: string): number {
  return STATUS_BY_CODE[code] ?? 400;
}

/** Throws a domain error with the conventional status for its code. */
export function fail(code: string, message: string, details?: unknown): never {
  throw new AppError(code, message, statusForCode(code), details);
}

export function toErrorBody(error: AppError): {
  error: { code: string; message: string; details: unknown };
} {
  return { error: { code: error.code, message: error.message, details: error.details } };
}

/** Normalises anything thrown into an AppError so handlers stay branch-free. */
export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  return new AppError('internal_error', message, 500);
}
