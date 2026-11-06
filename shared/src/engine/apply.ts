import { QUEST_SIZES, ROLE_TEAM, failsNeeded } from '../constants';
import type { GameAction, GameState } from '../types';
import { shuffle, type Rng } from './setup';

export type ApplyResult = { ok: true; state: GameState } | { ok: false; error: string };

const fail = (error: string): ApplyResult => ({ ok: false, error });

export const teamSize = (s: GameState) => QUEST_SIZES[s.playerIds.length][s.round];
export const leaderId = (s: GameState) => s.playerIds[s.leaderIdx];
const count = (rs: string[], r: string) => rs.filter((x) => x === r).length;

function nextLeader(s: GameState) {
  s.leaderIdx = (s.leaderIdx + 1) % s.playerIds.length;
  s.team = [];
  s.votes = {};
  s.phase = 'TEAM_BUILDING';
}

function nextRound(s: GameState) {
  s.round += 1;
  s.attempt = 1;
  s.questCards = {};
  s.questReveal = [];
  nextLeader(s);
}

/**
 * 액션 하나를 적용한다. actorId가 null이면 서버(타이머)가 보낸 것.
 * 원본 state는 건드리지 않고 새 state를 돌려준다.
 */
export function applyAction(prev: GameState, actorId: string | null, action: GameAction, rng: Rng): ApplyResult {
  const s: GameState = structuredClone(prev);
  if (action.type === 'ADVANCE') {
    if (actorId !== null) return fail('서버만 진행할 수 있어요.');
  } else if (actorId === null || !s.playerIds.includes(actorId)) {
    return fail('이 게임의 참가자가 아니에요.');
  }
  const me = actorId as string;
  const n = s.playerIds.length;

  switch (action.type) {
    case 'ACK_ROLE': {
      if (s.phase !== 'ROLE_REVEAL') return fail('지금은 역할을 확인하는 단계가 아니에요.');
      if (!s.acks.includes(me)) s.acks.push(me);
      if (s.acks.length === n) s.phase = 'TEAM_BUILDING';
      return { ok: true, state: s };
    }

    case 'TOGGLE_TEAM_MEMBER': {
      if (s.phase !== 'TEAM_BUILDING') return fail('지금은 원정대를 꾸리는 단계가 아니에요.');
      if (me !== leaderId(s)) return fail('원정대장만 원정대원을 고를 수 있어요.');
      if (!s.playerIds.includes(action.playerId)) return fail('없는 사람이에요.');
      if (s.team.includes(action.playerId)) s.team = s.team.filter((id) => id !== action.playerId);
      else if (s.team.length >= teamSize(s)) return fail(`이번 원정대는 ${teamSize(s)}명이에요. 먼저 한 명을 빼 주세요.`);
      else s.team.push(action.playerId);
      return { ok: true, state: s };
    }

    case 'CONFIRM_TEAM': {
      if (s.phase !== 'TEAM_BUILDING') return fail('지금은 원정대를 꾸리는 단계가 아니에요.');
      if (me !== leaderId(s)) return fail('원정대장만 원정대를 확정할 수 있어요.');
      if (s.team.length !== teamSize(s)) return fail(`원정대원 ${teamSize(s)}명을 골라 주세요.`);
      s.phase = 'TEAM_VOTE';
      s.votes = {};
      return { ok: true, state: s };
    }

    case 'VOTE': {
      if (s.phase !== 'TEAM_VOTE') return fail('지금은 투표하는 단계가 아니에요.');
      s.votes[me] = action.approve;
      if (Object.keys(s.votes).length === n) {
        const yes = Object.values(s.votes).filter(Boolean).length;
        const approved = yes > n - yes;
        s.history.push({ round: s.round, attempt: s.attempt, leaderId: leaderId(s), team: [...s.team], votes: { ...s.votes }, approved });
        s.phase = 'VOTE_REVEAL';
      }
      return { ok: true, state: s };
    }

    case 'QUEST_CARD': {
      if (s.phase !== 'QUEST') return fail('지금은 원정 단계가 아니에요.');
      if (!s.team.includes(me)) return fail('원정대원만 원정 카드를 낼 수 있어요.');
      if (me in s.questCards) return fail('이미 원정 카드를 냈어요.');
      if (!action.success && ROLE_TEAM[s.roles[me]] === 'GOOD') return fail('선의 세력은 성공 카드만 낼 수 있어요.');
      s.questCards[me] = action.success;
      if (Object.keys(s.questCards).length === s.team.length) {
        const cards = Object.values(s.questCards);
        const fails = cards.filter((c) => !c).length;
        const result = fails >= failsNeeded(n, s.round) ? 'FAIL' : 'SUCCESS';
        s.questResults.push(result);
        s.questReveal = shuffle(cards, rng);
        s.history[s.history.length - 1].quest = { fails, result };
        s.phase = 'QUEST_REVEAL';
      }
      return { ok: true, state: s };
    }

    case 'LADY_TARGET': {
      if (s.phase !== 'LADY' || !s.lady) return fail('지금은 호수의 여인 단계가 아니에요.');
      if (me !== s.lady.holderId) return fail('호수의 여인 토큰을 가진 사람만 확인할 수 있어요.');
      if (!s.playerIds.includes(action.playerId)) return fail('없는 사람이에요.');
      if (s.lady.usedIds.includes(action.playerId)) return fail('이미 토큰을 가졌던 사람은 확인할 수 없어요.');
      s.lady.checks.push({ by: me, target: action.playerId, team: ROLE_TEAM[s.roles[action.playerId]] });
      s.lady.holderId = action.playerId;
      s.lady.usedIds.push(action.playerId);
      nextRound(s);
      return { ok: true, state: s };
    }

    case 'ASSASSINATE': {
      if (s.phase !== 'ASSASSINATION') return fail('지금은 암살 단계가 아니에요.');
      if (s.roles[me] !== 'ASSASSIN') return fail('암살자만 지목할 수 있어요.');
      if (!s.playerIds.includes(action.playerId) || ROLE_TEAM[s.roles[action.playerId]] !== 'GOOD')
        return fail('선의 세력 중에서 지목해 주세요.');
      s.assassinTarget = action.playerId;
      const hit = s.roles[action.playerId] === 'MERLIN';
      s.winner = hit ? { team: 'EVIL', reason: 'ASSASSIN_HIT' } : { team: 'GOOD', reason: 'ASSASSIN_MISS' };
      s.phase = 'GAME_OVER';
      return { ok: true, state: s };
    }

    case 'ADVANCE': {
      if (s.phase === 'ROLE_REVEAL') {
        s.phase = 'TEAM_BUILDING';
      } else if (s.phase === 'VOTE_REVEAL') {
        const last = s.history[s.history.length - 1];
        if (last.approved) {
          s.rejects = 0;
          s.questCards = {};
          s.phase = 'QUEST';
        } else {
          s.rejects += 1;
          if (s.rejects >= 5) {
            s.winner = { team: 'EVIL', reason: 'REJECTS' };
            s.phase = 'GAME_OVER';
          } else {
            s.attempt += 1;
            nextLeader(s);
          }
        }
      } else if (s.phase === 'QUEST_REVEAL') {
        const wins = count(s.questResults, 'SUCCESS');
        const losses = count(s.questResults, 'FAIL');
        if (losses >= 3) {
          s.winner = { team: 'EVIL', reason: 'QUESTS' };
          s.phase = 'GAME_OVER';
        } else if (wins >= 3) {
          s.phase = 'ASSASSINATION';
        } else if (s.lady && s.round >= 1 && s.round <= 3) {
          s.phase = 'LADY';
        } else {
          nextRound(s);
        }
      } else {
        return fail('자동으로 넘어가는 단계가 아니에요.');
      }
      return { ok: true, state: s };
    }

    default:
      return fail('알 수 없는 행동이에요.');
  }
}
