import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import {
  CHARACTERS, MAX_PLAYERS, SEAT_COLORS, TIMINGS, applyAction, createGame, projectGame, validateSetup,
  type GameAction, type GameState, type PlayerInfo, type RoomOptions, type RoomView,
} from '@avalon/shared';

export const rng = () => randomInt(0, 2 ** 47) / 2 ** 47;

interface Member extends PlayerInfo {
  token: string;
  socketId: string | null;
  dropTimer: NodeJS.Timeout | null;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const LOBBY_DROP_MS = 30_000;

export class Room {
  members: Member[] = [];
  options: RoomOptions = { percivalMorgana: false, mordred: false, ladyOfTheLake: false };
  game: GameState | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  /** 원정 결과 공개 중 지금까지 뒤집은 카드 수 */
  private questShown = 0;
  private revealTimers: NodeJS.Timeout[] = [];

  constructor(readonly code: string, private io: Server, private onEmpty: () => void) {}

  get inGame() { return this.game !== null && this.game.phase !== 'GAME_OVER'; }
  find(id: string) { return this.members.find((m) => m.id === id); }
  bySocket(socketId: string) { return this.members.find((m) => m.socketId === socketId); }
  private host() { return this.members.find((m) => m.isHost); }

  join(nickname: string, socketId: string): Result<{ member: Member }> {
    const name = nickname.trim();
    if (name.length < 1 || name.length > 10) return { ok: false, error: '닉네임은 1~10자로 정해 주세요.' };
    // 브라우저를 닫았다가 돌아온 사람: 연결이 끊긴 같은 닉네임 자리가 있으면 그 자리로 복귀
    const same = this.members.find((m) => m.nickname === name);
    if (same && !same.connected) {
      same.token = randomUUID();
      this.resume(same.token, socketId);
      return { ok: true, member: same };
    }
    if (same) return { ok: false, error: '이 방에 같은 닉네임이 있어요. 다른 닉네임을 써 주세요.' };
    if (this.game) return { ok: false, error: '이미 게임이 진행 중인 방이에요. 원래 쓰던 닉네임이면 그대로 입력해 주세요.' };
    if (this.members.length >= MAX_PLAYERS) return { ok: false, error: `방이 꽉 찼어요. (최대 ${MAX_PLAYERS}명)` };

    // 캐릭터는 아직 아무도 쓰지 않는 모델 중에서 무작위로, 색은 비어 있는 첫 번째 색
    const usedModels = new Set(this.members.map((m) => m.model));
    const free = CHARACTERS.filter((c) => !usedModels.has(c.id));
    const pool = free.length ? free : CHARACTERS;
    const usedColors = new Set(this.members.map((m) => m.color));
    const member: Member = {
      id: randomUUID().slice(0, 8),
      token: randomUUID(),
      nickname: name,
      seat: this.members.length,
      model: pool[randomInt(0, pool.length)].id,
      color: SEAT_COLORS.find((c) => !usedColors.has(c)) ?? SEAT_COLORS[0],
      connected: true,
      isHost: this.members.length === 0,
      socketId,
      dropTimer: null,
    };
    this.members.push(member);
    this.broadcast();
    return { ok: true, member };
  }

  resume(token: string, socketId: string): Member | null {
    const m = this.members.find((x) => x.token === token);
    if (!m) return null;
    if (m.dropTimer) clearTimeout(m.dropTimer);
    m.dropTimer = null;
    m.socketId = socketId;
    m.connected = true;
    this.broadcast();
    return m;
  }

  disconnect(socketId: string) {
    const m = this.bySocket(socketId);
    if (!m) return;
    m.socketId = null;
    m.connected = false;
    // 로비에서는 잠시 기다렸다가 자리를 비운다. 게임 중이거나 결과 화면에서는 돌아올 때까지 자리를 지킨다
    if (!this.game) m.dropTimer = setTimeout(() => this.remove(m.id), LOBBY_DROP_MS);
    this.broadcast();
    if (this.members.every((x) => !x.connected)) this.onEmpty();
  }

  leave(id: string) {
    const m = this.find(id);
    if (!m) return;
    if (this.inGame) {
      m.socketId = null;
      m.connected = false;
      this.broadcast();
      return;
    }
    this.remove(id);
  }

  private remove(id: string) {
    const m = this.find(id);
    if (!m || this.inGame) return;
    if (m.dropTimer) clearTimeout(m.dropTimer);
    this.members = this.members.filter((x) => x.id !== id);
    this.members.forEach((x, i) => (x.seat = i));
    if (m.isHost && this.members.length) {
      const next = this.members.find((x) => x.connected) ?? this.members[0];
      next.isHost = true;
    }
    if (!this.members.length) this.onEmpty();
    this.broadcast();
  }

  kick(hostId: string, targetId: string): Result {
    if (!this.find(hostId)?.isHost) return { ok: false, error: '방장만 내보낼 수 있어요.' };
    if (this.inGame) return { ok: false, error: '게임 중에는 내보낼 수 없어요.' };
    if (hostId === targetId) return { ok: false, error: '자기 자신은 내보낼 수 없어요.' };
    const target = this.find(targetId);
    if (!target) return { ok: false, error: '없는 사람이에요.' };
    if (target.socketId) {
      this.io.to(target.socketId).emit('kicked');
      this.io.in(target.socketId).socketsLeave(this.code); // 더 이상 시선 정보도 받지 않게
    }
    this.remove(targetId);
    return { ok: true };
  }

  setOptions(hostId: string, options: RoomOptions): Result {
    if (!this.find(hostId)?.isHost) return { ok: false, error: '방장만 설정을 바꿀 수 있어요.' };
    if (this.game) return { ok: false, error: '게임 중에는 설정을 바꿀 수 없어요.' };
    this.options = {
      percivalMorgana: !!options.percivalMorgana,
      mordred: !!options.mordred,
      ladyOfTheLake: !!options.ladyOfTheLake,
    };
    this.broadcast();
    return { ok: true };
  }

  start(hostId: string): Result {
    if (!this.find(hostId)?.isHost) return { ok: false, error: '방장만 게임을 시작할 수 있어요.' };
    if (this.game) return { ok: false, error: '이미 게임이 진행 중이에요.' };
    const err = validateSetup(this.members.length, this.options);
    if (err) return { ok: false, error: err };
    this.members.forEach((m) => { if (m.dropTimer) clearTimeout(m.dropTimer); m.dropTimer = null; });
    this.game = createGame(this.members.map((m) => m.id), this.options, rng);
    this.afterChange();
    return { ok: true };
  }

  rematch(hostId: string): Result {
    if (!this.find(hostId)?.isHost) return { ok: false, error: '방장만 다시 시작할 수 있어요.' };
    if (this.inGame) return { ok: false, error: '게임이 아직 끝나지 않았어요.' };
    this.game = null;
    // 끝난 게임 동안 나간 사람은 로비에서 정리
    for (const m of [...this.members]) if (!m.connected) m.dropTimer = setTimeout(() => this.remove(m.id), LOBBY_DROP_MS);
    this.broadcast();
    return { ok: true };
  }

  action(id: string | null, action: GameAction): Result {
    if (!this.game) return { ok: false, error: '게임이 시작되지 않았어요.' };
    const r = applyAction(this.game, id, action, rng);
    if (!r.ok) return r;
    this.game = r.state;
    this.afterChange();
    return { ok: true };
  }

  /** 상태가 바뀔 때마다: 자동 진행 타이머를 다시 잡고 모두에게 보낸다 */
  private afterChange() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
    this.revealTimers.forEach(clearTimeout);
    this.revealTimers = [];
    const g = this.game;
    let ms = 0;
    if (g?.phase === 'ROLE_REVEAL') ms = TIMINGS.roleRevealMs;
    else if (g?.phase === 'VOTE_REVEAL') ms = TIMINGS.voteRevealMs;
    else if (g?.phase === 'QUEST_REVEAL') {
      // 카드를 한 장씩 보낸다. 마지막 카드가 나간 뒤에야 결과가 뷰에 들어간다
      this.questShown = 0;
      g.questReveal.forEach((_, i) => {
        this.revealTimers.push(setTimeout(() => {
          this.questShown = i + 1;
          this.broadcast();
        }, TIMINGS.questRevealFirstMs + i * TIMINGS.questRevealPerCardMs));
      });
      ms = TIMINGS.questRevealFirstMs + (g.questReveal.length - 1) * TIMINGS.questRevealPerCardMs + TIMINGS.questRevealTailMs;
    }
    if (ms) this.phaseTimer = setTimeout(() => this.action(null, { type: 'ADVANCE' }), ms);
    this.broadcast();
  }

  viewFor(m: Member): RoomView {
    return {
      code: this.code,
      meId: m.id,
      players: this.members.map(({ id, nickname, seat, model, color, connected, isHost }) => ({ id, nickname, seat, model, color, connected, isHost })),
      options: this.options,
      game: this.game ? projectGame(this.game, m.id, this.questShown) : null,
    };
  }

  broadcast() {
    for (const m of this.members) if (m.socketId) this.io.to(m.socketId).emit('state', this.viewFor(m));
  }

  dispose() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.revealTimers.forEach(clearTimeout);
    this.members.forEach((m) => m.dropTimer && clearTimeout(m.dropTimer));
  }

  hostId() { return this.host()?.id; }
}
