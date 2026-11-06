import { describe, expect, it } from 'vitest';
import {
  QUEST_SIZES, ROLE_TEAM, TEAM_COUNTS, applyAction, createGame, leaderId, projectGame, rolesFor, teamSize, validateSetup,
  type GameAction, type GameState, type Role, type RoomOptions,
} from './index';

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NONE: RoomOptions = { percivalMorgana: false, mordred: false, ladyOfTheLake: false };
const ALL: RoomOptions = { percivalMorgana: true, mordred: true, ladyOfTheLake: true };
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function act(s: GameState, actor: string | null, a: GameAction): GameState {
  const r = applyAction(s, actor, a, mulberry32(7));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
function expectError(s: GameState, actor: string | null, a: GameAction) {
  const r = applyAction(s, actor, a, mulberry32(7));
  expect(r.ok).toBe(false);
}
/** 역할을 고정해서 게임을 만든다 */
function withRoles(roles: Role[], options = NONE): GameState {
  const s = createGame(ids(roles.length), options, mulberry32(1));
  s.roles = Object.fromEntries(roles.map((r, i) => [`p${i}`, r]));
  s.leaderIdx = 0;
  if (s.lady) s.lady = { holderId: `p${roles.length - 1}`, usedIds: [`p${roles.length - 1}`], checks: [] };
  return s;
}
const ackAll = (s: GameState) => s.playerIds.reduce((st, p) => act(st, p, { type: 'ACK_ROLE' }), s);
function proposeAndVote(s: GameState, team: string[], approve: boolean | ((p: string) => boolean)) {
  const L = leaderId(s);
  for (const p of team) s = act(s, L, { type: 'TOGGLE_TEAM_MEMBER', playerId: p });
  s = act(s, L, { type: 'CONFIRM_TEAM' });
  for (const p of s.playerIds) s = act(s, p, { type: 'VOTE', approve: typeof approve === 'function' ? approve(p) : approve });
  return act(s, null, { type: 'ADVANCE' });
}
function quest(s: GameState, fails: string[] = []) {
  for (const p of s.team) s = act(s, p, { type: 'QUEST_CARD', success: !fails.includes(p) });
  return act(s, null, { type: 'ADVANCE' });
}

describe('구성', () => {
  it('인원별 선·악 숫자를 지킨다', () => {
    for (let n = 5; n <= 10; n++) {
      for (const o of [NONE, { ...NONE, percivalMorgana: true }, { ...NONE, mordred: true }]) {
        const rs = rolesFor(n, o);
        expect(rs.filter((r) => ROLE_TEAM[r] === 'GOOD').length).toBe(TEAM_COUNTS[n][0]);
        expect(rs.filter((r) => ROLE_TEAM[r] === 'EVIL').length).toBe(TEAM_COUNTS[n][1]);
        expect(rs).toContain('MERLIN');
        expect(rs).toContain('ASSASSIN');
      }
    }
  });
  it('5·6인에서는 모르가나와 모드레드를 함께 켤 수 없다', () => {
    expect(validateSetup(5, ALL)).not.toBeNull();
    expect(validateSetup(6, ALL)).not.toBeNull();
    expect(validateSetup(7, ALL)).toBeNull();
    expect(validateSetup(4, NONE)).not.toBeNull();
  });
  it('호수의 여인은 첫 원정대장의 오른쪽 사람이 받는다', () => {
    const s = createGame(ids(7), ALL, mulberry32(3));
    expect(s.lady!.holderId).toBe(s.playerIds[(s.leaderIdx + 6) % 7]);
  });
});

describe('아는 정보', () => {
  const s = withRoles(['MERLIN', 'PERCIVAL', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MORGANA', 'MORDRED'], ALL);
  it('멀린은 모드레드를 보지 못한다', () => {
    const k = projectGame(s, 'p0').me.knowledge[0];
    expect(k).toEqual({ kind: 'EVIL_SEEN_BY_MERLIN', ids: ['p4', 'p5'] });
  });
  it('퍼시발은 멀린과 모르가나를 후보로 본다', () => {
    expect(projectGame(s, 'p1').me.knowledge[0]).toEqual({ kind: 'MERLIN_CANDIDATES', ids: ['p0', 'p5'] });
  });
  it('악은 서로를 안다', () => {
    expect(projectGame(s, 'p6').me.knowledge[0]).toEqual({ kind: 'FELLOW_EVIL', ids: ['p4', 'p5'] });
  });
  it('기사는 아무것도 모른다', () => {
    expect(projectGame(s, 'p2').me.knowledge).toEqual([]);
  });
});

describe('진행', () => {
  it('전원이 역할을 확인하면 원정대 구성으로 넘어간다', () => {
    let s = withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']);
    s = act(s, 'p0', { type: 'ACK_ROLE' });
    expect(s.phase).toBe('ROLE_REVEAL');
    s = ackAll(s);
    expect(s.phase).toBe('TEAM_BUILDING');
  });
  it('원정대장만 고를 수 있고 인원을 넘길 수 없다', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    expectError(s, 'p1', { type: 'TOGGLE_TEAM_MEMBER', playerId: 'p1' });
    s = act(s, 'p0', { type: 'TOGGLE_TEAM_MEMBER', playerId: 'p1' });
    s = act(s, 'p0', { type: 'TOGGLE_TEAM_MEMBER', playerId: 'p2' });
    expectError(s, 'p0', { type: 'TOGGLE_TEAM_MEMBER', playerId: 'p3' });
    s = act(s, 'p0', { type: 'TOGGLE_TEAM_MEMBER', playerId: 'p2' });
    expectError(s, 'p0', { type: 'CONFIRM_TEAM' });
  });
  it('동점이면 부결, 원정대장이 넘어가고 거부 트랙이 오른다', () => {
    let s = ackAll(withRoles(['MERLIN', 'PERCIVAL', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MORGANA']));
    s = proposeAndVote(s, ['p0', 'p1'], (p) => ['p0', 'p1', 'p2'].includes(p));
    expect(s.phase).toBe('TEAM_BUILDING');
    expect(s.rejects).toBe(1);
    expect(leaderId(s)).toBe('p1');
    expect(s.history[0].approved).toBe(false);
  });
  it('5번 연속 부결되면 악이 이긴다', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    for (let i = 0; i < 5; i++) s = proposeAndVote(s, s.playerIds.slice(0, teamSize(s)), false);
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).toEqual({ team: 'EVIL', reason: 'REJECTS' });
  });
  it('가결되면 거부 트랙이 0이 된다', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    s = proposeAndVote(s, ['p0', 'p1'], false);
    s = proposeAndVote(s, ['p0', 'p1'], true);
    expect(s.phase).toBe('QUEST');
    expect(s.rejects).toBe(0);
  });
  it('선은 실패 카드를 낼 수 없고, 같은 사람이 두 번 낼 수 없다', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    s = proposeAndVote(s, ['p0', 'p3'], true);
    expectError(s, 'p0', { type: 'QUEST_CARD', success: false });
    expectError(s, 'p1', { type: 'QUEST_CARD', success: true });
    s = act(s, 'p3', { type: 'QUEST_CARD', success: false });
    expectError(s, 'p3', { type: 'QUEST_CARD', success: true });
  });
  it('7인 이상 4라운드는 실패 2장이 있어야 실패한다', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION', 'MINION']));
    s = proposeAndVote(s, ['p0', 'p1'], true); s = quest(s);           // R1 성공
    s = proposeAndVote(s, ['p0', 'p1', 'p4'], true); s = quest(s, ['p4']); // R2 실패
    s = proposeAndVote(s, ['p0', 'p1', 'p5'], true); s = quest(s, ['p5']); // R3 실패
    s = proposeAndVote(s, ['p0', 'p1', 'p2', 'p4'], true);
    s = quest(s, ['p4']);                                                  // R4 실패 1장 → 성공
    expect(s.questResults).toEqual(['SUCCESS', 'FAIL', 'FAIL', 'SUCCESS']);
    s = proposeAndVote(s, ['p0', 'p1', 'p2', 'p4'], true);
    s = quest(s, ['p4']);
    expect(s.winner).toEqual({ team: 'EVIL', reason: 'QUESTS' });
  });
  it('선이 3승하면 암살 단계, 멀린을 맞히면 악 승리', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    for (let i = 0; i < 3; i++) { s = proposeAndVote(s, s.playerIds.slice(0, teamSize(s)).filter((p) => p !== 'p3' && p !== 'p4').concat(['p1', 'p2', 'p0']).filter((v, j, a) => a.indexOf(v) === j).slice(0, teamSize(s)), true); s = quest(s); }
    expect(s.phase).toBe('ASSASSINATION');
    expect(projectGame(s, 'p0').revealedRoles).toEqual({ p3: 'ASSASSIN', p4: 'MINION' });
    expectError(s, 'p4', { type: 'ASSASSINATE', playerId: 'p0' });
    expectError(s, 'p3', { type: 'ASSASSINATE', playerId: 'p4' });
    const hit = act(s, 'p3', { type: 'ASSASSINATE', playerId: 'p0' });
    expect(hit.winner).toEqual({ team: 'EVIL', reason: 'ASSASSIN_HIT' });
    const miss = act(s, 'p3', { type: 'ASSASSINATE', playerId: 'p1' });
    expect(miss.winner).toEqual({ team: 'GOOD', reason: 'ASSASSIN_MISS' });
  });
  it('호수의 여인: 2라운드 뒤 확인, 결과는 본인만 안다, 토큰이 넘어간다', () => {
    let s = ackAll(withRoles(['MERLIN', 'PERCIVAL', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MORGANA', 'MINION'], { ...NONE, percivalMorgana: true, ladyOfTheLake: true }));
    s = proposeAndVote(s, ['p0', 'p1'], true); s = quest(s);
    expect(s.phase).toBe('TEAM_BUILDING');
    s = proposeAndVote(s, ['p1', 'p2', 'p3'], true); s = quest(s);
    expect(s.phase).toBe('LADY');
    expectError(s, 'p0', { type: 'LADY_TARGET', playerId: 'p4' });
    expectError(s, 'p6', { type: 'LADY_TARGET', playerId: 'p6' });
    s = act(s, 'p6', { type: 'LADY_TARGET', playerId: 'p4' });
    expect(s.phase).toBe('TEAM_BUILDING');
    expect(s.round).toBe(2);
    expect(projectGame(s, 'p6').me.knowledge).toContainEqual({ kind: 'LADY_RESULT', targetId: 'p4', team: 'EVIL' });
    expect(JSON.stringify(projectGame(s, 'p0'))).not.toContain('"team":"EVIL"');
    expect(s.lady!.holderId).toBe('p4');
  });
});

describe('정보 누출', () => {
  it('진행 중에는 다른 사람의 역할, 공개 전 투표, 원정 카드 주인이 뷰에 없다', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    const L = leaderId(s);
    s = act(s, L, { type: 'TOGGLE_TEAM_MEMBER', playerId: 'p1' });
    s = act(s, L, { type: 'TOGGLE_TEAM_MEMBER', playerId: 'p3' });
    s = act(s, L, { type: 'CONFIRM_TEAM' });
    s = act(s, 'p0', { type: 'VOTE', approve: false });
    for (const p of s.playerIds) {
      const v = projectGame(s, p);
      expect(v.revealedRoles).toBeNull();
      expect(v.revealedVotes).toBeNull();
      expect(v.votedIds).toEqual(['p0']);
      if (p !== 'p0') expect(v.me.voted).toBeNull();
      const others = s.playerIds.filter((o) => o !== p).map((o) => s.roles[o]);
      const text = JSON.stringify({ ...v, me: { ...v.me, role: null, knowledge: null } });
      for (const r of others) expect(text).not.toContain(`"${r}"`);
    }
    for (const p of s.playerIds.slice(1)) s = act(s, p, { type: 'VOTE', approve: true });
    s = act(s, null, { type: 'ADVANCE' });
    s = act(s, 'p3', { type: 'QUEST_CARD', success: false });
    for (const p of s.playerIds) {
      const v = projectGame(s, p);
      expect(v.questSubmittedIds).toEqual(['p3']);
      expect(p === 'p3' ? v.me.questCard : v.me.questCard).toBe(p === 'p3' ? false : null);
    }
  });
});

describe('무작위 시뮬레이션', () => {
  it('5~10인 600판이 모두 예외 없이 끝난다', () => {
    const rng = mulberry32(42);
    const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
    let ended = 0;
    for (let g = 0; g < 600; g++) {
      const n = 5 + (g % 6);
      const opts: RoomOptions = { percivalMorgana: rng() < 0.5, mordred: n >= 7 && rng() < 0.5, ladyOfTheLake: rng() < 0.5 };
      let s = createGame(ids(n), opts, rng);
      for (let step = 0; step < 500 && s.phase !== 'GAME_OVER'; step++) {
        let r;
        switch (s.phase) {
          case 'ROLE_REVEAL': r = applyAction(s, null, { type: 'ADVANCE' }, rng); break;
          case 'TEAM_BUILDING': {
            const L = leaderId(s);
            if (s.team.length < teamSize(s)) {
              const free = s.playerIds.filter((p) => !s.team.includes(p));
              r = applyAction(s, L, { type: 'TOGGLE_TEAM_MEMBER', playerId: pick(free) }, rng);
            } else r = applyAction(s, L, { type: 'CONFIRM_TEAM' }, rng);
            break;
          }
          case 'TEAM_VOTE': {
            const p = s.playerIds.find((x) => !(x in s.votes))!;
            r = applyAction(s, p, { type: 'VOTE', approve: rng() < 0.6 }, rng);
            break;
          }
          case 'QUEST': {
            const p = s.team.find((x) => !(x in s.questCards))!;
            r = applyAction(s, p, { type: 'QUEST_CARD', success: ROLE_TEAM[s.roles[p]] === 'GOOD' || rng() < 0.5 }, rng);
            break;
          }
          case 'LADY': {
            const t = pick(s.playerIds.filter((p) => !s.lady!.usedIds.includes(p)));
            r = applyAction(s, s.lady!.holderId, { type: 'LADY_TARGET', playerId: t }, rng);
            break;
          }
          case 'ASSASSINATION': {
            const a = s.playerIds.find((p) => s.roles[p] === 'ASSASSIN')!;
            r = applyAction(s, a, { type: 'ASSASSINATE', playerId: pick(s.playerIds.filter((p) => ROLE_TEAM[s.roles[p]] === 'GOOD')) }, rng);
            break;
          }
          default: r = applyAction(s, null, { type: 'ADVANCE' }, rng);
        }
        if (!r.ok) throw new Error(`${s.phase}: ${r.error}`);
        s = r.state;
        for (const p of s.playerIds) projectGame(s, p);
      }
      expect(s.phase).toBe('GAME_OVER');
      expect(s.questResults.length).toBeLessThanOrEqual(QUEST_SIZES[n].length);
      ended++;
    }
    expect(ended).toBe(600);
  });
});

describe('원정 결과 공개 순서', () => {
  it('카드가 다 뒤집히기 전에는 이번 원정 결과가 뷰에 없다', () => {
    let s = ackAll(withRoles(['MERLIN', 'LOYAL_SERVANT', 'LOYAL_SERVANT', 'ASSASSIN', 'MINION']));
    s = proposeAndVote(s, ['p0', 'p3'], true);
    s = act(s, 'p0', { type: 'QUEST_CARD', success: true });
    s = act(s, 'p3', { type: 'QUEST_CARD', success: false });
    expect(s.phase).toBe('QUEST_REVEAL');
    for (const shown of [0, 1]) {
      const v = projectGame(s, 'p1', shown);
      expect(v.questReveal).toHaveLength(shown);
      expect(v.questRevealCount).toBe(2);
      expect(v.questResults).toEqual([]);
      expect(v.history[0].quest).toBeUndefined();
    }
    const done = projectGame(s, 'p1', 2);
    expect(done.questResults).toEqual(['FAIL']);
    expect(done.history[0].quest).toEqual({ fails: 1, result: 'FAIL' });
  });
});
