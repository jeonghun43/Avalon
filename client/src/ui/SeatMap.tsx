import type { RoomView } from '@avalon/shared';
import { api } from '../net/socket';
import { useStore } from '../store';
import { pickAction, secretMark } from '../scene/GameScene';
import { seatAngle } from '../scene/layout';

/**
 * 원형 좌석 지도. 3D 화면과 같은 배치(내가 아래)로 모든 자리의 상태를 한눈에 보여준다.
 * 화면 밖에 있는 사람도 여기서 클릭해 원정대·호수의 여인·암살 대상으로 고를 수 있다.
 */
export function SeatMap({ view }: { view: RoomView }) {
  const pending = useStore((s) => s.pendingTarget);
  const g = view.game!;
  const n = view.players.length;
  const me = view.players.find((p) => p.id === view.meId)!;
  const R = 39; // 지도 반지름 (%)
  const done = new Set(g.phase === 'TEAM_VOTE' ? g.votedIds : g.phase === 'QUEST' ? g.questSubmittedIds : []);

  return (
    <div className="ui seat-map" aria-label="좌석 지도">
      <div className="seat-map-table" aria-hidden />
      {view.players.map((p) => {
        const a = seatAngle(p.seat, n, me.seat);
        const x = 50 + Math.cos(a) * R;
        const y = 50 + Math.sin(a) * R;
        const action = pickAction(view, p.id);
        const isMe = p.id === me.id;
        const secret = isMe ? null : secretMark(g, p.id);
        const inTeam = ['TEAM_BUILDING', 'TEAM_VOTE', 'VOTE_REVEAL', 'QUEST', 'QUEST_REVEAL'].includes(g.phase) && g.team.includes(p.id);
        const selected = pending === p.id || g.assassinTarget === p.id;
        const label = [
          isMe ? '나' : p.nickname,
          g.leaderId === p.id && '원정대장',
          inTeam && '원정대원',
          done.has(p.id) && '제출함',
          !p.connected && '연결 끊김',
        ].filter(Boolean).join(', ');
        return (
          <button
            key={p.id}
            className={`seat-dot ${inTeam ? 'team' : ''} ${selected ? 'selected' : ''} ${isMe ? 'me' : ''} ${p.connected ? '' : 'off'}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            disabled={!action}
            aria-label={label}
            title={label}
            onClick={() => {
              if (action === 'team') api.act({ type: 'TOGGLE_TEAM_MEMBER', playerId: p.id });
              else if (action) useStore.setState({ pendingTarget: p.id });
            }}
          >
            {g.leaderId === p.id && g.phase !== 'GAME_OVER' && <span className="sm-crown" aria-hidden>♛</span>}
            <i className="sm-face" style={{ background: p.color }} aria-hidden>
              {done.has(p.id) && <span className="sm-check">✓</span>}
            </i>
            <span className="sm-name">{isMe ? '나' : p.nickname.slice(0, 4)}</span>
            {secret && <span className={`sm-secret ${secret}`}>{secret === 'evil' ? '악' : '후보'}</span>}
          </button>
        );
      })}
    </div>
  );
}
