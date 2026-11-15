/**
 * Match rules: turn ownership, call validation, marking, win evaluation.
 * These functions are the single source of truth for both the client preview
 * and the authoritative server.
 */

import {
  MAX_NUMBER,
  MIN_NUMBER,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ERROR_CODES,
  ROOM_STATUS,
} from './constants.js';

/**
 * @typedef {import('./constants.js').ErrorCode} ErrorCode
 * @typedef {import('./constants.js').WinMode} WinMode
 * @typedef {{ code: ErrorCode, number?: number }} RuleFailure
 * @typedef {{ ok: true } | { ok: false, error: RuleFailure }} RuleResult
 * @typedef {{ mode: WinMode, linesToWin: number }} WinRules
 */

/** @type {WinRules} */
export const DEFAULT_WIN_RULES = Object.freeze({ mode: 'lines', linesToWin: 1 });

/**
 * Coerces untrusted input into valid win rules, or reports why it cannot.
 * @param {unknown} input
 * @returns {{ ok: true, rules: WinRules } | { ok: false, error: RuleFailure }}
 */
export function normalizeWinRules(input) {
  if (input === undefined || input === null) {
    return { ok: true, rules: { ...DEFAULT_WIN_RULES } };
  }

  if (typeof input !== 'object') {
    return { ok: false, error: { code: ERROR_CODES.INVALID_RULES } };
  }

  const candidate = /** @type {{ mode?: unknown, linesToWin?: unknown }} */ (input);
  const mode = candidate.mode ?? DEFAULT_WIN_RULES.mode;
  const linesToWin = candidate.linesToWin ?? DEFAULT_WIN_RULES.linesToWin;

  if (mode !== 'lines' && mode !== 'fullHouse') {
    return { ok: false, error: { code: ERROR_CODES.INVALID_RULES } };
  }

  if (mode === 'fullHouse') {
    return { ok: true, rules: { mode: 'fullHouse', linesToWin: 12 } };
  }

  if (
    typeof linesToWin !== 'number' ||
    !Number.isInteger(linesToWin) ||
    linesToWin < 1 ||
    linesToWin > 5
  ) {
    return { ok: false, error: { code: ERROR_CODES.INVALID_RULES } };
  }

  return { ok: true, rules: { mode: 'lines', linesToWin } };
}

/**
 * @param {WinRules} rules
 * @returns {string} short human summary shown in the lobby and on the board
 */
export function describeWinRules(rules) {
  if (rules.mode === 'fullHouse') {
    return 'Full house — mark all 25 numbers to win.';
  }
  if (rules.linesToWin === 1) {
    return 'First to complete 1 line (row, column or diagonal) wins.';
  }
  return `First to complete ${rules.linesToWin} lines (rows, columns or diagonals) wins.`;
}

/**
 * @param {unknown} nickname
 * @returns {{ ok: true, nickname: string } | { ok: false, error: RuleFailure }}
 */
export function normalizeNickname(nickname) {
  if (typeof nickname !== 'string') {
    return { ok: false, error: { code: ERROR_CODES.INVALID_NICKNAME } };
  }

  const trimmed = nickname.trim().replace(/\s+/g, ' ');
  if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
    return { ok: false, error: { code: ERROR_CODES.INVALID_NICKNAME } };
  }

  return { ok: true, nickname: trimmed };
}

/**
 * Target number of completed lines required to win.
 * @param {WinRules} rules
 * @returns {number}
 */
export function requiredLines(rules) {
  return rules.mode === 'fullHouse' ? 12 : rules.linesToWin;
}

/**
 * Decides whether a player has won under the given rules.
 * "fullHouse" is modelled as all 25 cells marked rather than 12 lines, because
 * 12 lines and 25 marks are not equivalent.
 * @param {{ lineCount: number, markedCount: number }} progress
 * @param {WinRules} rules
 * @returns {boolean}
 */
export function hasWon(progress, rules) {
  if (rules.mode === 'fullHouse') {
    return progress.markedCount >= 25;
  }
  return progress.lineCount >= requiredLines(rules);
}

/**
 * Validates a proposed call against authoritative match state.
 * @param {{
 *   number: unknown,
 *   callerId: string,
 *   currentCallerId: string | null,
 *   calledNumbers: Iterable<number>,
 *   status: string
 * }} input
 * @returns {RuleResult}
 */
export function validateCall({ number, callerId, currentCallerId, calledNumbers, status }) {
  if (status === ROOM_STATUS.FINISHED) {
    return { ok: false, error: { code: ERROR_CODES.MATCH_FINISHED } };
  }

  if (status !== ROOM_STATUS.IN_PROGRESS) {
    return { ok: false, error: { code: ERROR_CODES.MATCH_NOT_STARTED } };
  }

  if (typeof number !== 'number' || !Number.isInteger(number)) {
    return { ok: false, error: { code: ERROR_CODES.NUMBER_OUT_OF_RANGE } };
  }

  if (number < MIN_NUMBER || number > MAX_NUMBER) {
    return { ok: false, error: { code: ERROR_CODES.NUMBER_OUT_OF_RANGE, number } };
  }

  if (currentCallerId === null || callerId !== currentCallerId) {
    return { ok: false, error: { code: ERROR_CODES.NOT_YOUR_TURN } };
  }

  const called = calledNumbers instanceof Set ? calledNumbers : new Set(calledNumbers);
  if (called.has(number)) {
    return { ok: false, error: { code: ERROR_CODES.NUMBER_ALREADY_CALLED, number } };
  }

  return { ok: true };
}

/**
 * Validates that a player may mark one of their own cells.
 * @param {{
 *   number: unknown,
 *   board: number[],
 *   markedNumbers: Iterable<number>,
 *   calledNumbers: Iterable<number>
 * }} input
 * @returns {RuleResult}
 */
export function validateMark({ number, board, markedNumbers, calledNumbers }) {
  if (typeof number !== 'number' || !Number.isInteger(number)) {
    return { ok: false, error: { code: ERROR_CODES.NUMBER_OUT_OF_RANGE } };
  }

  if (!board.includes(number)) {
    return { ok: false, error: { code: ERROR_CODES.NUMBER_NOT_ON_BOARD, number } };
  }

  const called = calledNumbers instanceof Set ? calledNumbers : new Set(calledNumbers);
  if (!called.has(number)) {
    return { ok: false, error: { code: ERROR_CODES.NUMBER_NOT_CALLED, number } };
  }

  const marked = markedNumbers instanceof Set ? markedNumbers : new Set(markedNumbers);
  if (marked.has(number)) {
    return { ok: false, error: { code: ERROR_CODES.ALREADY_MARKED, number } };
  }

  return { ok: true };
}
