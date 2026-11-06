import { io } from 'socket.io-client';
import type { ChatMessage, GameAction, RoomOptions, RoomView } from '@avalon/shared';
import { useStore, type ChatEntry } from '../store';

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
    rememberName(nickname);
    const r = await run<{ code: string; token: string }>('room:create', { nickname });
    if (r.ok) saveSession({ code: r.code, token: r.token });
    return r;
  },
  async join(code: string, nickname: string) {
    rememberName(nickname);
    const r = await run<{ code: string; token: string }>('room:join', { code, nickname });
    if (r.ok) saveSession({ code: r.code, token: r.token });
    return r;
  },
  async leave() {
    clearSession();
    await call('room:leave');
    useStore.setState({ view: null, gazes: {}, chat: [] });
  },
  options: (o: RoomOptions) => run('room:options', o),
  kick: (playerId: string) => run('room:kick', { playerId }),
  start: () => run('game:start'),
  rematch: () => run('game:rematch'),
  act: (a: GameAction) => run('game:action', a),
  gaze: (yaw: number, pitch: number) => socket.volatile.emit('gaze', { yaw, pitch }),
  chat: (text: string) => run('chat:send', { text }),
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
socket.on('state', (view: RoomView) => useStore.setState({ view, stateAt: Date.now() }));
const toEntry = (m: ChatMessage, now: number): ChatEntry => ({
  id: m.id, fromId: m.fromId, nickname: m.nickname, color: m.color, text: m.text,
  receivedAt: now, expiresAt: now + m.expiresInMs,
});
socket.on('chat:history', (list: ChatMessage[]) => {
  const now = Date.now();
  // 입장 전 말들은 말풍선을 띄우지 않도록 받은 시각을 과거로 둔다
  useStore.setState({ chat: list.map((m) => ({ ...toEntry(m, now), receivedAt: 0 })) });
});
socket.on('chat:new', (m: ChatMessage) =>
  useStore.setState((st) => ({ chat: [...st.chat.filter((c) => c.expiresAt > Date.now()), toEntry(m, Date.now())].slice(-50) })));

socket.on('gaze', (g: { id: string; yaw: number; pitch: number }) =>
  useStore.setState((st) => ({ gazes: { ...st.gazes, [g.id]: { yaw: g.yaw, pitch: g.pitch } } })));
socket.on('kicked', () => {
  clearSession();
  useStore.setState({ view: null, gazes: {}, chat: [] });
  useStore.getState().showToast('방장이 방에서 내보냈어요.', 'error');
});

export const hasSession = () => loadSession() !== null;

// 마지막으로 쓴 닉네임은 기기에 기억해 둔다 (방 정보와 달리 탭끼리 공유해도 괜찮다)
const NAME_KEY = 'avalon-nickname';
function rememberName(name: string) {
  try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* noop */ }
}
export function lastName() {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
