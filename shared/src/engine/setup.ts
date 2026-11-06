import { MAX_PLAYERS, MIN_PLAYERS, TEAM_COUNTS } from '../constants';
import type { GameState, Role, RoomOptions } from '../types';

export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 시작할 수 없는 이유를 돌려준다. 시작 가능하면 null */
export function validateSetup(n: number, o: RoomOptions): string | null {
  if (n < MIN_PLAYERS) return `${MIN_PLAYERS}명 이상 모여야 시작할 수 있어요.`;
  if (n > MAX_PLAYERS) return `최대 ${MAX_PLAYERS}명까지 플레이할 수 있어요.`;
  const evil = TEAM_COUNTS[n][1];
  const evilSpecials = 1 + (o.percivalMorgana ? 1 : 0) + (o.mordred ? 1 : 0);
  if (evilSpecials > evil) return `${n}인 게임은 악의 세력이 ${evil}명이라 모르가나와 모드레드를 함께 넣을 수 없어요.`;
  return null;
}

export function rolesFor(n: number, o: RoomOptions): Role[] {
  const [good, evil] = TEAM_COUNTS[n];
  const g: Role[] = ['MERLIN'];
  if (o.percivalMorgana) g.push('PERCIVAL');
  while (g.length < good) g.push('LOYAL_SERVANT');
  const e: Role[] = ['ASSASSIN'];
  if (o.percivalMorgana) e.push('MORGANA');
  if (o.mordred) e.push('MORDRED');
  while (e.length < evil) e.push('MINION');
  return [...g, ...e];
}

export function createGame(playerIds: string[], options: RoomOptions, rng: Rng): GameState {
  const n = playerIds.length;
  const err = validateSetup(n, options);
  if (err) throw new Error(err);
  const roles = shuffle(rolesFor(n, options), rng);
  const leaderIdx = Math.floor(rng() * n);
  // 호수의 여인은 첫 원정대장의 오른쪽(자리 순서상 이전) 사람이 받는다
  const ladyHolder = playerIds[(leaderIdx - 1 + n) % n];
  return {
    phase: 'ROLE_REVEAL',
    playerIds: [...playerIds],
    options: { ...options },
    roles: Object.fromEntries(playerIds.map((id, i) => [id, roles[i]])),
    leaderIdx,
    round: 0,
    attempt: 1,
    rejects: 0,
    team: [],
    votes: {},
    questCards: {},
    questResults: [],
    questReveal: [],
    acks: [],
    lady: options.ladyOfTheLake ? { holderId: ladyHolder, usedIds: [ladyHolder], checks: [] } : null,
    history: [],
    assassinTarget: null,
    winner: null,
  };
}
