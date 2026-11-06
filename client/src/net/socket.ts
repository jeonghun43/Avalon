import { io } from 'socket.io-client';
import type { GameAction, RoomOptions, RoomView } from '@avalon/shared';
import { useStore } from '../store';

export const socket = io({ transports: ['websocket', 'polling'] });

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const KEY = 'avalon-session';
interface Session { code: string; token: string }

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function saveSession(s: Session) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장소를 못 써도 게임은 계속 */ }
}
function clearSession() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

function call<T = object>(event: string, payload?: unknown): Promise<Result<T>> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, error: '서버 응답이 없어요. 연결을 확인해 주세요.' }), 8000);
    socket.emit(event, payload, (r: Result<T>) => {
      clearTimeout(t);
      resolve(r);
    });
  });
}

/** 실패하면 토스트로 이유를 보여준다 */
async function run<T = object>(event: string, payload?: unknown) {
  const r = await call<T>(event, payload);
  if (!r.ok) useStore.getState().showToast(r.error, 'error');
  return r;
}

export const api = {
  async create(nickname: string) {
    const r = await run<{ code: string; token: string }>('room:create', { nickname });
    if (r.ok) saveSession({ code: r.code, token: r.token });
    return r;
  },
  async join(code: string, nickname: string) {
    const r = await run<{ code: string; token: string }>('room:join', { code, nickname });
    if (r.ok) saveSession({ code: r.code, token: r.token });
    return r;
  },
  async leave() {
    clearSession();
    await call('room:leave');
    useStore.setState({ view: null, gazes: {} });
  },
  options: (o: RoomOptions) => run('room:options', o),
  kick: (playerId: string) => run('room:kick', { playerId }),
  start: () => run('game:start'),
  rematch: () => run('game:rematch'),
  act: (a: GameAction) => run('game:action', a),
  gaze: (yaw: number, pitch: number) => socket.volatile.emit('gaze', { yaw, pitch }),
};

socket.on('connect', async () => {
  useStore.setState({ connected: true });
  const s = loadSession();
  if (!s) return;
  const r = await call('room:resume', s);
  if (!r.ok) {
    clearSession();
    if (useStore.getState().view) useStore.getState().showToast('이전 방이 사라졌어요.', 'error');
    useStore.setState({ view: null });
  }
});
socket.on('disconnect', () => useStore.setState({ connected: false }));
socket.on('state', (view: RoomView) => useStore.setState({ view }));
socket.on('gaze', (g: { id: string; yaw: number; pitch: number }) =>
  useStore.setState((st) => ({ gazes: { ...st.gazes, [g.id]: { yaw: g.yaw, pitch: g.pitch } } })));
socket.on('kicked', () => {
  clearSession();
  useStore.setState({ view: null, gazes: {} });
  useStore.getState().showToast('방장이 방에서 내보냈어요.', 'error');
});

export const hasSession = () => loadSession() !== null;
