/**
 * Authoritative match state machine.
 *
 * The backend owns the instance; every function here is pure (input state in,
 * new state out) so the same logic can be unit-tested without a server and
 * replayed deterministically.
 *
 * Calling model (product rule): players take turns in a fixed order, and only
 * the current caller may call a number. There is no timer and no host override.
 * If the current caller is disconnected the match is *paused*, never reordered.
 */

import { evaluateProgress } from './board.js';
import { hasWon, validateCall, validateMark } from './rules.js';
import { callerForCall, createTurnOrder } from './turn-order.js';
import { ERROR_CODES, ROOM_STATUS } from './constants.js';

/**
 * @typedef {import('./rules.js').WinRules} WinRules
 * @typedef {import('./board.js').Line} Line
 * @typedef {import('./constants.js').ErrorCode} ErrorCode
 * @typedef {{ number: number, byId: string, seq: number, at: number }} Call
 * @typedef {{
 *   id: string,
 *   nickname: string,
 *   board: number[],
 *   markedNumbers: number[],
 *   connected: boolean,
 *   forfeited: boolean,
 *   joinedAt: number
 * }} MatchPlayer
 * @typedef {{
 *   roomCode: string,
 *   status: 'waiting' | 'in_progress' | 'finished',
 *   rules: WinRules,
 *   turnOrder: string[],
 *   players: Record<string, MatchPlayer>,
 *   calls: Call[],
 *   winnerId: string | null,
 *   winningLines: Line[],
 *   outcome: string | null,
 *   startedAt: number | null,
 *   finishedAt: number | null
 * }} MatchState
 * @typedef {{ ok: true, state: MatchState } | { ok: false, error: { code: ErrorCode, number?: number } }} MatchResult
 */

/**
 * @param {{
 *   roomCode: string,
 *   rules: WinRules,
 *   players: Array<{ id: string, nickname: string, board: number[], joinedAt: number }>,
 *   startedAt: number
 * }} input
 * @returns {MatchState}
 */
export function createMatch({ roomCode, rules, players, startedAt }) {
  /** @type {Record<string, MatchPlayer>} */
  const playerMap = {};

  for (const player of players) {
    playerMap[player.id] = {
      id: player.id,
      nickname: player.nickname,
      board: [...player.board],
      markedNumbers: [],
      connected: true,
      forfeited: false,
      joinedAt: player.joinedAt,
    };
  }

  const joinOrder = [...players].sort((a, b) => a.joinedAt - b.joinedAt).map((player) => player.id);

  return {
    roomCode,
    status: ROOM_STATUS.IN_PROGRESS,
    rules,
    turnOrder: createTurnOrder(joinOrder),
    players: playerMap,
    calls: [],
    winnerId: null,
    winningLines: [],
    outcome: null,
    startedAt,
    finishedAt: null,
  };
}

/**
 * @param {MatchState} state
 * @returns {MatchPlayer | null}
 */
export function currentCallerPlayer(state) {
  const id = callerForCall(state.turnOrder, state.calls.length);
  return id === null ? null : (state.players[id] ?? null);
}

/**
 * The match is paused whenever the player whose turn it is is not connected.
 * Derived from state, so it can never disagree with the turn order.
 * @param {MatchState} state
 * @returns {{ paused: boolean, reason: string | null, callerId: string | null }}
 */
export function pauseStatus(state) {
  if (state.status !== ROOM_STATUS.IN_PROGRESS) {
    return { paused: false, reason: null, callerId: null };
  }

  const caller = currentCallerPlayer(state);
  if (!caller) {
    return { paused: false, reason: null, callerId: null };
  }

  if (!caller.connected) {
    return { paused: true, reason: 'caller_disconnected', callerId: caller.id };
  }

  return { paused: false, reason: null, callerId: caller.id };
}

/**
 * Numbers already called, in call order.
 * @param {MatchState} state
 * @returns {number[]}
 */
export function calledNumbers(state) {
  return state.calls.map((call) => call.number);
}

/**
 * @param {MatchState} state
 * @param {string} playerId
 * @returns {MatchPlayer | null}
 */
export function findPlayer(state, playerId) {
  return state.players[playerId] ?? null;
}

/**
 * @param {MatchState} state
 * @param {string} playerId
 * @returns {import('./board.js').BoardProgress | null}
 */
export function playerProgress(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) {
    return null;
  }
  return evaluateProgress({ board: player.board, markedNumbers: player.markedNumbers });
}
/**
 * Applies an accepted call. The caller must be the current player and the
 * number must be an uncalled integer in 1–25; everything else is rejected.
 * @param {MatchState} state
 * @param {{ playerId: string, number: unknown, at: number }} input
 * @returns {{ ok: true, state: MatchState, call: Call } | { ok: false, error: { code: ErrorCode, number?: number } }}
 */
export function applyCall(state, { playerId, number, at }) {
  const { callerId } = pauseStatus(state);

  const validation = validateCall({
    number,
    callerId: playerId,
    currentCallerId: callerId,
    calledNumbers: state.calls.map((call) => call.number),
    status: state.status,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const call = /** @type {Call} */ ({
    number,
    byId: playerId,
    seq: state.calls.length + 1,
    at,
  });

  return { ok: true, state: { ...state, calls: [...state.calls, call] }, call };
}

/**
 * Marks one cell on the requesting player's own board.
 * The match ends immediately when the mark completes the required lines, so the
 * first mark received wins if two players would finish on the same call.
 * @param {MatchState} state
 * @param {{ playerId: string, number: unknown, at: number }} input
 * @returns {{ ok: true, state: MatchState, progress: import('./board.js').BoardProgress, won: boolean }
 *   | { ok: false, error: { code: ErrorCode, number?: number } }}
 */
export function applyMark(state, { playerId, number, at }) {
  if (state.status === ROOM_STATUS.FINISHED) {
    return { ok: false, error: { code: ERROR_CODES.MATCH_FINISHED } };
  }

  const player = findPlayer(state, playerId);
  if (!player || player.forfeited) {
    return { ok: false, error: { code: ERROR_CODES.PLAYER_NOT_IN_ROOM } };
  }

  const validation = validateMark({
    number,
    board: player.board,
    markedNumbers: player.markedNumbers,
    calledNumbers: state.calls.map((call) => call.number),
  });

  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const markedNumber = /** @type {number} */ (number);
  const markedNumbers = [...player.markedNumbers, markedNumber];
  const progress = evaluateProgress({ board: player.board, markedNumbers });
  const won = hasWon(progress, state.rules);

  /** @type {MatchState} */
  const nextState = {
    ...state,
    players: { ...state.players, [playerId]: { ...player, markedNumbers } },
  };

  if (!won) {
    return { ok: true, state: nextState, progress, won: false };
  }

  return {
    ok: true,
    won: true,
    progress,
    state: {
      ...nextState,
      status: ROOM_STATUS.FINISHED,
      winnerId: playerId,
      winningLines: progress.lines,
      outcome: state.rules.mode === 'fullHouse' ? 'full_house' : 'line_completed',
      finishedAt: at,
    },
  };
}

/**
 * Explicit departure during a match = forfeit. The removal is broadcast so the
 * turn-order change is never silent. With one player left the match ends.
 * @param {MatchState} state
 * @param {{ playerId: string, at: number }} input
 * @returns {MatchState}
 */
export function applyForfeit(state, { playerId, at }) {
  const player = findPlayer(state, playerId);
  if (!player || state.status !== ROOM_STATUS.IN_PROGRESS) {
    return state;
  }

  const players = {
    ...state.players,
    [playerId]: { ...player, forfeited: true, connected: false },
  };
  const turnOrder = state.turnOrder.filter((id) => id !== playerId);
  const remaining = turnOrder.length;

  if (remaining <= 1) {
    return {
      ...state,
      players,
      turnOrder,
      status: ROOM_STATUS.FINISHED,
      winnerId: turnOrder[0] ?? null,
      outcome: 'forfeit',
      finishedAt: at,
    };
  }

  return { ...state, players, turnOrder };
}

/**
 * Connection tracking. Disconnecting the current caller pauses the match
 * (see pauseStatus); the turn order itself is never touched.
 * @param {MatchState} state
 * @param {{ playerId: string, connected: boolean }} input
 * @returns {MatchState}
 */
export function setConnection(state, { playerId, connected }) {
  const player = findPlayer(state, playerId);
  if (!player || player.forfeited) {
    return state;
  }

  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, connected } },
  };
}

/**
 * Broadcast payload — contains no private boards.
 * @param {MatchState} state
 * @returns {Record<string, unknown>}
 */
export function matchPublicView(state) {
  const pause = pauseStatus(state);

  const players = Object.values(state.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((player) => {
      const progress = evaluateProgress({
        board: player.board,
        markedNumbers: player.markedNumbers,
      });
      return {
        id: player.id,
        nickname: player.nickname,
        connected: player.connected,
        forfeited: player.forfeited,
        markedCount: progress.markedCount,
        lineCount: progress.lineCount,
      };
    });

  return {
    roomCode: state.roomCode,
    status: state.status,
    rules: state.rules,
    turnOrder: state.turnOrder,
    calls: state.calls,
    winnerId: state.winnerId,
    winningLines: state.winningLines,
    outcome: state.outcome,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    currentCallerId: pause.callerId,
    paused: pause.paused,
    pauseReason: pause.reason,
    players,
  };
}

/**
 * Private payload for exactly one player.
 * @param {MatchState} state
 * @param {string} playerId
 * @returns {Record<string, unknown> | null}
 */
export function playerPrivateView(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) {
    return null;
  }

  const progress = evaluateProgress({ board: player.board, markedNumbers: player.markedNumbers });

  return {
    board: player.board,
    markedNumbers: player.markedNumbers,
    markedCount: progress.markedCount,
    lineCount: progress.lineCount,
    lines: progress.lines,
  };
}
