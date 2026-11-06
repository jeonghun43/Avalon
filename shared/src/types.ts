import type { CharacterId } from './characters';

export type Phase =
  | 'LOBBY' | 'ROLE_REVEAL' | 'TEAM_BUILDING' | 'TEAM_VOTE' | 'VOTE_REVEAL'
  | 'QUEST' | 'QUEST_REVEAL' | 'LADY' | 'ASSASSINATION' | 'GAME_OVER';

export type Role = 'MERLIN' | 'PERCIVAL' | 'LOYAL_SERVANT' | 'ASSASSIN' | 'MORGANA' | 'MORDRED' | 'MINION';
export type Team = 'GOOD' | 'EVIL';
export type QuestResult = 'SUCCESS' | 'FAIL';
export type WinReason = 'QUESTS' | 'REJECTS' | 'ASSASSIN_HIT' | 'ASSASSIN_MISS';

export interface RoomOptions {
  percivalMorgana: boolean;
  mordred: boolean;
  ladyOfTheLake: boolean;
}

export interface PlayerInfo {
  id: string;
  nickname: string;
  seat: number;
  model: CharacterId;
  color: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoundRecord {
  round: number;            // 0..4
  attempt: number;          // 같은 라운드에서 몇 번째 원정대인지 (1부터)
  leaderId: string;
  team: string[];
  votes: Record<string, boolean>;
  approved: boolean;
  quest?: { fails: number; result: QuestResult };
}

export interface LadyCheck { by: string; target: string; team: Team }

/** 서버만 가지는 전체 게임 상태 */
export interface GameState {
  phase: Phase;
  playerIds: string[];                 // 자리 순서
  options: RoomOptions;
  roles: Record<string, Role>;
  leaderIdx: number;
  round: number;
  attempt: number;
  rejects: number;
  team: string[];
  votes: Record<string, boolean>;
  questCards: Record<string, boolean>;
  questResults: QuestResult[];
  questReveal: boolean[];              // 섞인 원정 카드 (QUEST_REVEAL 동안)
  acks: string[];
  lady: { holderId: string; usedIds: string[]; checks: LadyCheck[] } | null;
  history: RoundRecord[];
  assassinTarget: string | null;
  winner: { team: Team; reason: WinReason } | null;
}

export type Knowledge =
  | { kind: 'EVIL_SEEN_BY_MERLIN'; ids: string[] }
  | { kind: 'MERLIN_CANDIDATES'; ids: string[] }
  | { kind: 'FELLOW_EVIL'; ids: string[] }
  | { kind: 'LADY_RESULT'; targetId: string; team: Team };

/** 플레이어 한 명이 받는 게임 정보 (비공개 정보가 걸러짐) */
export interface GameView {
  phase: Phase;
  round: number;
  attempt: number;
  rejects: number;
  leaderId: string;
  team: string[];
  teamSizes: number[];
  doubleFailRound: number | null;      // 실패 2장이 필요한 라운드 (7인 이상: 3)
  questResults: QuestResult[];
  votedIds: string[];
  revealedVotes: Record<string, boolean> | null;
  questSubmittedIds: string[];
  /** 지금까지 뒤집힌 원정 카드 (QUEST_REVEAL 동안 한 장씩 늘어남) */
  questReveal: boolean[] | null;
  /** 공개할 원정 카드 총 장수 (QUEST_REVEAL 동안) */
  questRevealCount: number | null;
  ackCount: number;
  lady: { holderId: string; usedIds: string[]; log: { by: string; target: string }[] } | null;
  history: RoundRecord[];
  revealedRoles: Record<string, Role> | null;
  assassinTarget: string | null;
  winner: GameState['winner'];
  me: { role: Role; team: Team; knowledge: Knowledge[]; acked: boolean; voted: boolean | null; questCard: boolean | null };
}

export interface RoomView {
  code: string;
  meId: string;
  players: PlayerInfo[];
  options: RoomOptions;
  game: GameView | null;
}

export type GameAction =
  | { type: 'ACK_ROLE' }
  | { type: 'TOGGLE_TEAM_MEMBER'; playerId: string }
  | { type: 'CONFIRM_TEAM' }
  | { type: 'VOTE'; approve: boolean }
  | { type: 'QUEST_CARD'; success: boolean }
  | { type: 'LADY_TARGET'; playerId: string }
  | { type: 'ASSASSINATE'; playerId: string }
  | { type: 'ADVANCE' };              // 서버 타이머 전용
