/**
 * Turn order is fixed at match start and never reordered by disconnects.
 * A player who explicitly forfeits is removed from the order by the server and
 * the removal is broadcast, so the change is always visible.
 */

/**
 * @typedef {{ turnOrder: string[], callsCount: number, forfeited: string[] }} TurnState
 */

/**
 * Builds the match turn order from the room's join order.
 * @param {string[]} playerIds join order, host first
 * @returns {string[]}
 */
export function createTurnOrder(playerIds) {
  const seen = new Set();
  /** @type {string[]} */
  const order = [];

  for (const id of playerIds) {
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    order.push(id);
  }

  return order;
}

/**
 * The id whose turn it is, derived purely from how many calls have been made.
 * Deterministic: no stored cursor that could drift from the call history.
 * @param {string[]} turnOrder
 * @param {number} callsCount
 * @returns {string | null}
 */
export function callerForCall(turnOrder, callsCount) {
  if (turnOrder.length === 0) {
    return null;
  }

  const index = callsCount % turnOrder.length;
  return turnOrder[index] ?? null;
}

/**
 * Index of a player within the fixed order, or -1 when absent.
 * @param {string[]} turnOrder
 * @param {string} playerId
 * @returns {number}
 */
export function indexOfPlayer(turnOrder, playerId) {
  return turnOrder.indexOf(playerId);
}

/**
 * Removes forfeiting players while preserving the relative order of the rest.
 * @param {string[]} turnOrder
 * @param {Iterable<string>} forfeitedIds
 * @returns {string[]}
 */
export function withoutForfeited(turnOrder, forfeitedIds) {
  const forfeited = forfeitedIds instanceof Set ? forfeitedIds : new Set(forfeitedIds);
  return turnOrder.filter((id) => !forfeited.has(id));
}

/**
 * Rotates the order so that play resumes with the player who paused it.
 * Used only when a forfeit removes the current caller: the turn passes to the
 * next player in the original order, and every client is told about it.
 * @param {string[]} turnOrder
 * @param {string} startPlayerId
 * @returns {string[]}
 */
export function rotateFrom(turnOrder, startPlayerId) {
  const index = turnOrder.indexOf(startPlayerId);
  if (index <= 0) {
    return [...turnOrder];
  }
  return [...turnOrder.slice(index), ...turnOrder.slice(0, index)];
}
