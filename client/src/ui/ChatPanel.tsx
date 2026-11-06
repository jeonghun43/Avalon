import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHAT, chatLength } from '@avalon/shared';
import { api } from '../net/socket';
import { useStore } from '../store';

const FADE_MS = 15_000; // 사라지기 전 마지막 15초는 점점 흐려짐

/**
 * 화면 오른쪽 채팅창. 말은 1분 뒤 사라지고, 입력은 Enter 키나 "채팅" 버튼으로 연다 (휴대폰은 버튼).
 * inGame이면 좌석 지도 아래, 로비면 방 코드 아래에 놓인다.
 */
export function ChatPanel({ inGame }: { inGame: boolean }) {
  const chat = useStore((s) => s.chat);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);

  // 1초마다 시계를 돌려 흐려짐·사라짐을 반영하고, 지난 말은 보관함에서도 지운다
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (useStore.getState().chat.some((c) => c.expiresAt <= n))
        useStore.setState((st) => ({ chat: st.chat.filter((c) => c.expiresAt > n) }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // 새 말이 오면 맨 아래로. 개수가 아니라 "마지막 말"을 본다:
  // 말이 쌓이면 오래된 말이 지워지는 동시에 새 말이 들어와 개수가 그대로일 수 있기 때문
  const meId = useStore((s) => s.view?.meId);
  const last = chat[chat.length - 1];
  const atBottom = useRef(true); // 사용자가 맨 아래를 보고 있는지 (위로 올려 읽는 중이면 false)
  const [unread, setUnread] = useState(0);
  const toBottom = () => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    setUnread(0);
  };
  useLayoutEffect(() => {
    if (!last) return;
    // 맨 아래를 보고 있었거나 내가 보낸 말이면 따라 내려가고, 지난 말을 읽는 중이면 알림만
    if (atBottom.current || last.fromId === meId) toBottom();
    else setUnread((u) => u + 1);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    const el = list.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom.current) setUnread(0);
  };

  // 입력 칸 밖에서 Enter를 누르면 채팅 입력을 연다 (버튼에 포커스가 있으면 그 버튼이 우선)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(t.tagName)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    const r = await api.chat(msg);
    setSending(false);
    if (r.ok) setText('');
    input.current?.focus();
  };

  const visible = chat.filter((c) => c.expiresAt > now);
  const len = chatLength(text);

  return (
    <div className={`ui chat-panel ${inGame ? 'in-game' : ''}`} aria-label="채팅">
      {unread > 0 && (
        <button className="chip chat-unread" onClick={toBottom}>새 말 {unread}개 ↓</button>
      )}
      <ol className="chat-list" ref={list} aria-live="polite" onScroll={onScroll}>
        {visible.length === 0 && <li className="chat-empty">말은 1분 뒤 사라져요</li>}
        {visible.map((c) => {
          const left = c.expiresAt - now;
          return (
            <li key={c.id} style={{ opacity: left < FADE_MS ? 0.25 + 0.75 * (left / FADE_MS) : 1 }}>
              <span className="who"><i className="dot" style={{ background: c.color }} />{c.nickname}</span>
              <span className="chat-text">{c.text}</span>
            </li>
          );
        })}
      </ol>
      {open ? (
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input
            ref={input}
            id="chat-input"
            className="field"
            value={text}
            placeholder={`${CHAT.maxChars}자까지`}
            autoComplete="off"
            enterKeyHint="send"
            aria-label="채팅 입력"
            onChange={(e) => setText([...e.target.value].slice(0, CHAT.maxChars).join(''))}
            onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); } }}
          />
          <span className={`chat-count ${len >= CHAT.maxChars ? 'full' : ''}`}>{len}/{CHAT.maxChars}</span>
          <button className="btn small" disabled={!text.trim() || sending}>보내기</button>
          <button type="button" className="btn small ghost" onClick={() => setOpen(false)} aria-label="채팅 입력 닫기">✕</button>
        </form>
      ) : (
        <button className="btn small chat-open" onClick={() => setOpen(true)}>채팅 <span className="k">Enter</span></button>
      )}
    </div>
  );
}
