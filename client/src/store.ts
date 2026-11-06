import { create } from 'zustand';
import type { PlayerInfo, RoomView } from '@avalon/shared';

export interface Gaze { yaw: number; pitch: number }

/** 화면에 보관하는 채팅 한 줄. 시각은 모두 이 브라우저 기준 */
export interface ChatEntry {
  id: string;
  fromId: string;
  nickname: string;
  color: string;
  text: string;
  receivedAt: number;
  expiresAt: number;
}

interface State {
  view: RoomView | null;
  /** view를 받은 시각 (남은 시간 계산용) */
  stateAt: number;
  connected: boolean;
  gazes: Record<string, Gaze>;
  toast: { id: number; text: string; kind: 'error' | 'info' } | null;
  /** 암살·호수의 여인에서 확정 전에 골라 둔 사람 */
  pendingTarget: string | null;
  muted: boolean;
  chat: ChatEntry[];
  showToast: (text: string, kind?: 'error' | 'info') => void;
}

export const useStore = create<State>((set) => ({
  view: null,
  stateAt: 0,
  connected: false,
  gazes: {},
  toast: null,
  pendingTarget: null,
  muted: false,
  chat: [],
  showToast: (text, kind = 'info') => set({ toast: { id: Date.now() + Math.random(), text, kind } }),
}));

export const usePlayers = () => useStore((s) => s.view?.players ?? []);
export const useMe = (): PlayerInfo | undefined => useStore((s) => s.view?.players.find((p) => p.id === s.view?.meId));

/** 받침에 맞는 조사: josa('지민', '이', '가') → '지민이' */
export function josa(word: string, withBatchim: string, without: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + without;
  return word + ((c - 0xac00) % 28 ? withBatchim : without);
}

/** 지금 내가 무언가를 해야 하는 차례인지 */
export function isMyTurn(view: RoomView): boolean {
  const g = view.game;
  if (!g) return false;
  const me = view.meId;
  switch (g.phase) {
    case 'ROLE_REVEAL': return !g.me.acked;
    case 'TEAM_BUILDING': return g.leaderId === me;
    case 'TEAM_VOTE': return g.me.voted === null;
    case 'QUEST': return g.team.includes(me) && g.me.questCard === null;
    case 'LADY': return g.lady?.holderId === me;
    case 'ASSASSINATION': return g.me.role === 'ASSASSIN';
    default: return false;
  }
}
