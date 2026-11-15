import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_CELLS,
  ERROR_CODES,
  evaluateProgress,
  findCompletedLines,
  generateRandomBoard,
  generateSeededBoard,
  getLines,
  validateBoard,
} from './game-engine.js';

/** Identity board: cell i holds the number i + 1. Makes line assertions readable. */
const IDENTITY_BOARD = Array.from({ length: BOARD_CELLS }, (_, index) => index + 1);

describe('generateRandomBoard (GE-01, GE-02, GE-03)', () => {
  it('always yields 25 unique integers from 1 to 25', () => {
    for (let run = 0; run < 200; run += 1) {
      const board = generateRandomBoard();
      assert.equal(board.length, 25);
      assert.equal(new Set(board).size, 25);
      for (const value of board) {
        assert.ok(Number.isInteger(value) && value >= 1 && value <= 25);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    assert.deepEqual(generateSeededBoard(42), generateSeededBoard(42));
    assert.deepEqual(generateSeededBoard(7), generateSeededBoard(7));
  });

  it('produces distinct boards for distinct seeds', () => {
    const boards = new Set(
      Array.from({ length: 50 }, (_, seed) => JSON.stringify(generateSeededBoard(seed))),
    );
    assert.ok(boards.size >= 49, `expected >= 49 distinct boards, got ${boards.size}`);
  });
});

describe('validateBoard (GE-04 to GE-08)', () => {
  it('accepts 25 unique values in range', () => {
    const result = validateBoard(IDENTITY_BOARD);
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok ? result.board : null, IDENTITY_BOARD);
  });

  it('rejects a duplicate value', () => {
    const board = [...IDENTITY_BOARD];
    board[24] = 7;
    const result = validateBoard(board);
    assert.equal(result.ok, false);
    const codes = result.ok ? [] : result.errors.map((error) => error.code);
    assert.ok(codes.includes(ERROR_CODES.DUPLICATE_NUMBER));
    assert.ok(result.ok ? false : result.errors.some((error) => error.index === 24));
  });

  it('rejects values outside 1-25', () => {
    const board = [...IDENTITY_BOARD];
    board[0] = 26;
    board[1] = 0;
    const result = validateBoard(board);
    assert.equal(result.ok, false);
    const codes = result.ok ? [] : result.errors.map((error) => error.code);
    assert.deepEqual(codes, [ERROR_CODES.VALUE_OUT_OF_RANGE, ERROR_CODES.VALUE_OUT_OF_RANGE]);
  });

  it('rejects boards with the wrong number of cells', () => {
    const short = validateBoard(IDENTITY_BOARD.slice(0, 24));
    const long = validateBoard([...IDENTITY_BOARD, 26]);
    assert.equal(short.ok, false);
    assert.equal(long.ok, false);
    assert.equal(short.ok ? '' : short.errors[0]?.code, ERROR_CODES.BOARD_INCOMPLETE);
    assert.equal(long.ok ? '' : long.errors[0]?.code, ERROR_CODES.BOARD_OVERFULL);
  });

  it('rejects empty, fractional and non-numeric cells', () => {
    const holes = [...IDENTITY_BOARD];
    holes[0] = '';
    const fractions = [...IDENTITY_BOARD];
    fractions[1] = 1.5;
    const words = [...IDENTITY_BOARD];
    words[2] = 'abc';

    for (const board of [holes, fractions, words]) {
      const result = validateBoard(board);
      assert.equal(result.ok, false);
      const codes = result.ok ? [] : result.errors.map((error) => error.code);
      assert.deepEqual(codes, [ERROR_CODES.VALUE_NOT_INTEGER]);
    }
  });
});

describe('line detection (GE-14 to GE-18)', () => {
  it('defines 5 rows, 5 columns and 2 diagonals', () => {
    const lines = getLines();
    assert.equal(lines.length, 12);
    assert.equal(lines.filter((line) => line.kind === 'row').length, 5);
    assert.equal(lines.filter((line) => line.kind === 'column').length, 5);
    assert.equal(lines.filter((line) => line.kind === 'diagonal').length, 2);
    assert.ok(lines.every((line) => line.cells.length === 5));
  });

  it('detects a completed row', () => {
    const lines = findCompletedLines(IDENTITY_BOARD, [1, 2, 3, 4, 5]);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.id, 'row-0');
  });

  it('detects a completed column', () => {
    const lines = findCompletedLines(IDENTITY_BOARD, [1, 6, 11, 16, 21]);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.id, 'column-0');
  });

  it('detects the main diagonal', () => {
    const lines = findCompletedLines(IDENTITY_BOARD, [1, 7, 13, 19, 25]);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.id, 'diagonal-main');
  });

  it('detects the anti diagonal', () => {
    const lines = findCompletedLines(IDENTITY_BOARD, [5, 9, 13, 17, 21]);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.id, 'diagonal-anti');
  });

  it('does not report as line with only four marked cells', () => {
    assert.deepEqual(findCompletedLines(IDENTITY_BOARD, [1, 2, 3, 4]), []);
    assert.deepEqual(findCompletedLines(IDENTITY_BOARD, [1, 6, 11, 16]), []);
    assert.deepEqual(findCompletedLines(IDENTITY_BOARD, [1, 7, 13, 19]), []);
  });

  it('reports every completed line and the marked count', () => {
    const progress = evaluateProgress({
      board: IDENTITY_BOARD,
      markedNumbers: [1, 2, 3, 4, 5, 7, 13, 19, 25],
    });
    assert.equal(progress.markedCount, 9);
    assert.deepEqual(
      progress.lines.map((line) => line.id).sort(),
      ['diagonal-main', 'row-0'],
    );
  });

  it('ignores marked numbers that are not on the board', () => {
    const progress = evaluateProgress({ board: IDENTITY_BOARD, markedNumbers: [99, 100] });
    assert.equal(progress.markedCount, 0);
    assert.equal(progress.lineCount, 0);
  });
});
