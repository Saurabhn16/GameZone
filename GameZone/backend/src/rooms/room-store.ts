import { randomInt } from 'node:crypto';

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../../shared/game-engine.js';
import { AppError } from './errors.js';
import type { Room } from './room-types.js';

const MAX_CODE_ATTEMPTS = 500;

/**
 * In-memory room repository.
 *
 * Deliberately a thin, synchronous store: Node's single-threaded event loop makes
 * every mutation here atomic with respect to other requests, which is what the
 * turn-order guarantees rely on. Persistence arrives in a later milestone and
 * will keep this interface.
 */
export class RoomStore {
  readonly #rooms = new Map<string, Room>();

  get size(): number {
    return this.#rooms.size;
  }

  add(room: Room): Room {
    this.#rooms.set(room.code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.#rooms.get(code);
  }

  /** Returns the room or throws the standard not-found error. */
  require(code: string): Room {
    const room = this.#rooms.get(code);
    if (!room) {
      throw new AppError('room_not_found', `Room ${code} does not exist.`, 404);
    }
    return room;
  }

  findByHost(hostId: string): Room | undefined {
    for (const room of this.#rooms.values()) {
      if (room.hostId === hostId) {
        return room;
      }
    }
    return undefined;
  }

  list(): Room[] {
    return [...this.#rooms.values()];
  }

  remove(code: string): boolean {
    return this.#rooms.delete(code);
  }

  /** Unused codes only; collisions are retried rather than overwritten. */
  generateCode(): string {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      let code = '';
      for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)] ?? 'A';
      }
      if (!this.#rooms.has(code)) {
        return code;
      }
    }

    throw new AppError(
      'room_code_exhausted',
      'Could not allocate a free room code. Please retry.',
      503,
    );
  }
}
