import express from 'express';
import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import type { GameAction, RoomOptions } from '@avalon/shared';
import { Room, type Result } from './Room';

const PORT = Number(process.env.PORT ?? 3000);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I 제외
const EMPTY_ROOM_MS = 10 * 60_000;
const GAZE_MIN_MS = 80;

const app = express();
const http = createServer(app);
const io = new Server(http, { pingInterval: 10_000, pingTimeout: 8_000 });

const dist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

const rooms = new Map<string, Room>();
const emptyTimers = new Map<string, NodeJS.Timeout>();

function newCode() {
  let code = '';
  do code = Array.from({ length: 4 }, () => CODE_CHARS[randomInt(0, CODE_CHARS.length)]).join('');
  while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = newCode();
  const room = new Room(code, io, () => scheduleEmpty(code));
  rooms.set(code, room);
  return room;
}

function scheduleEmpty(code: string) {
  clearTimeout(emptyTimers.get(code));
  emptyTimers.set(code, setTimeout(() => {
    const room = rooms.get(code);
    if (room && room.members.every((m) => !m.connected)) {
      room.dispose();
      rooms.delete(code);
      console.log(`[room ${code}] 삭제 (빈 방)`);
    }
    emptyTimers.delete(code);
  }, EMPTY_ROOM_MS));
}

type Ack = (r: Result<Record<string, unknown>>) => void;
const safeAck = (ack: unknown): Ack => (typeof ack === 'function' ? (ack as Ack) : () => {});

io.on('connection', (socket: Socket) => {
  let room: Room | null = null;
  let memberId: string | null = null;
  let lastGaze = 0;

  const enter = (r: Room, id: string) => {
    room = r;
    memberId = id;
    socket.join(r.code);
    clearTimeout(emptyTimers.get(r.code));
    socket.emit('chat:history', r.chatHistory()); // 아직 사라지지 않은 말만
  };
  const leaveCurrent = () => {
    if (room && memberId) {
      socket.leave(room.code);
      room.leave(memberId);
    }
    room = null;
    memberId = null;
  };

  socket.on('room:create', (p: { nickname?: string }, ack) => {
    const done = safeAck(ack);
    leaveCurrent();
    const r = createRoom();
    const res = r.join(String(p?.nickname ?? ''), socket.id);
    if (!res.ok) { rooms.delete(r.code); return done(res); }
    enter(r, res.member.id);
    console.log(`[room ${r.code}] 생성 by ${res.member.nickname}`);
    done({ ok: true, code: r.code, token: res.member.token });
  });

  socket.on('room:join', (p: { code?: string; nickname?: string }, ack) => {
    const done = safeAck(ack);
    const r = rooms.get(String(p?.code ?? '').trim().toUpperCase());
    if (!r) return done({ ok: false, error: '그런 방 코드가 없어요. 코드를 다시 확인해 주세요.' });
    leaveCurrent();
    const res = r.join(String(p?.nickname ?? ''), socket.id);
    if (!res.ok) return done(res);
    enter(r, res.member.id);
    done({ ok: true, code: r.code, token: res.member.token });
  });

  socket.on('room:resume', (p: { code?: string; token?: string }, ack) => {
    const done = safeAck(ack);
    const r = rooms.get(String(p?.code ?? '').toUpperCase());
    const m = r?.resume(String(p?.token ?? ''), socket.id);
    if (!r || !m) return done({ ok: false, error: '이전 방이 사라졌어요.' });
    enter(r, m.id);
    done({ ok: true, code: r.code });
  });

  socket.on('room:leave', (_p, ack) => { leaveCurrent(); safeAck(ack)({ ok: true }); });

  const withRoom = (fn: (r: Room, id: string) => Result) => (p: unknown, ack: unknown) => {
    const done = safeAck(ack);
    if (!room || !memberId) return done({ ok: false, error: '방에 들어가 있지 않아요.' });
    try {
      done(fn(room, memberId));
    } catch (e) {
      console.error(e);
      done({ ok: false, error: '서버에서 문제가 생겼어요.' });
    }
    void p;
  };

  socket.on('room:options', (p: RoomOptions, ack) => withRoom((r, id) => r.setOptions(id, p))(p, ack));
  socket.on('room:kick', (p: { playerId: string }, ack) => withRoom((r, id) => r.kick(id, String(p?.playerId)))(p, ack));
  socket.on('game:start', (p, ack) => withRoom((r, id) => r.start(id))(p, ack));
  socket.on('game:rematch', (p, ack) => withRoom((r, id) => r.rematch(id))(p, ack));
  socket.on('game:action', (p: GameAction, ack) =>
    withRoom((r, id) => (p && p.type !== 'ADVANCE' ? r.action(id, p) : { ok: false, error: '알 수 없는 행동이에요.' }))(p, ack));

  socket.on('chat:send', (p: { text?: unknown }, ack) => withRoom((r, id) => r.sendChat(id, p?.text))(p, ack));

  socket.on('gaze', (p: { yaw?: number; pitch?: number }) => {
    if (!room || !memberId) return;
    const now = Date.now();
    if (now - lastGaze < GAZE_MIN_MS) return;
    const yaw = Number(p?.yaw), pitch = Number(p?.pitch);
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
    lastGaze = now;
    socket.to(room.code).volatile.emit('gaze', { id: memberId, yaw: Math.max(-2, Math.min(2, yaw)), pitch: Math.max(-1, Math.min(1, pitch)) });
  });

  socket.on('disconnect', () => {
    if (room) room.disconnect(socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`\n  아발론 서버 실행 중: http://localhost:${PORT}`);
  if (existsSync(dist)) console.log('  외부 접속: cloudflared tunnel --url http://localhost:' + PORT);
  else console.log('  (개발 모드: 화면은 Vite 개발 서버 http://localhost:5180 에서 열어 주세요)');
});
