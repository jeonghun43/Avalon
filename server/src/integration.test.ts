import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { RoomView } from '@avalon/shared';

// 실행마다 다른 포트: 이전 실행의 서버가 남아 있어도 막히지 않게
const PORT = 40_000 + Math.floor(Math.random() * 10_000);
const URL = `http://localhost:${PORT}`;
let server: ChildProcess;

beforeAll(async () => {
  server = spawn('npx', ['tsx', 'server/src/index.ts'], { env: { ...process.env, PORT: String(PORT), CHAT_TTL_MS: '1500' }, shell: true, stdio: 'pipe' });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 20_000);
    server.stdout!.on('data', (d) => { if (String(d).includes('실행 중')) { clearTimeout(t); resolve(); } });
    server.on('exit', (code) => { clearTimeout(t); reject(new Error(`server exited early (code ${code})`)); });
  });
}, 30_000);

// 서버(와 shell이 띄운 자식 프로세스)가 정말 끝날 때까지 기다린다
afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']).on('exit', () => resolve());
    else { server.on('exit', () => resolve()); server.kill(); }
  });
});

interface Bot { s: Socket; view: RoomView | null; token: string }

function bot(): Bot {
  const b: Bot = { s: io(URL, { transports: ['websocket'], forceNew: true }), view: null, token: '' };
  b.s.on('state', (v: RoomView) => (b.view = v));
  return b;
}
const emit = <T = any>(b: Bot, ev: string, p?: unknown) => new Promise<T>((res) => b.s.emit(ev, p, res));
const until = async (cond: () => boolean, ms = 15_000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 30));
  }
};

describe('서버 통합', () => {
  it('5명이 방에 모여 한 판을 끝까지 하고, 중간에 재접속해도 같은 역할로 돌아온다', async () => {
    const bots = Array.from({ length: 5 }, bot);
    const created = await emit(bots[0], 'room:create', { nickname: '방장' });
    expect(created.ok).toBe(true);
    bots[0].token = created.token;
    const code = created.code as string;

    const bad = await emit(bots[1], 'room:join', { code: 'ZZZZ', nickname: 'x' });
    expect(bad.ok).toBe(false);
    for (let i = 1; i < 5; i++) {
      const r = await emit(bots[i], 'room:join', { code, nickname: `봇${i}` });
      expect(r.ok).toBe(true);
      bots[i].token = r.token;
    }
    const dup = await emit(bot(), 'room:join', { code, nickname: '봇1' });
    expect(dup.ok).toBe(false);

    await until(() => bots.every((b) => b.view?.players.length === 5));
    const models = new Set(bots[0].view!.players.map((p) => p.model));
    expect(models.size).toBe(5);

    expect((await emit(bots[1], 'game:start')).ok).toBe(false); // 방장 아님
    expect((await emit(bots[0], 'game:start')).ok).toBe(true);
    await until(() => bots.every((b) => b.view?.game?.phase === 'ROLE_REVEAL'));

    // 다른 사람의 역할은 받은 데이터 어디에도 없어야 한다
    const roleOf = (b: Bot) => b.view!.game!.me.role;
    const roleBefore = roleOf(bots[2]);

    // 재접속: 소켓을 끊고 새 소켓으로 resume
    bots[2].s.disconnect();
    await until(() => bots[0].view!.players.find((p) => p.nickname === '봇2')!.connected === false);
    const re = bot();
    re.token = bots[2].token;
    expect((await emit(re, 'room:resume', { code, token: bots[2].token })).ok).toBe(true);
    bots[2] = re;
    await until(() => re.view?.game?.phase === 'ROLE_REVEAL');
    expect(roleOf(re)).toBe(roleBefore);

    // 브라우저를 닫았다가(세션 토큰 없음) 같은 닉네임으로 다시 입장하면 원래 자리로 복귀
    const role3 = roleOf(bots[3]);
    bots[3].s.disconnect();
    await until(() => bots[0].view!.players.find((p) => p.nickname === '봇3')!.connected === false);
    const back = bot();
    const rj = await emit(back, 'room:join', { code, nickname: '봇3' });
    expect(rj.ok).toBe(true);
    bots[3] = back;
    await until(() => back.view?.game?.phase === 'ROLE_REVEAL');
    expect(roleOf(back)).toBe(role3);
    // 연결된 사람의 닉네임으로는 들어올 수 없고, 새 사람은 게임 중에 들어올 수 없다
    expect((await emit(bot(), 'room:join', { code, nickname: '봇1' })).ok).toBe(false);
    expect((await emit(bot(), 'room:join', { code, nickname: '새사람' })).ok).toBe(false);
    expect((await emit(bots[0], 'game:action', { type: 'NOPE' })).ok).toBe(false);

    for (const b of bots) await emit(b, 'game:action', { type: 'ACK_ROLE' });

    // 간단한 봇: 원정대장은 앞사람부터 고르고, 모두 찬성, 모두 성공
    const deadline = Date.now() + 60_000;
    while (bots[0].view!.game!.phase !== 'GAME_OVER') {
      if (Date.now() > deadline) throw new Error('game did not finish');
      const g = bots[0].view!.game!;
      const players = bots[0].view!.players;
      if (g.phase === 'TEAM_BUILDING') {
        const leader = bots.find((b) => b.view!.meId === g.leaderId)!;
        const size = g.teamSizes[g.round];
        const lg = leader.view!.game!;
        if (lg.team.length < size) {
          const next = players.find((p) => !lg.team.includes(p.id))!;
          await emit(leader, 'game:action', { type: 'TOGGLE_TEAM_MEMBER', playerId: next.id });
        } else await emit(leader, 'game:action', { type: 'CONFIRM_TEAM' });
      } else if (g.phase === 'TEAM_VOTE') {
        for (const b of bots) if (b.view!.game!.me.voted === null) await emit(b, 'game:action', { type: 'VOTE', approve: true });
      } else if (g.phase === 'QUEST') {
        for (const b of bots) {
          const bg = b.view!.game!;
          if (bg.team.includes(b.view!.meId) && bg.me.questCard === null) await emit(b, 'game:action', { type: 'QUEST_CARD', success: true });
        }
      } else if (g.phase === 'ASSASSINATION') {
        const assassin = bots.find((b) => b.view!.game!.me.role === 'ASSASSIN')!;
        const goodTarget = players.find((p) => !(p.id in (g.revealedRoles ?? {})))!;
        await emit(assassin, 'game:action', { type: 'ASSASSINATE', playerId: goodTarget.id });
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    const end = bots[0].view!.game!;
    expect(end.questResults).toEqual(['SUCCESS', 'SUCCESS', 'SUCCESS']);
    expect(Object.keys(end.revealedRoles!).length).toBe(5);

    // 결과 화면에서 한 명이 나가도 다른 사람들의 결과 화면은 유지된다
    bots[4].s.disconnect();
    await until(() => bots[0].view!.players.find((p) => p.nickname === '봇4')!.connected === false);
    expect(bots[0].view!.game?.phase).toBe('GAME_OVER');

    expect((await emit(bots[0], 'game:rematch')).ok).toBe(true);
    await until(() => bots.slice(0, 4).every((b) => b.view?.game === null));
    bots.forEach((b) => b.s.disconnect());
  }, 90_000);
});

describe('채팅', () => {
  it('전달, 16자 제한, 도배 차단, 재접속 때 남은 말만, 만료 삭제', async () => {
    const [a, b] = [bot(), bot()];
    const got: { text: string; nickname: string }[] = [];
    b.s.on('chat:new', (m) => got.push(m));
    const made = await emit(a, 'room:create', { nickname: '말하는사람' });
    const code = made.code as string;
    expect((await emit(b, 'room:join', { code, nickname: '듣는사람' })).ok).toBe(true);

    expect((await emit(a, 'chat:send', { text: '  안녕하세요  ' })).ok).toBe(true);
    await until(() => got.length === 1);
    expect(got[0]).toMatchObject({ text: '안녕하세요', nickname: '말하는사람' });

    expect((await emit(a, 'chat:send', { text: '가'.repeat(17) })).ok).toBe(false);
    expect((await emit(a, 'chat:send', { text: '가'.repeat(16) })).ok).toBe(true);
    expect((await emit(a, 'chat:send', { text: '   ' })).ok).toBe(false);

    // 연속으로 보내면 통이 비어서 막힌다 (처음 5개 중 2개는 이미 씀)
    const burst = [];
    for (let i = 0; i < 6; i++) burst.push((await emit(a, 'chat:send', { text: `도배${i}` })).ok);
    expect(burst).toContain(false);

    // 새로 들어온 사람은 아직 안 사라진 말을 받는다
    const c = bot();
    let history: unknown[] = [];
    c.s.on('chat:history', (h) => (history = h));
    await emit(c, 'room:join', { code, nickname: '늦은사람' });
    await until(() => history.length > 0);

    // 1.5초(테스트용 유지 시간)가 지나면 새로 들어온 사람은 아무것도 받지 않는다
    await new Promise((r) => setTimeout(r, 1700));
    const d = bot();
    let history2: unknown[] | null = null;
    d.s.on('chat:history', (h) => (history2 = h));
    await emit(d, 'room:join', { code, nickname: '더늦은사람' });
    await until(() => history2 !== null);
    expect(history2).toEqual([]);
    [a, b, c, d].forEach((x) => x.s.disconnect());
  }, 30_000);
});
