/**
 * Shared rule constants for Bingo Arena.
 * Imported by both the browser client and the authoritative backend so the
 * rules can never drift apart.
 */

/** @typedef {'lines' | 'fullHouse'} WinMode */

export const BOARD_SIZE = 5;
export const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 25;

/** Every callable number, in ascending order. */
export const CALLABLE_NUMBERS = Object.freeze(
  Array.from({ length: MAX_NUMBER - MIN_NUMBER + 1 }, (_, index) => MIN_NUMBER + index),
);

/** @type {readonly WinMode[]} */
export const WIN_MODES = Object.freeze(['lines', 'fullHouse']);

export const ROOM_STATUS = Object.freeze({
  WAITING: 'waiting',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished',
});

/** @typedef {'waiting' | 'in_progress' | 'finished'} RoomStatus */

export const ROOM_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private',
});

/** @typedef {'public' | 'private'} RoomVisibility */

/**
 * Machine-readable failure reasons. The UI maps each code to human copy, so the
 * server never has to send display strings and the wording stays consistent.
 */
export const ERROR_CODES = Object.freeze({
  BOARD_INCOMPLETE: 'board_incomplete',
  BOARD_OVERFULL: 'board_overfull',
  VALUE_NOT_INTEGER: 'value_not_integer',
  VALUE_OUT_OF_RANGE: 'value_out_of_range',
  DUPLICATE_NUMBER: 'duplicate_number',
  BOARD_INVALID: 'board_invalid',

  NUMBER_OUT_OF_RANGE: 'number_out_of_range',
  NUMBER_ALREADY_CALLED: 'number_already_called',
  NOT_YOUR_TURN: 'not_your_turn',
  MATCH_NOT_STARTED: 'match_not_started',
  MATCH_FINISHED: 'match_finished',

  NUMBER_NOT_ON_BOARD: 'number_not_on_board',
  NUMBER_NOT_CALLED: 'number_not_called',
  ALREADY_MARKED: 'already_marked',

  NOT_ENOUGH_PLAYERS: 'not_enough_players',
  NOT_ROOM_HOST: 'not_room_host',
  ROOM_FULL: 'room_full',
  ROOM_NOT_FOUND: 'room_not_found',
  ROOM_CLOSED: 'room_closed',
  ROOM_CODE_INVALID: 'room_code_invalid',
  ROOM_PRIVATE: 'room_private',
  PLAYER_NOT_IN_ROOM: 'player_not_in_room',
  INVALID_NICKNAME: 'invalid_nickname',
  INVALID_BOARD: 'invalid_board',
  INVALID_RULES: 'invalid_rules',
});

/** @typedef {typeof ERROR_CODES[keyof typeof ERROR_CODES]} ErrorCode */

/** Nickname limits, enforced on the client for UX and on the server for truth. */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

/** Room codes are 6 characters, excluding look-alikes (0/O, 1/I). */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MAX_PLAYERS_PER_ROOM = 8;
export const MIN_PLAYERS_TO_START = 2;
