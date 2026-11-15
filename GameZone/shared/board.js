/**
 * Board generation, validation and line detection.
 * Pure functions only — no I/O, no clock, no randomness outside the injected RNG.
 */

import { BOARD_CELLS, BOARD_SIZE, MAX_NUMBER, MIN_NUMBER, ERROR_CODES } from './constants.js';

/**
 * @typedef {import('./constants.js').ErrorCode} ErrorCode
 * @typedef {{ code: ErrorCode, message: string, index?: number }} ValidationError
 * @typedef {{ ok: true, board: number[] } | { ok: false, errors: ValidationError[] }} BoardValidationResult
 * @typedef {{ id: string, kind: 'row' | 'column' | 'diagonal', label: string, cells: number[] }} Line
 * @typedef {{ markedCount: number, lines: Line[], lineCount: number }} BoardProgress
 */

/**
 * Deterministic PRNG (mulberry32) so boards can be reproduced in tests.
 * @param {number} seed
 * @returns {() => number} function returning floats in [0, 1)
 */
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} row 0-based row index
 * @param {number} column 0-based column index
 * @returns {number} flat cell index (row-major)
 */
export function cellIndex(row, column) {
  return row * BOARD_SIZE + column;
}

/**
 * Builds 12 lines: 5 rows, 5 columns, 2 diagonals.
 * @returns {Line[]}
 */
export function getLines() {
  /** @type {Line[]} */
  const lines = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    lines.push({
      id: `row-${row}`,
      kind: 'row',
      label: `Row ${row + 1}`,
      cells: Array.from({ length: BOARD_SIZE }, (_, column) => cellIndex(row, column)),
    });
  }

  for (let column = 0; column < BOARD_SIZE; column += 1) {
    lines.push({
      id: `column-${column}`,
      kind: 'column',
      label: `Column ${column + 1}`,
      cells: Array.from({ length: BOARD_SIZE }, (_, row) => cellIndex(row, column)),
    });
  }

  lines.push({
    id: 'diagonal-main',
    kind: 'diagonal',
    label: 'Main diagonal',
    cells: Array.from({ length: BOARD_SIZE }, (_, i) => cellIndex(i, i)),
  });

  lines.push({
    id: 'diagonal-anti',
    kind: 'diagonal',
    label: 'Anti diagonal',
    cells: Array.from({ length: BOARD_SIZE }, (_, i) => cellIndex(i, BOARD_SIZE - 1 - i)),
  });

  return lines;
}

/** Pre-computed because the line map never changes. */
export const LINES = Object.freeze(getLines());

/**
 * Fisher–Yates shuffle of 1..25.
 * @param {() => number} [random]
 * @returns {number[]} 25 unique integers
 */
export function generateRandomBoard(random = Math.random) {
  const values = Array.from({ length: BOARD_CELLS }, (_, index) => MIN_NUMBER + index);

  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = values[i];
    const swap = values[j];
    if (current === undefined || swap === undefined) {
      continue;
    }
    values[i] = swap;
    values[j] = current;
  }

  return values;
}

/**
 * Convenience wrapper: a reproducible board from a seed.
 * @param {number} seed
 * @returns {number[]}
 */
export function generateSeededBoard(seed) {
  return generateRandomBoard(createSeededRandom(seed));
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isInteger(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Validates that a board is exactly 25 unique integers between 1 and 25.
 * Collects every problem instead of stopping at the first one so the UI can
 * highlight all offending cells at once.
 * @param {unknown} values
 * @returns {BoardValidationResult}
 */
export function validateBoard(values) {
  if (!Array.isArray(values)) {
    return {
      ok: false,
      errors: [{ code: ERROR_CODES.BOARD_INVALID, message: 'A board must be a list of numbers.' }],
    };
  }

  if (values.length !== BOARD_CELLS) {
    return {
      ok: false,
      errors: [
        {
          code:
            values.length < BOARD_CELLS ? ERROR_CODES.BOARD_INCOMPLETE : ERROR_CODES.BOARD_OVERFULL,
          message: `A board needs exactly ${BOARD_CELLS} cells, received ${values.length}.`,
        },
      ],
    };
  }

  /** @type {ValidationError[]} */
  const errors = [];
  /** @type {Map<number, number>} */
  const firstSeenAt = new Map();
  /** @type {number[]} */
  const board = [];

  values.forEach((value, index) => {
    if (!isInteger(value)) {
      errors.push({
        code: ERROR_CODES.VALUE_NOT_INTEGER,
        message: `"${String(value)}" is not a whole number.`,
        index,
      });
      return;
    }

    board[index] = value;

    if (value < MIN_NUMBER || value > MAX_NUMBER) {
      errors.push({
        code: ERROR_CODES.VALUE_OUT_OF_RANGE,
        message: `${value} is outside the allowed range ${MIN_NUMBER}–${MAX_NUMBER}.`,
        index,
      });
      return;
    }

    if (firstSeenAt.has(value)) {
      errors.push({
        code: ERROR_CODES.DUPLICATE_NUMBER,
        message: `${value} appears more than once.`,
        index,
      });
      return;
    }

    firstSeenAt.set(value, index);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, board };
}

/**
 * Which lines are complete given the numbers a player currently has marked.
 * @param {number[]} board
 * @param {Iterable<number>} markedNumbers
 * @returns {Line[]}
 */
export function findCompletedLines(board, markedNumbers) {
  const marked = markedNumbers instanceof Set ? markedNumbers : new Set(markedNumbers);

  return LINES.filter((line) =>
    line.cells.every((cell) => {
      const value = board[cell];
      return typeof value === 'number' && marked.has(value);
    }),
  );
}

/**
 * Snapshot of a player's progress used for the win check and the UI.
 * @param {{ board: number[], markedNumbers: Iterable<number> }} input
 * @returns {BoardProgress}
 */
export function evaluateProgress({ board, markedNumbers }) {
  const marked = new Set(markedNumbers);
  const lines = findCompletedLines(board, marked);
  const markedCount = board.reduce((total, value) => (marked.has(value) ? total + 1 : total), 0);

  return { markedCount, lines, lineCount: lines.length };
}
