import { create } from 'zustand';
import type { PlayerInfo, RoomView } from '@avalon/shared';

export interface Gaze { yaw: number; pitch: number }

interface State {
  view: RoomView | null;
  connected: boolean;
  gazes: Record<string, Gaze>;
  toast: { id: number; text: string; kind: 'error' | 'info' } | null;
  /** 암살·호수의 여인에서 확정 전에 골라 둔 사람 */
  pendingTarget: string | null;
  showToast: (text: string, kind?: 'error' | 'info') => void;
}

export const useStore = create<State>((set) => ({
  view: null,
  connected: false,
  gazes: {},
  toast: null,
  pendingTarget: null,
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
