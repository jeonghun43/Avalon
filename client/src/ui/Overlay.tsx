import { useEffect, useRef, useState } from 'react';
import {
  ROLE_GUIDE, ROLE_NAME, ROLE_TEAM, TEAM_COUNTS, rolesFor, validateSetup,
  type GameView, type Knowledge, type PlayerInfo, type RoomOptions, type RoomView,
} from '@avalon/shared';
import { api } from '../net/socket';
import { isMyTurn, josa, useStore } from '../store';
import { saveMuted, sound } from './sound';
import { SeatMap } from './SeatMap';
import { ChatPanel } from './ChatPanel';

type Names = (id: string) => PlayerInfo | undefined;

function Who({ p }: { p?: PlayerInfo }) {
  if (!p) return null;
  return <span className="who"><i className="dot" style={{ background: p.color }} />{p.nickname}</span>;
}

function WhoList({ ids, names }: { ids: string[]; names: Names }) {
  return <span className="who-list">{ids.map((id) => <Who key={id} p={names(id)} />)}</span>;
}

// ── 상단 상태 바 ─────────────────────────────────────────
function statusOf(view: RoomView, names: Names): { chip: string; chipKind?: string; text: React.ReactNode } {
  const g = view.game;
  const n = view.players.length;
  const nameOf = (id: string) => names(id)?.nickname ?? '';
  if (!g) return { chip: '대기 중', chipKind: 'dark', text: `${n}/10명 · ${n < 5 ? '5명부터 시작할 수 있어요' : '방장이 시작하면 게임이 시작돼요'}` };
  const me = view.meId;
  const round = `${g.round + 1}라운드`;
  const size = g.teamSizes[g.round];
  switch (g.phase) {
    case 'ROLE_REVEAL': return { chip: '역할 확인', text: `${g.ackCount}/${n}명 확인했어요` };
    case 'TEAM_BUILDING':
      return g.leaderId === me
        ? { chip: round, text: <>원정대원 {size}명을 골라 주세요 <span className="chip dark">{g.team.length}/{size}</span></> }
        : { chip: round, text: `${josa(nameOf(g.leaderId), '이', '가')} 원정대원 ${size}명을 고르는 중이에요` };
    case 'TEAM_VOTE': return { chip: '찬반 투표', text: <>원정대 <WhoList ids={g.team} names={names} /> <span className="chip dark">{g.votedIds.length}/{n} 제출</span></> };
    case 'VOTE_REVEAL': return { chip: '투표 공개', text: `${round} ${g.attempt}번째 원정대` };
    case 'QUEST':
      return g.team.includes(me) && g.me.questCard === null
        ? { chip: round, text: '원정 카드를 내 주세요' }
        : { chip: round, text: <>원정 진행 중 <span className="chip dark">{g.questSubmittedIds.length}/{size}</span></> };
    case 'QUEST_REVEAL': return { chip: round, text: `원정 카드를 공개하는 중이에요 (${g.questReveal?.length ?? 0}/${g.questRevealCount})` };
    case 'LADY':
      return g.lady?.holderId === me
        ? { chip: '호수의 여인', chipKind: 'blue', text: '진영을 확인할 사람을 골라 주세요' }
        : { chip: '호수의 여인', chipKind: 'blue', text: `${josa(nameOf(g.lady!.holderId), '이', '가')} 확인할 사람을 고르는 중이에요` };
    case 'ASSASSINATION': {
      const assassin = Object.entries(g.revealedRoles ?? {}).find(([, r]) => r === 'ASSASSIN')?.[0] ?? '';
      return g.me.role === 'ASSASSIN'
        ? { chip: '암살', chipKind: 'red', text: '멀린이라고 생각하는 사람을 지목하세요' }
        : { chip: '암살', chipKind: 'red', text: `암살자 ${josa(nameOf(assassin), '이', '가')} 멀린을 찾고 있어요` };
    }
    case 'GAME_OVER': return { chip: '게임 종료', text: g.winner?.team === 'GOOD' ? '선의 세력 승리' : '악의 세력 승리' };
    default: return { chip: '', text: '' };
  }
}

function StatusBar({ view, names }: { view: RoomView; names: Names }) {
  const s = statusOf(view, names);
  const g = view.game;
  const mine = isMyTurn(view);
  const away = g && g.phase !== 'GAME_OVER' ? view.players.filter((p) => !p.connected) : [];
  return (
    <div className={`ui status ${mine ? 'my-turn' : ''}`} role="status">
      {mine && <span className="turn-tag">내 차례</span>}
      <span className={`chip ${s.chipKind ?? ''}`}>{s.chip}</span>
      <span className="status-text">{s.text}</span>
      {g && g.phase !== 'GAME_OVER' && <span className="rejects" title="연속 부결 횟수 (5번이면 악의 승리)">거부 {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < g.rejects ? 'on' : ''} />)}</span>}
      {away.length > 0 && (
        <span className="away">{away.map((p) => p.nickname).join(', ')} 기다리는 중 · 연결 끊김</span>
      )}
    </div>
  );
}

/** 내 차례가 되면 탭 제목과 효과음으로 알린다. 원정 카드가 뒤집힐 때와 결과에도 소리 */
function TurnEffects({ view }: { view: RoomView }) {
  const mine = isMyTurn(view);
  const g = view.game;
  const prevMine = useRef(false);
  const flipped = useRef(0);
  useEffect(() => {
    document.title = mine ? '(내 차례) 아발론 원탁' : '아발론 원탁';
    if (mine && !prevMine.current) sound.turn();
    prevMine.current = mine;
  }, [mine]);
  useEffect(() => () => { document.title = '아발론 원탁'; }, []);
  const shown = g?.phase === 'QUEST_REVEAL' ? g.questReveal?.length ?? 0 : 0;
  useEffect(() => {
    if (shown > flipped.current) {
      sound.flip();
      if (g && shown === g.questRevealCount) {
        const r = g.questResults[g.questResults.length - 1];
        setTimeout(() => (r === 'FAIL' ? sound.fail() : sound.success()), 350);
      }
    }
    flipped.current = shown;
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function SoundToggle() {
  const muted = useStore((s) => s.muted);
  return (
    <button className="ui sound-btn" aria-pressed={!muted} onClick={() => { useStore.setState({ muted: !muted }); saveMuted(!muted); }}>
      {muted ? '소리 꺼짐' : '소리 켜짐'}
    </button>
  );
}

// ── 로비 ─────────────────────────────────────────────────
function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const ref = useRef<HTMLElement>(null);
  const link = `${location.origin}/?code=${code}`;
  const copy = (what: 'code' | 'link') => {
    navigator.clipboard.writeText(what === 'code' ? code : link).then(() => { setCopied(what); setTimeout(() => setCopied(null), 1500); }).catch(() => {
      const r = document.createRange();
      if (ref.current) { r.selectNodeContents(ref.current); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); }
    });
  };
  return (
    <div className="ui room-code">
      방 코드 <b ref={ref}>{code}</b>
      <button className="chip" onClick={() => copy('code')}>{copied === 'code' ? '복사됨' : '코드 복사'}</button>
      <button className="chip" onClick={() => copy('link')} title={link}>{copied === 'link' ? '복사됨' : '초대 링크'}</button>
    </div>
  );
}

function Toggle({ id, label, sub, on, disabled, onChange }: { id: string; label: string; sub?: string; on: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button id={id} type="button" className="tg" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}>
      <span>{label}{sub && <small>{sub}</small>}</span>
      <i className={`sw ${on ? 'on' : ''}`} aria-hidden />
    </button>
  );
}

function LobbyPanel({ view }: { view: RoomView }) {
  const me = view.players.find((p) => p.id === view.meId)!;
  const n = view.players.length;
  const o = view.options;
  const err = validateSetup(Math.max(n, 5), o);
  const startErr = validateSetup(n, o);
  const set = (patch: Partial<RoomOptions>) => api.options({ ...o, ...patch });
  const counts = TEAM_COUNTS[Math.min(Math.max(n, 5), 10)];
  const roles = rolesFor(Math.min(Math.max(n, 5), 10), err ? { ...o, mordred: false } : o);
  const summary = (team: 'GOOD' | 'EVIL') => {
    const rs = roles.filter((r) => ROLE_TEAM[r] === team);
    const named = rs.filter((r) => r !== 'LOYAL_SERVANT' && r !== 'MINION').map((r) => ROLE_NAME[r]);
    const filler = rs.length - named.length;
    return [...named, ...(filler ? [`${team === 'GOOD' ? '기사' : '하수인'} ${filler}`] : [])].join(', ');
  };
  return (
    <div className="ui lobby-panel">
      <div className="panel-title">방 설정 {me.isHost ? <span className="k">방장</span> : <span className="k">방장만 바꿀 수 있어요</span>}</div>
      <Toggle id="opt-pm" label="퍼시발 · 모르가나" on={o.percivalMorgana} disabled={!me.isHost} onChange={(v) => set({ percivalMorgana: v })} />
      <Toggle id="opt-md" label="모드레드" on={o.mordred} disabled={!me.isHost} onChange={(v) => set({ mordred: v })} />
      <Toggle id="opt-lady" label="호수의 여인" sub="7인 이상 권장" on={o.ladyOfTheLake} disabled={!me.isHost} onChange={(v) => set({ ladyOfTheLake: v })} />
      <hr />
      <span className="k">{Math.max(n, 5)}인 구성 · 선 {counts[0]} · 악 {counts[1]}</span>
      <span className="comp"><b className="good-t">선</b> {summary('GOOD')}</span>
      <span className="comp"><b className="evil-t">악</b> {summary('EVIL')}</span>
      {err && <span className="warn">{err}</span>}
      {me.isHost
        ? <button className="btn" disabled={!!startErr} onClick={() => api.start()}>{n < 5 ? `게임 시작 · ${5 - n}명 더 필요` : '게임 시작'}</button>
        : <span className="k">방장이 게임을 시작할 때까지 기다려 주세요.</span>}
      <button className="btn ghost" onClick={() => api.leave()}>방 나가기</button>
    </div>
  );
}

// ── 역할 카드 ────────────────────────────────────────────
function knowledgeLines(k: Knowledge[], names: Names, view: RoomView): React.ReactNode[] {
  return k.map((x, i) => {
    switch (x.kind) {
      case 'EVIL_SEEN_BY_MERLIN':
        return <div key={i}>악의 세력: <WhoList ids={x.ids} names={names} />{view.options.mordred && <div className="k">모드레드는 보이지 않아요.</div>}</div>;
      case 'MERLIN_CANDIDATES':
        return <div key={i}>멀린 후보: <WhoList ids={x.ids} names={names} /><div className="k">한 명은 진짜 멀린, 한 명은 모르가나예요.</div></div>;
      case 'FELLOW_EVIL':
        return <div key={i}>함께하는 악의 세력: <WhoList ids={x.ids} names={names} /></div>;
      case 'LADY_RESULT':
        return <div key={i}>호수의 여인: <Who p={names(x.targetId)} /> → <span className={`chip ${x.team === 'GOOD' ? 'blue' : 'red'}`}>{x.team === 'GOOD' ? '선의 세력' : '악의 세력'}</span></div>;
    }
  });
}

function RoleBadge({ g, big = false }: { g: GameView; big?: boolean }) {
  return <span className={`role-badge ${g.me.team === 'GOOD' ? 'good' : 'evil'} ${big ? 'big' : ''}`}>{ROLE_NAME[g.me.role].slice(0, 1)}</span>;
}

function RoleCard({ view, names, onClose, reveal }: { view: RoomView; names: Names; onClose: () => void; reveal: boolean }) {
  const g = view.game!;
  const lines = knowledgeLines(g.me.knowledge, names, view);
  return (
    <div className="dim" onClick={reveal ? undefined : onClose}>
      <div className="ui modal role-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="내 역할">
        <div className="role-top">
          <RoleBadge g={g} big />
          <div>
            <span className="k">당신의 역할</span>
            <div className="role-name">{ROLE_NAME[g.me.role]}</div>
            <span className={`chip ${g.me.team === 'GOOD' ? 'blue' : 'red'}`}>{g.me.team === 'GOOD' ? '선의 세력' : '악의 세력'}</span>
          </div>
        </div>
        <hr />
        <span className="k">행동요령</span>
        <ul>{ROLE_GUIDE[g.me.role].map((t) => <li key={t}>{t}</li>)}</ul>
        <hr />
        <span className="k">내가 아는 정보</span>
        {lines.length ? lines : <div>특별히 아는 사람은 없어요.</div>}
        <div className="row-end">
          {reveal && g.phase === 'ROLE_REVEAL' && <span className="k">{g.ackCount}/{view.players.length}명 확인함 · <Countdown /></span>}
          {reveal && g.phase !== 'ROLE_REVEAL' && <span className="k">게임이 이미 시작됐어요. 다 읽고 확인을 눌러 주세요.</span>}
          <button className="btn" onClick={onClose} autoFocus>{reveal ? '확인했어요' : '닫기'}</button>
        </div>
      </div>
    </div>
  );
}

/** 자동으로 넘어가기까지 남은 시간 (서버가 보낸 값 기준) */
function Countdown() {
  const timerMs = useStore((s) => s.view?.timerMs ?? null);
  const stateAt = useStore((s) => s.stateAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  if (timerMs === null) return null;
  const left = Math.max(0, Math.ceil((timerMs - (now - stateAt)) / 1000));
  return <span className="countdown">{left}초 뒤 게임 시작</span>;
}

// ── 손패 ─────────────────────────────────────────────────
function QuestHand({ good }: { good: boolean }) {
  const [pick, setPick] = useState<boolean | null>(null);
  return (
    <div className="hand">
      <button className={`hcard success ${pick === true ? 'picked' : ''}`} onClick={() => setPick(true)}><span className="ic">✓</span><span>성공</span></button>
      <button className={`hcard fail ${pick === false ? 'picked' : ''}`} disabled={good} onClick={() => setPick(false)}><span className="ic">✕</span><span>실패</span></button>
      {pick === null
        ? <span className="hand-note">{good ? '선의 세력은 성공만 낼 수 있어요' : '낼 카드를 고르세요'}</span>
        : (
          <span className="hand-note confirm">
            <b>{pick ? '성공' : '실패'}</b> 카드를 낼까요? 내면 바꿀 수 없어요
            <button className="btn small" onClick={() => api.act({ type: 'QUEST_CARD', success: pick })}>이 카드 내기</button>
          </span>
        )}
    </div>
  );
}

function Hand({ view }: { view: RoomView }) {
  const g = view.game!;
  const me = view.meId;
  if (g.phase === 'TEAM_VOTE') {
    const v = g.me.voted;
    return (
      <div className="hand">
        <button className={`hcard yes ${v === true ? 'picked' : ''}`} onClick={() => api.act({ type: 'VOTE', approve: true })}><span className="ic">✓</span><span>찬성</span></button>
        <button className={`hcard no ${v === false ? 'picked' : ''}`} onClick={() => api.act({ type: 'VOTE', approve: false })}><span className="ic">✕</span><span>반대</span></button>
        {v !== null && <span className="hand-note">냈어요 · 모두 낼 때까지 바꿀 수 있어요</span>}
      </div>
    );
  }
  if (g.phase === 'QUEST' && g.team.includes(me)) {
    if (g.me.questCard !== null) return <div className="hand"><span className="hand-note">원정 카드를 냈어요</span></div>;
    return <QuestHand good={g.me.team === 'GOOD'} />;
  }
  if (g.phase === 'TEAM_BUILDING' && g.leaderId === me) {
    const size = g.teamSizes[g.round];
    const inTeam = g.team.includes(me);
    return (
      <div className="leader-bar">
        <button className={`btn ${inTeam ? '' : 'ghost'}`} onClick={() => api.act({ type: 'TOGGLE_TEAM_MEMBER', playerId: me })}>{inTeam ? '나 빼기' : '나도 넣기'}</button>
        <button className="btn" disabled={g.team.length !== size} onClick={() => api.act({ type: 'CONFIRM_TEAM' })}>원정대 확정</button>
        <span className="hand-note">사람을 클릭해서 원정대에 넣고 빼요</span>
      </div>
    );
  }
  return null;
}

/** 호수의 여인·암살: 고른 사람을 확정하는 바 */
function ConfirmBar({ view, names }: { view: RoomView; names: Names }) {
  const pending = useStore((s) => s.pendingTarget);
  const g = view.game!;
  const mode = g.phase === 'LADY' && g.lady?.holderId === view.meId ? 'lady' : g.phase === 'ASSASSINATION' && g.me.role === 'ASSASSIN' ? 'assassinate' : null;
  useEffect(() => { useStore.setState({ pendingTarget: null }); }, [g.phase]);
  if (!mode) return null;
  const p = pending ? names(pending) : undefined;
  return (
    <div className="leader-bar">
      {p ? <span className="hand-note"><Who p={p} /> {mode === 'lady' ? '의 진영을 확인할까요?' : '을(를) 멀린으로 지목할까요?'}</span>
        : <span className="hand-note">{mode === 'lady' ? '확인할 사람을 클릭하세요 (이미 토큰을 가졌던 사람은 안 돼요)' : '멀린이라고 생각하는 사람을 클릭하세요'}</span>}
      <button className="btn" disabled={!p} onClick={() => {
        if (!pending) return;
        api.act(mode === 'lady' ? { type: 'LADY_TARGET', playerId: pending } : { type: 'ASSASSINATE', playerId: pending });
        useStore.setState({ pendingTarget: null });
      }}>{mode === 'lady' ? '확인하기' : '지목하기'}</button>
    </div>
  );
}

// ── 공개 연출 문구 ───────────────────────────────────────
function RevealBanner({ g }: { g: GameView }) {
  // 결과는 마지막 카드까지 서버가 보내 준 뒤에만 뷰에 들어온다
  const questDone = g.phase === 'QUEST_REVEAL' && g.questReveal !== null && g.questReveal.length === g.questRevealCount;
  if (g.phase === 'VOTE_REVEAL' && g.revealedVotes) {
    const vs = Object.values(g.revealedVotes);
    const yes = vs.filter(Boolean).length;
    const ok = g.history[g.history.length - 1]?.approved;
    return (
      <div className="ui banner">
        <span className="gold">찬성 {yes}</span><span className="sep">:</span><span>반대 {vs.length - yes}</span>
        <span className={`chip ${ok ? 'blue' : 'dark'}`}>{ok ? '가결' : g.rejects === 4 ? '부결 · 5번째' : '부결'}</span>
      </div>
    );
  }
  if (g.phase === 'QUEST_REVEAL' && questDone) {
    const r = g.questResults[g.questResults.length - 1];
    const fails = g.questReveal!.filter((c) => !c).length;
    return <div className={`ui banner ${r === 'FAIL' ? 'red' : 'blue'}`}>{r === 'FAIL' ? '원정 실패' : '원정 성공'}<span className="k">실패 {fails}장</span></div>;
  }
  return null;
}

/** 호수의 여인 결과: 내가 새로 확인했을 때 한 번 띄운다 */
function LadyPopup({ g, names }: { g: GameView; names: Names }) {
  const results = g.me.knowledge.filter((k): k is Extract<Knowledge, { kind: 'LADY_RESULT' }> => k.kind === 'LADY_RESULT');
  const seen = useRef(results.length);
  const [show, setShow] = useState<(typeof results)[number] | null>(null);
  useEffect(() => {
    if (results.length > seen.current) setShow(results[results.length - 1]);
    seen.current = results.length;
  }, [results.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  return (
    <div className="ui popup" role="dialog">
      <span className="k">호수의 여인 · 나만 볼 수 있어요</span>
      <div className="popup-main"><Who p={names(show.targetId)} /> <span className={`chip ${show.team === 'GOOD' ? 'blue' : 'red'}`}>{show.team === 'GOOD' ? '선의 세력' : '악의 세력'}</span></div>
      <button className="btn" onClick={() => setShow(null)}>닫기</button>
    </div>
  );
}

// ── 결과 · 기록 ──────────────────────────────────────────
const REASON: Record<string, string> = {
  QUESTS: '원정이 3번 실패했어요.',
  REJECTS: '원정대가 5번 연속 부결됐어요.',
  ASSASSIN_HIT: '암살자가 멀린을 찾아냈어요.',
  ASSASSIN_MISS: '암살자가 멀린을 찾지 못했어요.',
};

function RoundDots({ g }: { g: GameView }) {
  return (
    <div className="rounds">
      {g.teamSizes.map((_, i) => <span key={i} className={g.questResults[i] === 'SUCCESS' ? 'good' : g.questResults[i] === 'FAIL' ? 'evil' : ''}>{i + 1}</span>)}
    </div>
  );
}

function ResultModal({ view, names, onHistory }: { view: RoomView; names: Names; onHistory: () => void }) {
  const g = view.game!;
  const [hidden, setHidden] = useState(false);
  const me = view.players.find((p) => p.id === view.meId)!;
  const good = g.winner?.team === 'GOOD';
  if (hidden) return <button className="ui btn result-reopen" onClick={() => setHidden(false)}>결과 다시 보기</button>;
  const sorted = [...view.players].sort((a, b) => (ROLE_TEAM[g.revealedRoles![a.id]] === ROLE_TEAM[g.revealedRoles![b.id]] ? a.seat - b.seat : ROLE_TEAM[g.revealedRoles![a.id]] === 'GOOD' ? -1 : 1));
  const merlin = view.players.find((p) => g.revealedRoles![p.id] === 'MERLIN');
  return (
    <div className="dim">
      <div className="ui modal result" role="dialog" aria-label="게임 결과">
        <div className={`result-title ${good ? 'good-t' : 'evil-t'}`}>{good ? '선의 세력 승리' : '악의 세력 승리'}</div>
        <span>{REASON[g.winner!.reason]}{g.assassinTarget && <> 지목: <Who p={names(g.assassinTarget)} /> · 멀린: <Who p={merlin} /></>}</span>
        <hr />
        <div className="result-list">
          {sorted.map((p) => {
            const r = g.revealedRoles![p.id];
            return <div key={p.id} className="result-row"><Who p={p} /><span>{ROLE_NAME[r]}</span><span className={`chip ${ROLE_TEAM[r] === 'GOOD' ? 'blue' : 'red'}`}>{ROLE_TEAM[r] === 'GOOD' ? '선' : '악'}</span></div>;
          })}
        </div>
        <hr />
        <div className="row-end">
          <RoundDots g={g} />
          <div className="row-gap">
            <button className="btn ghost" onClick={onHistory}>기록</button>
            <button className="btn ghost" onClick={() => setHidden(true)}>테이블 보기</button>
            <button className="btn ghost" onClick={() => api.leave()}>나가기</button>
            {me.isHost && <button className="btn" onClick={() => api.rematch()}>다시 하기</button>}
          </div>
        </div>
        {!me.isHost && <span className="k">방장이 다시 하기를 누르면 같은 멤버로 로비로 돌아가요.</span>}
      </div>
    </div>
  );
}

function History({ view, names, onClose }: { view: RoomView; names: Names; onClose: () => void }) {
  const g = view.game!;
  return (
    <div className="ui history" role="dialog" aria-label="기록">
      <div className="row-end"><span className="panel-title">기록</span><button className="btn ghost small" onClick={onClose}>닫기</button></div>
      {g.history.length === 0 && <span className="k">아직 투표한 원정대가 없어요.</span>}
      <ol>
        {g.history.map((h, i) => (
          <li key={i}>
            <div className="h-head">
              <b>{h.round + 1}라운드 · {h.attempt}번째</b>
              <span className={`chip ${h.approved ? 'blue' : 'dark'}`}>{h.approved ? '가결' : '부결'}</span>
              {h.quest && <span className={`chip ${h.quest.result === 'SUCCESS' ? 'blue' : 'red'}`}>{h.quest.result === 'SUCCESS' ? '성공' : '실패'} · 실패 {h.quest.fails}장</span>}
            </div>
            <div className="k">원정대장 <Who p={names(h.leaderId)} /> · 원정대 <WhoList ids={h.team} names={names} /></div>
            <div className="votes">
              {view.players.map((p) => <span key={p.id} className={`vote ${h.votes[p.id] ? 'y' : 'n'}`}>{p.nickname} {h.votes[p.id] ? '찬' : '반'}</span>)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 게임 화면 첫 둘러보기 안내: 처음 드래그하거나 방향키를 누르면 사라진다 */
function LookHint() {
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem('avalon-look-hint') !== '1'; } catch { return true; }
  });
  useEffect(() => {
    if (!show) return;
    const hide = () => {
      setShow(false);
      try { sessionStorage.setItem('avalon-look-hint', '1'); } catch { /* noop */ }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) hide(); };
    const t = setTimeout(hide, 12_000);
    window.addEventListener('pointerdown', hide, { once: true });
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', hide); window.removeEventListener('keydown', onKey); };
  }, [show]);
  if (!show) return null;
  return <div className="look-hint">화면을 드래그하거나 ← → ↑ ↓ 키로 둘러보세요</div>;
}

/** 휴대폰 세로 화면이면 가로로 돌리도록 안내 (닫을 수 있음) */
function RotateHint() {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div className="ui rotate-hint">
      휴대폰을 가로로 돌리면 테이블이 더 잘 보여요
      <button className="btn small ghost" onClick={() => setClosed(true)}>닫기</button>
    </div>
  );
}

// ── 조립 ─────────────────────────────────────────────────
export function Overlay({ view }: { view: RoomView }) {
  const connected = useStore((s) => s.connected);
  const names: Names = (id) => view.players.find((p) => p.id === id);
  const g = view.game;
  const [roleOpen, setRoleOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // 확인을 누를 때까지 역할 카드를 유지 (20초가 지나 게임이 넘어가도)
  const revealing = !!g && g.phase !== 'GAME_OVER' && !g.me.acked;
  const me = view.players.find((p) => p.id === view.meId)!;
  const myTags: { text: string; kind?: string }[] = [];
  if (g && g.phase !== 'GAME_OVER') {
    if (g.leaderId === me.id) myTags.push({ text: '원정대장' });
    if (g.team.includes(me.id)) myTags.push({ text: '원정대원' });
    if (g.lady?.holderId === me.id) myTags.push({ text: '호수의 여인', kind: 'blue' });
    if (g.phase === 'TEAM_VOTE' && g.me.voted !== null) myTags.push({ text: '투표함', kind: 'dark' });
    if (g.phase === 'QUEST' && g.me.questCard !== null) myTags.push({ text: '카드 냄', kind: 'dark' });
  }

  return (
    <div className="overlay">
      <TurnEffects view={view} />
      <StatusBar view={view} names={names} />
      {!g && <RoomCode code={view.code} />}
      {!g && <LobbyPanel view={view} />}
      {g && <SeatMap view={view} />}
      <ChatPanel inGame={!!g} />
      {g && (
        <button className="ui role-mini" onClick={() => setRoleOpen(true)} aria-label="내 역할 펼치기">
          <RoleBadge g={g} />
          <span>
            <b>{ROLE_NAME[g.me.role]}</b>
            <small>{g.me.team === 'GOOD' ? '선의 세력' : '악의 세력'} · 눌러서 펼치기</small>
            <span className="me-tags">
              <span className="who"><i className="dot" style={{ background: me.color }} />나 · {me.nickname}</span>
              {myTags.map((t) => <span key={t.text} className={`chip ${t.kind ?? ''}`}>{t.text}</span>)}
            </span>
          </span>
        </button>
      )}
      <div className="corner-btns">
        <SoundToggle />
        {g && <button className="ui rec-btn" onClick={() => setHistoryOpen((v) => !v)}>기록</button>}
      </div>
      {g && <LookHint />}
      <RotateHint />
      {g && <Hand view={view} />}
      {g && <ConfirmBar view={view} names={names} />}
      {g && <RevealBanner g={g} />}
      {g && <LadyPopup g={g} names={names} />}
      {g?.phase === 'ASSASSINATION' && g.me.role !== 'ASSASSIN' && <div className="hint">악의 세력이 정체를 드러냈어요. 음성 채팅으로 상의하는 중이에요.</div>}
      {!g && <div className="hint">드래그해서 둘러보기</div>}
      {g && historyOpen && <History view={view} names={names} onClose={() => setHistoryOpen(false)} />}
      {g?.phase === 'GAME_OVER' && <ResultModal view={view} names={names} onHistory={() => setHistoryOpen(true)} />}
      {g && (revealing || roleOpen) && (
        <RoleCard view={view} names={names} reveal={revealing} onClose={() => { if (revealing) api.act({ type: 'ACK_ROLE' }); setRoleOpen(false); }} />
      )}
      {!connected && <div className="ui offline">연결이 끊겼어요. 다시 연결하는 중…</div>}
    </div>
  );
}
