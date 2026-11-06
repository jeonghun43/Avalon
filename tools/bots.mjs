// 혼자 테스트할 때 쓰는 봇. 사용법: node tools/bots.mjs <방코드> [봇 수=4] [서버 주소]
import { io } from 'socket.io-client';

const [code, countArg = '4', url = 'http://localhost:3000'] = process.argv.slice(2);
if (!code) { console.log('사용법: node tools/bots.mjs <방코드> [봇 수] [서버 주소]'); process.exit(1); }
const NAMES = ['길동', '바보', '궁동이', '레인', 'helloworld', '감자', '고구마', '돈까스', '골목짜장'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function bot(name) {
  const s = io(url, { transports: ['websocket'], forceNew: true });
  let view = null;
  let busy = false;
  const act = (a) => new Promise((r) => s.emit('game:action', a, r));

  s.on('connect', () => s.emit('room:join', { code, nickname: name }, (r) => console.log(name, r.ok ? '입장' : r.error)));
  s.on('state', (v) => { view = v; tick(); });

  // 가끔 두리번거리거나 누군가를 쳐다본다
  setInterval(() => {
    if (!view) return;
    const yaw = Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 2.2;
    s.volatile.emit('gaze', { yaw, pitch: -0.3 + (Math.random() - 0.5) * 0.3 });
  }, 1800 + Math.random() * 1500);

  async function tick() {
    if (busy || !view?.game) return;
    busy = true;
    try {
      const g = view.game, me = view.meId;
      await wait(500 + Math.random() * 900);
      if (g.phase === 'ROLE_REVEAL' && !g.me.acked) await act({ type: 'ACK_ROLE' });
      else if (g.phase === 'TEAM_BUILDING' && g.leaderId === me) {
        const size = g.teamSizes[g.round];
        if (g.team.length < size) {
          const pool = view.players.filter((p) => !g.team.includes(p.id));
          const target = !g.team.includes(me) ? view.players.find((p) => p.id === me) : pick(pool);
          await act({ type: 'TOGGLE_TEAM_MEMBER', playerId: target.id });
        } else await act({ type: 'CONFIRM_TEAM' });
      } else if (g.phase === 'TEAM_VOTE' && g.me.voted === null) await act({ type: 'VOTE', approve: Math.random() < 0.7 });
      else if (g.phase === 'QUEST' && g.team.includes(me) && g.me.questCard === null)
        await act({ type: 'QUEST_CARD', success: g.me.team === 'GOOD' || Math.random() < 0.4 });
      else if (g.phase === 'LADY' && g.lady.holderId === me)
        await act({ type: 'LADY_TARGET', playerId: pick(view.players.filter((p) => !g.lady.usedIds.includes(p.id))).id });
      else if (g.phase === 'ASSASSINATION' && g.me.role === 'ASSASSIN')
        await act({ type: 'ASSASSINATE', playerId: pick(view.players.filter((p) => !(p.id in g.revealedRoles))).id });
    } finally {
      busy = false;
    }
  }
  setInterval(tick, 1500);
}

for (let i = 0; i < Number(countArg); i++) setTimeout(() => bot(NAMES[i]), i * 300);
