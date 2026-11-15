import { randomUUID } from 'node:crypto';

import {
  ERROR_CODES,
  MIN_PLAYERS_TO_START,
  ROOM_STATUS,
  ROOM_VISIBILITY,
  createMatch,
  createTurnOrder,
  describeWinRules,
  normalizeNickname,
  normalizeWinRules,
  setConnection as setMatchConnection,
  validateBoard,
} from '../../../shared/game-engine.js';
import type { RoomStatus, RoomVisibility, WinRules } from '../../../shared/domain.js';
import { AppError } from './errors.js';
import { RoomStore } from './room-store.js';
import type { PublicRoomSummary, Room, RoomMembership, RoomPlayer } from './room-types.js';

export interface CreateRoomInput {
  nickname: unknown;
  board: unknown;
  visibility: unknown;
  rules?: unknown;
}

export interface JoinRoomInput {
  nickname: unknown;
  board: unknown;
}

export interface RoomPlayerView {
  id: string;
  nickname: string;
  connected: boolean;
  forfeited: boolean;
  isHost: boolean;
  joinedAt: number;
}

export interface RoomView {
  code: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  hostId: string;
  hostNickname: string;
  capacity: number;
  rules: WinRules;
  rulesLabel: string;
  players: RoomPlayerView[];
  canStart: boolean;
  startedAt: number | null;
}

export interface RoomListFilter {
  status?: string | undefined;
  includeFinished?: boolean;
}

function parseVisibility(value: unknown): RoomVisibility {
  if (value === ROOM_VISIBILITY.PRIVATE || value === ROOM_VISIBILITY.PUBLIC) {
    return value;
  }
  throw new AppError('invalid_visibility', 'visibility must be "public" or "private".', 400);
}

function parseNickname(value: unknown): string {
  const result = normalizeNickname(value);
  if (!result.ok) {
    throw new AppError(
      ERROR_CODES.INVALID_NICKNAME,
      'Nickname must be 2-16 characters.',
      400,
    );
  }
  return result.nickname;
}

function parseBoard(value: unknown): number[] {
  const result = validateBoard(value);
  if (!result.ok) {
    throw new AppError(
      ERROR_CODES.INVALID_BOARD,
      'Board must contain all 25 numbers from 1 to 25 exactly once.',
      400,
      result.errors,
    );
  }
  return result.board;
}

function parseRules(value: unknown, fallback: WinRules): WinRules {
  if (value === undefined) {
    return fallback;
  }
  const result = normalizeWinRules(value);
  if (!result.ok) {
    throw new AppError(
      ERROR_CODES.INVALID_RULES,
      'Win rules must be "lines" (1-5) or "fullHouse".',
      400,
    );
  }
  return result.rules;
}

/**
 * Room lifecycle and membership rules.
 *
 * Every method is synchronous so a request is applied to the room in a single
 * event-loop turn; that is what makes "two simultaneous calls" resolvable to
 * exactly one accepted call.
 */
export class RoomService {
  readonly store: RoomStore;
  readonly #capacity: number;
  readonly #defaultRules: WinRules;
  readonly #now: () => number;

  constructor(options: {
    capacity: number;
    defaultRules: WinRules;
    now?: () => number;
    store?: RoomStore;
  }) {
    this.#capacity = options.capacity;
    this.#defaultRules = options.defaultRules;
    this.#now = options.now ?? (() => Date.now());
    this.store = options.store ?? new RoomStore();
  }

  createRoom(input: CreateRoomInput): RoomMembership {
    const nickname = parseNickname(input.nickname);
    const board = parseBoard(input.board);
    const visibility = parseVisibility(input.visibility);
    const rules = parseRules(input.rules, this.#defaultRules);
    const now = this.#now();

    const player: RoomPlayer = {
      id: randomUUID(),
      token: randomUUID(),
      nickname,
      board,
      joinedAt: now,
      connected: true,
      forfeited: false,
    };

    const room: Room = {
      code: this.store.generateCode(),
      visibility,
      rules,
      capacity: this.#capacity,
      createdAt: now,
      status: ROOM_STATUS.WAITING,
      hostId: player.id,
      players: new Map([[player.id, player]]),
      match: null,
      updatedAt: now,
    };

    this.store.add(room);
    return { room, player };
  }

  joinRoom(code: string, input: JoinRoomInput): RoomMembership {
    const room = this.store.require(this.#normalizeCode(code));
    this.#assertJoinable(room);

    const nickname = parseNickname(input.nickname);
    const board = parseBoard(input.board);
    const now = this.#now();

    const player: RoomPlayer = {
      id: randomUUID(),
      token: randomUUID(),
      nickname,
      board,
      joinedAt: now,
      connected: true,
      forfeited: false,
    };

    room.players.set(player.id, player);
    room.updatedAt = now;
    return { room, player };
  }

  /** Reclaims an existing seat with the token issued at join time. */
  rejoinRoom(code: string, playerId: string, token: string): RoomMembership {
    const room = this.store.require(this.#normalizeCode(code));
    const player = room.players.get(playerId);

    if (!player || player.token !== token) {
      throw new AppError(
        ERROR_CODES.PLAYER_NOT_IN_ROOM,
        'This seat does not belong to you.',
        403,
      );
    }

    return { room, player };
  }

  leaveRoom(code: string, playerId: string): { room: Room; removed: boolean } {
    const room = this.store.require(this.#normalizeCode(code));
    const player = room.players.get(playerId);

    if (!player) {
      return { room, removed: false };
    }

    room.players.delete(playerId);
    room.updatedAt = this.#now();

    if (room.hostId === playerId) {
      const next = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) {
        room.hostId = next.id;
      }
    }

    if (room.players.size === 0) {
      this.store.remove(room.code);
    }

    return { room, removed: true };
  }

  setConnected(code: string, playerId: string, connected: boolean): Room {
    const room = this.store.require(this.#normalizeCode(code));
    const player = room.players.get(playerId);

    if (player) {
      player.connected = connected;
      room.updatedAt = this.#now();
    }

    if (room.match) {
      room.match = setMatchConnection(room.match, { playerId, connected });
    }

    return room;
  }

  startMatch(code: string, playerId: string): Room {
    const room = this.store.require(this.#normalizeCode(code));

    if (room.hostId !== playerId) {
      throw new AppError(ERROR_CODES.NOT_ROOM_HOST, 'Only the host can start the match.', 403);
    }

    if (room.status !== ROOM_STATUS.WAITING) {
      throw new AppError(ERROR_CODES.ROOM_CLOSED, 'This room is not accepting a new match.', 409);
    }

    const seated = [...room.players.values()].filter((player) => !player.forfeited);
    if (seated.length < MIN_PLAYERS_TO_START) {
      throw new AppError(
        ERROR_CODES.NOT_ENOUGH_PLAYERS,
        `At least ${MIN_PLAYERS_TO_START} players are needed to start.`,
        409,
      );
    }

    const now = this.#now();
    room.match = createMatch({
      roomCode: room.code,
      rules: room.rules,
      players: seated.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        board: player.board,
        joinedAt: player.joinedAt,
      })),
      startedAt: now,
    });
    room.status = ROOM_STATUS.IN_PROGRESS;
    room.updatedAt = now;

    return room;
  }

  /** Broadcast-safe description of a room: never includes any player board. */
  toRoomView(room: Room): RoomView {
    const players: RoomPlayerView[] = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => ({
        id: player.id,
        nickname: player.nickname,
        connected: player.connected,
        forfeited: player.forfeited,
        isHost: player.id === room.hostId,
        joinedAt: player.joinedAt,
      }));

    const activePlayers = players.filter((player) => !player.forfeited).length;

    return {
      code: room.code,
      visibility: room.visibility,
      status: room.status,
      hostId: room.hostId,
      hostNickname: players.find((player) => player.isHost)?.nickname ?? 'Unknown host',
      capacity: room.capacity,
      rules: room.rules,
      rulesLabel: describeWinRules(room.rules),
      players,
      canStart: room.status === ROOM_STATUS.WAITING && activePlayers >= MIN_PLAYERS_TO_START,
      startedAt: room.match?.startedAt ?? null,
    };
  }

  toPublicSummary(room: Room): PublicRoomSummary {
    const view = this.toRoomView(room);
    const activePlayers = view.players.filter((player) => !player.forfeited).length;

    return {
      code: room.code,
      visibility: room.visibility,
      status: room.status,
      hostNickname: view.hostNickname,
      playerCount: activePlayers,
      capacity: room.capacity,
      rulesLabel: view.rulesLabel,
      joinable:
        room.status === ROOM_STATUS.WAITING &&
        room.visibility === ROOM_VISIBILITY.PUBLIC &&
        activePlayers < room.capacity,
      createdAt: room.createdAt,
    };
  }

  listPublicRooms(filter: RoomListFilter = {}): PublicRoomSummary[] {
    const wanted = filter.status;

    return this.store
      .list()
      .filter((room) => room.visibility === ROOM_VISIBILITY.PUBLIC)
      .filter((room) => (filter.includeFinished === true ? true : room.status !== ROOM_STATUS.FINISHED))
      .filter((room) => (wanted === undefined ? true : room.status === wanted))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((room) => this.toPublicSummary(room));
  }

  turnOrderPreview(room: Room): string[] {
    return createTurnOrder(
      [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt).map((player) => player.id),
    );
  }

  #normalizeCode(code: string): string {
    const normalized = code.trim().toUpperCase();
    if (normalized.length === 0) {
      throw new AppError(ERROR_CODES.ROOM_CODE_INVALID, 'A room code is required.', 400);
    }
    return normalized;
  }

  #assertJoinable(room: Room): void {
    if (room.status !== ROOM_STATUS.WAITING) {
      throw new AppError(
        ERROR_CODES.ROOM_CLOSED,
        'This match is already under way.',
        409,
      );
    }

    const activePlayers = [...room.players.values()].filter((player) => !player.forfeited).length;
    if (activePlayers >= room.capacity) {
      throw new AppError(ERROR_CODES.ROOM_FULL, 'This room is full.', 409);
    }
  }
}
