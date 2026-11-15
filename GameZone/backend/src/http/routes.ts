import type { Express, Request, Response } from 'express';

import { AppError } from '../rooms/errors.js';
import { matchSnapshot } from '../rooms/match-service.js';
import { RoomService } from '../rooms/room-service.js';
import type { Room, RoomPlayer } from '../rooms/room-types.js';

const PLAYER_ID_HEADER = 'x-player-id';
const PLAYER_TOKEN_HEADER = 'x-player-token';

function headerValue(req: Request, name: string): string {
  const raw = req.headers[name];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return raw[0] ?? '';
  }
  return '';
}

function bodyOf(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  if (typeof body === 'object' && body !== null) {
    return body as Record<string, unknown>;
  }
  return {};
}

/** Resolves the caller from the credential headers issued at join time. */
function authenticate(service: RoomService, req: Request, code: string): RoomPlayer {
  const playerId = headerValue(req, PLAYER_ID_HEADER);
  const token = headerValue(req, PLAYER_TOKEN_HEADER);

  if (playerId === '' || token === '') {
    throw new AppError('player_not_in_room', 'Missing player credentials.', 401);
  }

  return service.rejoinRoom(code, playerId, token).player;
}

function membershipPayload(room: Room, player: RoomPlayer, service: RoomService) {
  return {
    room: service.toRoomView(room),
    you: {
      id: player.id,
      nickname: player.nickname,
      board: player.board,
    },
    playerId: player.id,
    playerToken: player.token,
    match: matchSnapshot(room, player.id),
  };
}

export function registerApiRoutes(app: Express, service: RoomService): void {
  app.get('/api/rooms', (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const includeFinished = req.query.includeFinished === 'true';

    res.json({ rooms: service.listPublicRooms({ status, includeFinished }) });
  });

  app.get('/api/rooms/:code', (req: Request, res: Response) => {
    const code = String(req.params.code ?? '').toUpperCase();
    const room = service.store.require(code);

    if (room.visibility === 'private') {
      // Private rooms must not be discoverable: without valid credentials the
      // answer is identical to a room that does not exist.
      try {
        const player = authenticate(service, req, code);
        res.json({
          room: service.toRoomView(room),
          match: matchSnapshot(room, player.id),
        });
      } catch {
        throw new AppError('room_not_found', 'Room not found.', 404);
      }
      return;
    }

    res.json({ room: service.toRoomView(room) });
  });

  app.post('/api/rooms', (req: Request, res: Response) => {
    const body = bodyOf(req);
    const { room, player } = service.createRoom({
      nickname: body.nickname,
      board: body.board,
      visibility: body.visibility,
      rules: body.rules,
    });

    res.status(201).json(membershipPayload(room, player, service));
  });

  app.post('/api/rooms/:code/join', (req: Request, res: Response) => {
    const body = bodyOf(req);
    const { room, player } = service.joinRoom(String(req.params.code ?? ''), {
      nickname: body.nickname,
      board: body.board,
    });

    res.status(201).json(membershipPayload(room, player, service));
  });

  app.post('/api/rooms/:code/rejoin', (req: Request, res: Response) => {
    const code = String(req.params.code ?? '');
    const player = authenticate(service, req, code);
    const room = service.setConnected(code.toUpperCase(), player.id, true);

    res.json(membershipPayload(room, player, service));
  });

  app.get('/api/rooms/:code/state', (req: Request, res: Response) => {
    const code = String(req.params.code ?? '');
    const player = authenticate(service, req, code);
    const room = service.store.require(code.toUpperCase());

    res.json({
      room: service.toRoomView(room),
      match: matchSnapshot(room, player.id),
      you: { id: player.id, nickname: player.nickname, board: player.board },
    });
  });

  app.post('/api/rooms/:code/start', (req: Request, res: Response) => {
    const code = String(req.params.code ?? '');
    const player = authenticate(service, req, code);
    const room = service.startMatch(code, player.id);

    res.json({
      room: service.toRoomView(room),
      match: matchSnapshot(room, player.id),
    });
  });

  app.post('/api/rooms/:code/leave', (req: Request, res: Response) => {
    const code = String(req.params.code ?? '');
    const player = authenticate(service, req, code);
    const result = service.leaveRoom(code, player.id);
    const remaining = service.store.get(result.room.code);

    res.json({
      left: result.removed,
      room: remaining ? service.toRoomView(remaining) : null,
    });
  });
}
