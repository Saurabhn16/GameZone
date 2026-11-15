import type { MatchState, RoomStatus, RoomVisibility, WinRules } from '../../../shared/domain.js';

/**
 * A player inside a room. `id` and `token` are issued by the server: the id is
 * public (it appears in match payloads) while the token is the private
 * credential used to reclaim the seat after a reconnect.
 */
export interface RoomPlayer {
  readonly id: string;
  readonly token: string;
  readonly nickname: string;
  readonly board: number[];
  readonly joinedAt: number;
  connected: boolean;
  forfeited: boolean;
}

export interface Room {
  readonly code: string;
  readonly visibility: RoomVisibility;
  readonly rules: WinRules;
  readonly capacity: number;
  readonly createdAt: number;
  status: RoomStatus;
  hostId: string;
  players: Map<string, RoomPlayer>;
  match: MatchState | null;
  updatedAt: number;
}

export interface PublicRoomSummary {
  code: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  hostNickname: string;
  playerCount: number;
  capacity: number;
  rulesLabel: string;
  /** True only when a join would be accepted right now. */
  joinable: boolean;
  createdAt: number;
}

export interface JoinCredentials {
  playerId: string;
  playerToken: string;
  roomCode: string;
}

export interface RoomMembership {
  room: Room;
  player: RoomPlayer;
}
