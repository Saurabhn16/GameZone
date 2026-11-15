import {
  ERROR_CODES,
  applyCall,
  applyForfeit,
  applyMark,
  matchPublicView,
  playerPrivateView,
  playerProgress,
} from '../../../shared/game-engine.js';
import { AppError } from './errors.js';
import type { RoomService } from './room-service.js';
import type { Room } from './room-types.js';

const CALL_ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.NOT_YOUR_TURN]: 'It is not your turn to call a number.',
  [ERROR_CODES.NUMBER_ALREADY_CALLED]: 'That number has already been called.',
  [ERROR_CODES.NUMBER_OUT_OF_RANGE]: 'Called numbers must be whole numbers from 1 to 25.',
  [ERROR_CODES.MATCH_FINISHED]: 'This match has already finished.',
  [ERROR_CODES.MATCH_NOT_STARTED]: 'This match has not started yet.',
  [ERROR_CODES.NUMBER_NOT_CALLED]: 'Only numbers that have been called can be marked.',
  [ERROR_CODES.NUMBER_NOT_ON_BOARD]: 'That number is not on your board.',
  [ERROR_CODES.ALREADY_MARKED]: 'That number is already marked.',
  [ERROR_CODES.PLAYER_NOT_IN_ROOM]: 'You are not a player in this match.',
};

function requireMatch(room: Room) {
  if (!room.match) {
    throw new AppError(ERROR_CODES.MATCH_NOT_STARTED, 'This room has no match yet.', 409);
  }
  return room.match;
}

function toAppError(error: { code: string }): AppError {
  const message = CALL_ERROR_MESSAGES[error.code] ?? 'That move is not allowed.';
  return new AppError(error.code, message, 409);
}

/**
 * Applies turn actions to a live match.
 *
 * These are the only entry points the realtime layer uses, and each one validates
 * against server-held state — the client never decides turn ownership, whether a
 * number is callable, or who won.
 */
export function callNumber(
  service: RoomService,
  code: string,
  playerId: string,
  number: unknown,
): { room: Room; call: { number: number; byId: string; seq: number; at: number } } {
  const room = service.store.require(code.trim().toUpperCase());
  const match = requireMatch(room);

  const result = applyCall(match, { playerId, number, at: Date.now() });
  if (!result.ok) {
    throw toAppError(result.error);
  }

  room.match = result.state;
  room.updatedAt = result.call.at;
  return { room, call: result.call };
}

export function markNumber(
  service: RoomService,
  code: string,
  playerId: string,
  number: unknown,
): { room: Room; won: boolean; lineCount: number; markedCount: number } {
  const room = service.store.require(code.trim().toUpperCase());
  const match = requireMatch(room);

  const result = applyMark(match, { playerId, number, at: Date.now() });
  if (!result.ok) {
    throw toAppError(result.error);
  }

  room.match = result.state;
  room.updatedAt = Date.now();

  if (result.state.status === 'finished') {
    room.status = 'finished';
  }

  return {
    room,
    won: result.won,
    lineCount: result.progress.lineCount,
    markedCount: result.progress.markedCount,
  };
}

/** Explicit leave during a match: the player forfeits and the removal is broadcast. */
export function forfeitMatch(service: RoomService, code: string, playerId: string): Room {
  const room = service.store.require(code.trim().toUpperCase());
  if (!room.match) {
    return room;
  }

  room.match = applyForfeit(room.match, { playerId, at: Date.now() });
  if (room.match.status === 'finished') {
    room.status = 'finished';
  }
  room.players.delete(playerId);
  room.updatedAt = Date.now();

  if (room.players.size === 0) {
    service.store.remove(room.code);
  }

  return room;
}

export interface MatchSnapshot {
  match: Record<string, unknown>;
  you: Record<string, unknown> | null;
}

/** Per-player payload: shared match state plus that player's own board only. */
export function matchSnapshot(room: Room, viewerId: string): MatchSnapshot | null {
  if (!room.match) {
    return null;
  }

  return {
    match: matchPublicView(room.match),
    you: playerPrivateView(room.match, viewerId),
  };
}

export function progressFor(room: Room, playerId: string) {
  if (!room.match) {
    return null;
  }
  return playerProgress(room.match, playerId);
}
