import type { Server, Socket } from 'socket.io';

import { AppError, asAppError } from '../rooms/errors.js';
import { callNumber, forfeitMatch, markNumber, matchSnapshot } from '../rooms/match-service.js';
import type { RoomService } from '../rooms/room-service.js';
import type { Room } from '../rooms/room-types.js';

type Ack = (response: Record<string, unknown>) => void;

interface Session {
  roomCode: string | null;
  playerId: string | null;
}

const CHANNEL_PREFIX = 'room:';

function channelOf(code: string): string {
  return `${CHANNEL_PREFIX}${code}`;
}

function ok(payload: Record<string, unknown> = {}): Record<string, unknown> {
  return { ok: true, ...payload };
}

function fail(error: unknown): Record<string, unknown> {
  const appError = asAppError(error);
  return { ok: false, error: { code: appError.code, message: appError.message } };
}

function payloadFor(room: Room, viewerId: string): Record<string, unknown> {
  const snapshot = matchSnapshot(room, viewerId);
  return {
    room: { code: room.code, status: room.status, visibility: room.visibility },
    match: snapshot?.match ?? null,
    you: snapshot?.you ?? null,
  };
}

/**
 * Realtime transport.
 *
 * Socket.IO only carries messages: every decision (whose turn it is, which
 * numbers exist, who won) is made by the room service against server state. Each
 * member receives a freshly built payload so a player's own board is never sent
 * to anybody else.
 */
export function attachRealtime(io: Server, service: RoomService): void {
  const sessions = new Map<string, Session>();
  const pausedRooms = new Set<string>();

  function emitRoomState(room: Room): void {
    const sockets = io.sockets.adapter.rooms.get(channelOf(room.code));
    if (!sockets) {
      return;
    }

    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      const session = sessions.get(socketId);
      if (!socket || !session?.playerId) {
        continue;
      }

      socket.emit('room:state', {
        roomCode: room.code,
        roomView: service.toRoomView(room),
        ...payloadFor(room, session.playerId),
      });
    }

    const paused = room.match ? room.match.status === 'in_progress' && isPaused(room) : false;
    if (paused && !pausedRooms.has(room.code)) {
      pausedRooms.add(room.code);
      io.to(channelOf(room.code)).emit('match:paused', {
        roomCode: room.code,
        reason: 'caller_disconnected',
      });
    } else if (!paused && pausedRooms.has(room.code)) {
      pausedRooms.delete(room.code);
      io.to(channelOf(room.code)).emit('match:resumed', { roomCode: room.code });
    }
  }

  function isPaused(room: Room): boolean {
    const match = room.match;
    if (!match) {
      return false;
    }
    const callerId = match.turnOrder[match.calls.length % Math.max(match.turnOrder.length, 1)];
    const caller = callerId ? match.players[callerId] : undefined;
    return caller ? caller.connected === false : false;
  }

  io.on('connection', (socket: Socket) => {
    sessions.set(socket.id, { roomCode: null, playerId: null });

    socket.on('room:subscribe', (raw: unknown, ack?: Ack) => {
      try {
        const body = (raw ?? {}) as Record<string, unknown>;
        const roomCode = String(body.roomCode ?? '').toUpperCase();
        const playerId = String(body.playerId ?? '');
        const playerToken = String(body.playerToken ?? '');

        const membership = service.rejoinRoom(roomCode, playerId, playerToken);
        const room = service.setConnected(roomCode, playerId, true);

        sessions.set(socket.id, { roomCode: room.code, playerId });
        awaitJoin(socket, room.code);
        emitRoomState(room);

        ack?.(ok({ joined: true, ...payloadFor(room, playerId) }));
      } catch (error) {
        ack?.(fail(error));
      }
    });

    socket.on('room:leave', (_raw: unknown, ack?: Ack) => {
      const session = sessions.get(socket.id);
      if (!session?.roomCode || !session.playerId) {
        ack?.(ok({ left: false }));
        return;
      }

      try {
        const room = forfeitMatch(service, session.roomCode, session.playerId);
        socket.leave(channelOf(session.roomCode));
        sessions.set(socket.id, { roomCode: null, playerId: null });
        emitRoomState(room);
        ack?.(ok({ left: true }));
      } catch (error) {
        ack?.(fail(error));
      }
    });

    socket.on('match:start', (_raw: unknown, ack?: Ack) => {
      try {
        const session = requireSession(sessions, socket.id);
        const room = service.startMatch(session.roomCode, session.playerId);
        emitRoomState(room);
        io.to(channelOf(room.code)).emit('match:started', {
          roomCode: room.code,
          turnOrder: room.match?.turnOrder ?? [],
        });
        ack?.(ok({ started: true }));
      } catch (error) {
        ack?.(fail(error));
      }
    });

    socket.on('match:call', (raw: unknown, ack?: Ack) => {
      try {
        const session = requireSession(sessions, socket.id);
        const body = (raw ?? {}) as Record<string, unknown>;
        const { room, call } = callNumber(service, session.roomCode, session.playerId, body.number);

        emitRoomState(room);
        io.to(channelOf(room.code)).emit('match:called', { roomCode: room.code, call });
        ack?.(ok({ number: call.number }));
      } catch (error) {
        ack?.(fail(error));
      }
    });

    socket.on('match:mark', (raw: unknown, ack?: Ack) => {
      try {
        const session = requireSession(sessions, socket.id);
        const body = (raw ?? {}) as Record<string, unknown>;
        const result = markNumber(service, session.roomCode, session.playerId, body.number);

        emitRoomState(result.room);

        if (result.won && result.room.match) {
          io.to(channelOf(result.room.code)).emit('match:finished', {
            roomCode: result.room.code,
            winnerId: result.room.match.winnerId,
            outcome: result.room.match.outcome,
            winningLines: result.room.match.winningLines,
          });
        }

        ack?.(ok({ won: result.won, lineCount: result.lineCount }));
      } catch (error) {
        ack?.(fail(error));
      }
    });

    socket.on('disconnect', () => {
      const session = sessions.get(socket.id);
      sessions.delete(socket.id);

      if (!session?.roomCode || !session.playerId) {
        return;
      }

      try {
        const room = service.setConnected(session.roomCode, session.playerId, false);
        emitRoomState(room);
      } catch {
        // A room that no longer exists needs no disconnect bookkeeping.
      }
    });
  });

  /** Joining the Socket.IO channel is what makes a player a broadcast target. */
  function awaitJoin(socket: Socket, roomCode: string): void {
    socket.join(channelOf(roomCode));
  }
}

function requireSession(sessions: Map<string, Session>, socketId: string): {
  roomCode: string;
  playerId: string;
} {
  const session = sessions.get(socketId);
  if (!session?.roomCode || !session.playerId) {
    throw new AppError('player_not_in_room', 'Join a room before acting.', 409);
  }
  return { roomCode: session.roomCode, playerId: session.playerId };
}
