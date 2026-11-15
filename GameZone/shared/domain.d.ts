/**
 * TypeScript view of the shared domain types.
 *
 * The JavaScript modules carry the same shapes as JSDoc typedefs (so the browser
 * and the rules engine stay annotation-only and build-free). This declaration
 * file exists so the TypeScript backend can import those shapes by name.
 *
 * Keep these two in step: string unions here mirror the constants in
 * `constants.js`, and `WinRules` mirrors the typedef in `rules.js`.
 */

export type WinMode = 'lines' | 'fullHouse';

export interface WinRules {
  mode: WinMode;
  linesToWin: number;
}

export type RoomStatus = 'waiting' | 'in_progress' | 'finished';

export type RoomVisibility = 'public' | 'private';

export type LineKind = 'row' | 'column' | 'diagonal';

export interface Line {
  id: string;
  kind: LineKind;
  label: string;
  cells: number[];
}

export interface BoardProgress {
  markedCount: number;
  lines: Line[];
  lineCount: number;
}

export interface ValidationError {
  code: string;
  message: string;
  index?: number;
}

export interface GameError {
  code: string;
  number?: number;
}

export interface Call {
  number: number;
  byId: string;
  seq: number;
  at: number;
}
export interface MatchPlayer {
  id: string;
  nickname: string;
  board: number[];
  markedNumbers: number[];
  connected: boolean;
  forfeited: boolean;
  joinedAt: number;
}

export interface MatchState {
  roomCode: string;
  status: RoomStatus;
  rules: WinRules;
  turnOrder: string[];
  players: Record<string, MatchPlayer>;
  calls: Call[];
  winnerId: string | null;
  winningLines: Line[];
  outcome: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}
