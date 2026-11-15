/**
 * Public entry point for the Bingo Arena rules engine.
 *
 * The backend imports this for authoritative decisions; the browser imports the
 * same module for previews and validation messages. One implementation, so the
 * two can never disagree about a rule.
 *
 * Named exports are listed explicitly: the source modules share JSDoc typedef
 * names (ErrorCode, Line, ...), and `export *` makes those ambiguous.
 */

export {
  BOARD_SIZE,
  BOARD_CELLS,
  MIN_NUMBER,
  MAX_NUMBER,
  CALLABLE_NUMBERS,
  WIN_MODES,
  ROOM_STATUS,
  ROOM_VISIBILITY,
  ERROR_CODES,
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
  ROOM_CODE_ALPHABET,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
} from './constants.js';

export {
  createSeededRandom,
  cellIndex,
  getLines,
  LINES,
  generateRandomBoard,
  generateSeededBoard,
  validateBoard,
  findCompletedLines,
  evaluateProgress,
} from './board.js';

export {
  DEFAULT_WIN_RULES,
  normalizeWinRules,
  describeWinRules,
  normalizeNickname,
  requiredLines,
  hasWon,
  validateCall,
  validateMark,
} from './rules.js';

export {
  createTurnOrder,
  callerForCall,
  indexOfPlayer,
  withoutForfeited,
  rotateFrom,
} from './turn-order.js';

export {
  createMatch,
  currentCallerPlayer,
  pauseStatus,
  calledNumbers,
  findPlayer,
  playerProgress,
  applyCall,
  applyMark,
  applyForfeit,
  setConnection,
  matchPublicView,
  playerPrivateView,
} from './match.js';
