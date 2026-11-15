import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_CELLS,
  ERROR_CODES,
  ROOM_STATUS,
  applyCall,
  applyForfeit,
  applyMark,
  callerForCall,
  createMatch,
  currentCallerPlayer,
  matchPublicView,
  pauseStatus,
  playerPrivateView,
  setConnection,
} from './game-engine.js';

const IDENTITY_BOARD = Array.from({ length: BOARD_CELLS }, (_, index) => index + 1);

const TWO_PLAYER_RULES = { mode: 'lines', linesToWin: 1 };

/** @param {{ rules?: object, players?: object[] }} [overrides] */
function makeMatch(overrides = {}) {
  return createMatch({
    roomCode: 'TEST01',
    rules: overrides.rules ?? TWO_PLAYER_RULES,
    players: overrides.players ?? [
      { id: 'p1', nickname: 'Ada', board: IDENTITY_BOARD, joinedAt: 1 },
      { id: 'p2', nickname: 'Grace', board: IDENTITY_BOARD, joinedAt: 2 },
    ],
    startedAt: 1000,
  });
}

/** Calls with whichever player is legitimately on turn. */
function callAsCurrent(state, number) {
  const caller = currentCallerPlayer(state);
  assert.ok(caller, 'a caller must exist');
  const result = applyCall(state, { playerId: caller.id, number, at: 2000 + state.calls.length });
  assert.equal(result.ok, true, `call ${number} should succeed`);
  return result.ok ? result.state : state;
}

function markAs(state, playerId, number) {
  return applyMark(state, { playerId, number, at: 3000 + number });
}

describe('turn ownership (GE-09, GE-23)', () => {
  it('starts with the first player in join order', () => {
    const state = makeMatch();
    assert.equal(pauseStatus(state).callerId, 'p1');
  });

  it('advances to the next player after an accepted call', () => {
    const state = callAsCurrent(makeMatch(), 5);
    assert.equal(state.calls.length, 1);
    assert.equal(pauseStatus(state).callerId, 'p2');
  });

  it('wraps around a four-player order deterministically', () => {
    const state = makeMatch({
      players: ['p1', 'p2', 'p3', 'p4'].map((id, index) => ({
        id,
        nickname: id,
        board: IDENTITY_BOARD,
        joinedAt: index + 1,
      })),
    });

    assert.deepEqual(state.turnOrder, ['p1', 'p2', 'p3', 'p4']);

    const callers = [];
    let current = state;
    for (let i = 0; i < 9; i += 1) {
      callers.push(pauseStatus(current).callerId);
      current = callAsCurrent(current, i + 1);
    }

    assert.deepEqual(callers, ['p1', 'p2', 'p3', 'p4', 'p1', 'p2', 'p3', 'p4', 'p1']);
    assert.equal(callerForCall(state.turnOrder, 9), 'p2');
  });
});

describe('call validation (GE-10 to GE-13)', () => {
  it('rejects a number that was already called', () => {
    const state = callAsCurrent(makeMatch(), 5);
    const result = applyCall(state, { playerId: 'p2', number: 5, at: 2100 });
    assert.equal(result.ok, false);
    assert.equal(result.ok ? '' : result.error.code, ERROR_CODES.NUMBER_ALREADY_CALLED);
    assert.equal(state.calls.length, 1);
  });

  it('rejects out-of-range and non-integer calls', () => {
    const state = makeMatch();
    for (const number of [0, 26, -1, 1.5, '7', null]) {
      const result = applyCall(state, { playerId: 'p1', number, at: 2100 });
      assert.equal(result.ok, false, `${String(number)} must be rejected`);
      assert.equal(
        result.ok ? '' : result.error.code,
        ERROR_CODES.NUMBER_OUT_OF_RANGE,
        `${String(number)} must be out of range`,
      );
    }
  });

  it('rejects a call from a player who is not on turn', () => {
    const state = makeMatch();
    const result = applyCall(state, { playerId: 'p2', number: 9, at: 2100 });
    assert.equal(result.ok, false);
    assert.equal(result.ok ? '' : result.error.code, ERROR_CODES.NOT_YOUR_TURN);
    assert.equal(state.calls.length, 0);
  });

  it('rejects calls after the match finished', () => {
    const finished = finishRowZero(makeMatch());
    assert.equal(finished.status, ROOM_STATUS.FINISHED);
    const result = applyCall(finished, { playerId: 'p2', number: 20, at: 9000 });
    assert.equal(result.ok, false);
    assert.equal(result.ok ? '' : result.error.code, ERROR_CODES.MATCH_FINISHED);
  });
});

describe('marking and win detection (GE-14 to GE-22)', () => {
  it('only allows marking numbers that were called and are on the board', () => {
    const state = makeMatch();
    const notCalled = markAs(state, 'p1', 1);
    assert.equal(notCalled.ok, false);
    assert.equal(notCalled.ok ? '' : notCalled.error.code, ERROR_CODES.NUMBER_NOT_CALLED);

    const called = callAsCurrent(state, 1);
    const onBoard = markAs(called, 'p1', 1);
    assert.equal(onBoard.ok, true);

    const again = markAs(onBoard.ok ? onBoard.state : called, 'p1', 1);
    assert.equal(again.ok, false);
    assert.equal(again.ok ? '' : again.error.code, ERROR_CODES.ALREADY_MARKED);
  });

  it('rejects marking a number that is not on the player board', () => {
    // A truncated board is invalid, but the mark guard must still hold even if
    // a bad board ever reaches the match engine.
    const custom = makeMatch({
      players: [
        {
          id: 'p1',
          nickname: 'Ada',
          board: IDENTITY_BOARD.slice(0, BOARD_CELLS - 1),
          joinedAt: 1,
        },
        { id: 'p2', nickname: 'Grace', board: IDENTITY_BOARD, joinedAt: 2 },
      ],
    });
    const called = callAsCurrent(custom, 25);
    const result = markAs(called, 'p1', 25);
    assert.equal(result.ok, false);
    assert.equal(result.ok ? '' : result.error.code, ERROR_CODES.NUMBER_NOT_ON_BOARD);
  });

  it('ends the match when the first line is completed (linesToWin = 1)', () => {
    const finished = finishRowZero(makeMatch());
    assert.equal(finished.status, ROOM_STATUS.FINISHED);
    assert.equal(finished.winnerId, 'p1');
    assert.equal(finished.outcome, 'line_completed');
    assert.deepEqual(finished.winningLines.map((line) => line.id), ['row-0']);
  });

  it('does not end the match before the required number of lines (linesToWin = 2)', () => {
    let state = makeMatch({ rules: { mode: 'lines', linesToWin: 2 } });
    for (const number of [1, 2, 3, 4, 5, 7, 13, 19, 25]) {
      state = callAsCurrent(state, number);
    }

    const numbersToMark = [1, 2, 3, 4, 5, 7, 13, 19, 25];
    for (const [index, number] of numbersToMark.entries()) {
      const result = markAs(state, 'p1', number);
      assert.equal(result.ok, true);
      state = result.ok ? result.state : state;
      if (index < numbersToMark.length - 1) {
        assert.equal(state.status, ROOM_STATUS.IN_PROGRESS, `should continue after mark ${number}`);
      }
    }

    assert.equal(state.status, ROOM_STATUS.FINISHED);
    assert.equal(state.winnerId, 'p1');
  });

  it('supports full house: only 25 marks win', () => {
    let state = makeMatch({ rules: { mode: 'fullHouse' } });
    for (let number = 1; number <= 25; number += 1) {
      state = callAsCurrent(state, number);
    }

    for (let number = 1; number <= 25; number += 1) {
      const result = markAs(state, 'p1', number);
      assert.equal(result.ok, true, `mark ${number} should be accepted`);
      state = result.ok ? result.state : state;
      if (number < 25) {
        assert.equal(state.status, ROOM_STATUS.IN_PROGRESS);
      }
    }

    assert.equal(state.status, ROOM_STATUS.FINISHED);
    assert.equal(state.outcome, 'full_house');
    assert.equal(state.winnerId, 'p1');
  });

  it('awards the win to the first winning mark received (GE-22)', () => {
    const prepared = finishRowZero(makeMatch());
    // p2 would also complete row-0, but the match is already over.
    const late = markAs(prepared, 'p2', 1);
    assert.equal(late.ok, false);
    assert.equal(late.ok ? '' : late.error.code, ERROR_CODES.MATCH_FINISHED);
    assert.equal(prepared.winnerId, 'p1');
  });
});

describe('disconnect policy (GE-24, RT-07, RT-08)', () => {
  it('pauses when the current caller disconnects and resumes on reconnect', () => {
    let state = makeMatch();
    state = setConnection(state, { playerId: 'p1', connected: false });

    const paused = pauseStatus(state);
    assert.equal(paused.paused, true);
    assert.equal(paused.reason, 'caller_disconnected');
    assert.deepEqual(state.turnOrder, ['p1', 'p2'], 'turn order must not change');

    const blocked = applyCall(state, { playerId: 'p2', number: 3, at: 4000 });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.ok ? '' : blocked.error.code, ERROR_CODES.NOT_YOUR_TURN);

    state = setConnection(state, { playerId: 'p1', connected: true });
    assert.equal(pauseStatus(state).paused, false);
    assert.equal(pauseStatus(state).callerId, 'p1');
  });

  it('keeps playing when a player who is not on turn disconnects', () => {
    let state = makeMatch();
    state = setConnection(state, { playerId: 'p2', connected: false });
    assert.equal(pauseStatus(state).paused, false);

    const progress = applyCall(state, { playerId: 'p1', number: 4, at: 4000 });
    assert.equal(progress.ok, true);
  });

  it('forfeits a leaving player and ends the match when one remains', () => {
    const state = makeMatch();
    const forfeited = applyForfeit(state, { playerId: 'p1', at: 5000 });

    assert.deepEqual(forfeited.turnOrder, ['p2']);
    assert.equal(forfeited.players.p1?.forfeited, true);
    assert.equal(forfeited.status, ROOM_STATUS.FINISHED);
    assert.equal(forfeited.outcome, 'forfeit');
    assert.equal(forfeited.winnerId, 'p2');
  });

  it('keeps the match running when a forfeit still leaves two players', () => {
    const state = makeMatch({
      players: ['p1', 'p2', 'p3'].map((id, index) => ({
        id,
        nickname: id,
        board: IDENTITY_BOARD,
        joinedAt: index + 1,
      })),
    });

    const after = applyForfeit(state, { playerId: 'p3', at: 5000 });
    assert.deepEqual(after.turnOrder, ['p1', 'p2']);
    assert.equal(after.status, ROOM_STATUS.IN_PROGRESS);
  });
});

describe('payload privacy', () => {
  it('never exposes boards in the broadcast view', () => {
    const view = matchPublicView(makeMatch());
    const serialized = JSON.stringify(view);
    assert.ok(!serialized.includes('"board"'));
    assert.ok(!serialized.includes('markedNumbers'));
    const players = /** @type {Array<Record<string, unknown>>} */ (view.players);
    assert.equal(players.length, 2);
    assert.equal(players[0]?.nickname, 'Ada');
  });

  it('exposes only the requesting player board in the private view', () => {
    const state = makeMatch();
    const privateView = playerPrivateView(state, 'p1');
    assert.ok(privateView);
    assert.deepEqual(privateView?.board, IDENTITY_BOARD);
    assert.equal(playerPrivateView(state, 'nobody'), null);
  });
});

/**
 * Calls 1-5 (so both players can mark them) and lets p1 mark row 0, which
 * completes a line under linesToWin = 1.
 * @param {ReturnType<typeof makeMatch>} state
 */
function finishRowZero(state) {
  let current = state;
  for (const number of [1, 2, 3, 4, 5]) {
    current = callAsCurrent(current, number);
  }
  for (const number of [1, 2, 3, 4, 5]) {
    const result = markAs(current, 'p1', number);
    assert.equal(result.ok, true, `p1 should be able to mark ${number}`);
    current = result.ok ? result.state : current;
  }
  return current;
}
