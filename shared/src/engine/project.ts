import { QUEST_SIZES, ROLE_TEAM, doubleFailRound } from '../constants';
import type { GameState, GameView, Knowledge, Role } from '../types';

const bySeat = (s: GameState, ids: string[]) => [...ids].sort((a, b) => s.playerIds.indexOf(a) - s.playerIds.indexOf(b));

export function knowledgeFor(s: GameState, id: string): Knowledge[] {
  const role = s.roles[id];
  const ids = s.playerIds;
  const out: Knowledge[] = [];
  if (role === 'MERLIN') {
    out.push({ kind: 'EVIL_SEEN_BY_MERLIN', ids: ids.filter((p) => ROLE_TEAM[s.roles[p]] === 'EVIL' && s.roles[p] !== 'MORDRED') });
  } else if (role === 'PERCIVAL') {
    out.push({ kind: 'MERLIN_CANDIDATES', ids: bySeat(s, ids.filter((p) => s.roles[p] === 'MERLIN' || s.roles[p] === 'MORGANA')) });
  } else if (ROLE_TEAM[role] === 'EVIL') {
    out.push({ kind: 'FELLOW_EVIL', ids: ids.filter((p) => p !== id && ROLE_TEAM[s.roles[p]] === 'EVIL') });
  }
  for (const c of s.lady?.checks ?? []) if (c.by === id) out.push({ kind: 'LADY_RESULT', targetId: c.target, team: c.team });
  return out;
}

/**
 * 플레이어 id가 봐도 되는 정보만 담은 뷰.
 * questShown: 원정 결과 공개 중 지금까지 뒤집힌 카드 수. 다 뒤집히기 전에는 이번 원정 결과를 빼고 보낸다.
 */
export function projectGame(s: GameState, id: string, questShown = Infinity): GameView {
  const n = s.playerIds.length;
  const revealing = s.phase === 'QUEST_REVEAL';
  const shown = revealing ? Math.min(questShown, s.questReveal.length) : 0;
  const hideLatest = revealing && shown < s.questReveal.length;
  const history = structuredClone(s.history);
  if (hideLatest) delete history[history.length - 1].quest;
  const role = s.roles[id];
  let revealedRoles: Record<string, Role> | null = null;
  if (s.phase === 'GAME_OVER') revealedRoles = { ...s.roles };
  else if (s.phase === 'ASSASSINATION')
    revealedRoles = Object.fromEntries(s.playerIds.filter((p) => ROLE_TEAM[s.roles[p]] === 'EVIL').map((p) => [p, s.roles[p]]));

  const last = s.history[s.history.length - 1];
  return {
    phase: s.phase,
    round: s.round,
    attempt: s.attempt,
    rejects: s.rejects,
    leaderId: s.playerIds[s.leaderIdx],
    team: [...s.team],
    teamSizes: QUEST_SIZES[n],
    doubleFailRound: doubleFailRound(n),
    questResults: hideLatest ? s.questResults.slice(0, -1) : [...s.questResults],
    votedIds: s.phase === 'TEAM_VOTE' ? bySeat(s, Object.keys(s.votes)) : [],
    revealedVotes: s.phase === 'VOTE_REVEAL' && last ? { ...last.votes } : null,
    questSubmittedIds: s.phase === 'QUEST' ? bySeat(s, Object.keys(s.questCards)) : [],
    questReveal: revealing ? s.questReveal.slice(0, shown) : null,
    questRevealCount: revealing ? s.questReveal.length : null,
    ackCount: s.acks.length,
    lady: s.lady ? { holderId: s.lady.holderId, usedIds: [...s.lady.usedIds], log: s.lady.checks.map(({ by, target }) => ({ by, target })) } : null,
    history,
    revealedRoles,
    assassinTarget: s.assassinTarget,
    winner: s.winner,
    me: {
      role,
      team: ROLE_TEAM[role],
      knowledge: knowledgeFor(s, id),
      acked: s.acks.includes(id),
      voted: s.phase === 'TEAM_VOTE' && id in s.votes ? s.votes[id] : null,
      questCard: s.phase === 'QUEST' && id in s.questCards ? s.questCards[id] : null,
    },
  };
}
