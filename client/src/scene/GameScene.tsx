import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ROLE_NAME, ROLE_TEAM, type GameView, type RoomView } from '@avalon/shared';
import { api } from '../net/socket';
import { useStore } from '../store';
import { CameraRig } from './CameraRig';
import { Room } from './Room';
import { Seat, type SeatMarks } from './Seat';
import { TableObjects } from './TableObjects';
import { faceCenter, headYawTo, seatPos } from './layout';

const DEFAULT_GAZE = { yaw: 0, pitch: -0.3 };

/** 지금 이 사람을 클릭하면 무엇을 하는지 (없으면 null) */
export function pickAction(view: RoomView, targetId: string): 'team' | 'lady' | 'assassinate' | null {
  const g = view.game;
  if (!g) return null;
  const me = view.meId;
  if (g.phase === 'TEAM_BUILDING' && g.leaderId === me) return 'team';
  if (g.phase === 'LADY' && g.lady?.holderId === me && !g.lady.usedIds.includes(targetId)) return 'lady';
  if (g.phase === 'ASSASSINATION' && g.me.role === 'ASSASSIN' && !(targetId in (g.revealedRoles ?? {}))) return 'assassinate';
  return null;
}

export function secretMark(g: GameView, id: string): SeatMarks['secret'] {
  for (const k of g.me.knowledge) {
    if ((k.kind === 'EVIL_SEEN_BY_MERLIN' || k.kind === 'FELLOW_EVIL') && k.ids.includes(id)) return 'evil';
    if (k.kind === 'MERLIN_CANDIDATES' && k.ids.includes(id)) return 'candidate';
    if (k.kind === 'LADY_RESULT' && k.targetId === id && k.team === 'EVIL') return 'evil';
  }
  return null;
}

export function GameScene({ view, element }: { view: RoomView; element: HTMLElement | null }) {
  const gazes = useStore((s) => s.gazes);
  const pending = useStore((s) => s.pendingTarget);
  const chat = useStore((s) => s.chat);
  const players = view.players;
  const n = players.length;
  const me = players.find((p) => p.id === view.meId)!;
  const g = view.game;
  const [mx, mz] = seatPos(me.seat, n, me.seat);
  const over = g?.phase === 'GAME_OVER';

  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 68, near: 0.05, far: 60 }} gl={{ antialias: true }}>
      <color attach="background" args={['#1A2329']} />
      <fog attach="fog" args={['#1A2329', 9, 18]} />
      <CameraRig element={element} />
      <Suspense fallback={null}>
        <Room />
        {players.filter((p) => p.id !== me.id).map((p) => {
          const [x, z] = seatPos(p.seat, n, me.seat);
          const rotY = faceCenter(x, z);
          const gaze = gazes[p.id] ?? DEFAULT_GAZE;
          const toMe = headYawTo(rotY, x, z, mx, mz);
          const action = pickAction(view, p.id);
          const winnerTeam = g?.winner?.team;
          const myTeamWon = over && winnerTeam && g?.revealedRoles && ROLE_TEAM[g.revealedRoles[p.id]] === winnerTeam;
          const tagRole = g?.revealedRoles?.[p.id];
          const marks: SeatMarks = {
            leader: !!g && g.phase !== 'GAME_OVER' && g.leaderId === p.id,
            host: !g && p.isHost,
            lookingAtMe: Math.abs(gaze.yaw - toMe) < 0.22 && gaze.pitch > -0.75,
            secret: g ? secretMark(g, p.id) : null,
            roleTag: tagRole ? { text: ROLE_NAME[tagRole], evil: ROLE_TEAM[tagRole] === 'EVIL' } : null,
            selectable: action !== null,
            selected: (g?.phase === 'TEAM_BUILDING' && g.team.includes(p.id)) || pending === p.id || g?.assassinTarget === p.id,
            kickable: !g && me.isHost,
          };
          return (
            <Seat
              key={p.id}
              player={p}
              position={[x, z]}
              rotY={rotY}
              gaze={gaze}
              pose={myTeamWon ? 'Cheer' : 'Sit_Chair_Idle'}
              marks={marks}
              onPick={() => {
                if (action === 'team') api.act({ type: 'TOGGLE_TEAM_MEMBER', playerId: p.id });
                else useStore.setState({ pendingTarget: p.id });
              }}
              onKick={() => api.kick(p.id)}
              said={[...chat].reverse().find((c) => c.fromId === p.id) ?? null}
            />
          );
        })}
        {g && <TableObjects g={g} players={players} mySeat={me.seat} />}
      </Suspense>
    </Canvas>
  );
}
