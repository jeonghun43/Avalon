import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameView, PlayerInfo } from '@avalon/shared';
import { labelTexture } from './labels';
import { TABLE_H, tableSpot } from './layout';

const Y = TABLE_H;

/** 위치·회전을 목표값으로 부드럽게 옮기는 그룹 */
function Glide({ to, flip = false, children, drop = true }: { to: [number, number, number]; flip?: boolean; children: React.ReactNode; drop?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pos = useRef<THREE.Vector3 | null>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!pos.current) {
      pos.current = new THREE.Vector3(to[0], to[1] + (drop ? 0.7 : 0), to[2]);
      g.rotation.z = Math.PI;
    }
    const k = 1 - Math.exp(-dt * 8);
    pos.current.lerp(new THREE.Vector3(...to), k);
    const rz = flip ? 0 : Math.PI;
    g.rotation.z += (rz - g.rotation.z) * k;
    // 뒤집히는 동안 살짝 들어 올림
    g.position.copy(pos.current);
    g.position.y += Math.sin(Math.abs(g.rotation.z - rz)) * 0.25;
  });
  return <group ref={ref}>{children}</group>;
}

type CardKind = 'yes' | 'no' | 'success' | 'fail';
const CARD_FACE: Record<CardKind, [string, string, string]> = {
  yes: ['찬성', '#F2B53A', '#141414'],
  no: ['반대', '#2A2D33', '#EDE6D6'],
  success: ['성공', '#3D7BD9', '#EDE6D6'],
  fail: ['실패', '#D9483B', '#EDE6D6'],
};

/** 앞면이 위(rotation.z=0)일 때 보이는 카드. back은 뒷면 색 */
function Card({ kind, back }: { kind: CardKind | null; back: string }) {
  const front = useMemo(() => {
    if (!kind) return null;
    const [t, bg, fg] = CARD_FACE[kind];
    return labelTexture(t, bg, fg, { w: 256, h: 360, size: 110, border: '#0E1113' });
  }, [kind]);
  const backTex = useMemo(() => labelTexture('◆', back, '#5C74A8', { w: 256, h: 360, size: 120, border: '#0E1113' }), [back]);
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.025, 0.6]} />
        <meshStandardMaterial color="#0E1113" />
      </mesh>
      {front && (
        <mesh position={[0, 0.0135, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.42, 0.6]} />
          <meshStandardMaterial map={front} />
        </mesh>
      )}
      <mesh position={[0, -0.0135, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.42, 0.6]} />
        <meshStandardMaterial map={backTex} />
      </mesh>
    </group>
  );
}

function Coin({ color, text, fg = '#141414' }: { color: string; text: string; fg?: string }) {
  const tex = useMemo(() => labelTexture(text, color, fg, { size: 84 }), [color, text, fg]);
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 28]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 28]} />
        <meshStandardMaterial map={tex} />
      </mesh>
    </group>
  );
}

function Crown() {
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.19, 0.14, 12, 1, true]} />
        <meshStandardMaterial color="#F2B53A" side={2} metalness={0.3} roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17]} castShadow>
            <coneGeometry args={[0.045, 0.12, 6]} />
            <meshStandardMaterial color="#F2B53A" metalness={0.3} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function RoundBoard({ g }: { g: GameView }) {
  return (
    <group position={[0, Y, -0.45]}>
      {g.teamSizes.map((size, i) => {
        const x = (i - 2) * 0.62;
        const r = g.questResults[i];
        const label = g.doubleFailRound === i ? `${size}\n실패2` : String(size);
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 0.025, 0]} receiveShadow>
              <cylinderGeometry args={[0.26, 0.26, 0.05, 32]} />
              <meshStandardMaterial color="#5A3A24" />
            </mesh>
            <mesh position={[0, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.22, 32]} />
              <meshStandardMaterial map={labelTexture(label, '#5A3A24', '#E9D7B5', { size: g.doubleFailRound === i ? 80 : 130 })} />
            </mesh>
            {r && (
              <Glide to={[0, 0.09, 0]} flip>
                <Coin color={r === 'SUCCESS' ? '#3D7BD9' : '#D9483B'} text={r === 'SUCCESS' ? '성공' : '실패'} fg="#EDE6D6" />
              </Glide>
            )}
            {g.round === i && !r && g.phase !== 'GAME_OVER' && (
              <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.28, 0.33, 40]} />
                <meshBasicMaterial color="#F2B53A" />
              </mesh>
            )}
          </group>
        );
      })}
      {/* 거부 트랙 */}
      <group position={[0, 0, 0.62]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[(i - 2) * 0.3, 0.02, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.04, 20]} />
            <meshStandardMaterial color={i < g.rejects ? '#F2B53A' : i === 4 ? '#6B2A24' : '#4A3020'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 원정 카드: 서버가 한 장씩 보내 주는 만큼만 뒤집는다 (아직 안 온 카드는 앞면 정보 자체가 없다) */
function QuestCards({ g }: { g: GameView }) {
  const total = g.questRevealCount ?? g.questSubmittedIds.length;
  const shown = g.questReveal ?? [];
  return (
    <group position={[0, Y + 0.02, 0.85]}>
      {Array.from({ length: total }, (_, i) => {
        const c = i < shown.length ? shown[i] : null;
        return (
          <Glide key={i} to={[(i - (total - 1) / 2) * 0.52, 0, 0]} flip={c !== null}>
            <Card kind={c === null ? null : c ? 'success' : 'fail'} back="#4B3626" />
          </Glide>
        );
      })}
    </group>
  );
}

export function TableObjects({ g, players, mySeat }: { g: GameView; players: PlayerInfo[]; mySeat: number }) {
  const n = players.length;
  const seatOf = (id: string) => players.find((p) => p.id === id)?.seat ?? 0;
  // 테이블에는 지금 단계에 필요한 물건만 놓는다 (라운드 보드·거부 트랙만 항상)
  const p = g.phase;
  const crownVisible = p === 'TEAM_BUILDING' || p === 'TEAM_VOTE' || p === 'VOTE_REVEAL';
  const teamVisible = crownVisible || p === 'QUEST' || p === 'QUEST_REVEAL';
  const ladyVisible = p === 'LADY';
  // 찬반 카드는 투표 중(낸 사람 앞 뒷면)과 투표 공개(앞면)에만. 지난 투표는 기록 패널에서 본다
  const faceUp = p === 'VOTE_REVEAL' ? g.revealedVotes : null;
  const showVotes = p === 'TEAM_VOTE' || faceUp !== null;
  const voteIds = faceUp ? Object.keys(faceUp) : g.votedIds;

  return (
    <group>
      <RoundBoard g={g} />
      {crownVisible && (
        <Glide to={tableSpot(seatOf(g.leaderId), n, mySeat, 0.86, -0.2)} flip drop={false}>
          <Crown />
        </Glide>
      )}
      {teamVisible && g.team.map((id) => (
        <Glide key={`t-${id}`} to={[...tableSpot(seatOf(id), n, mySeat, 0.62, 0.2)].map((v, i) => (i === 1 ? v + 0.03 : v)) as [number, number, number]} flip>
          <Coin color="#E7C15A" text="원정" />
        </Glide>
      ))}
      {g.lady && ladyVisible && (
        <Glide key={`lady-${g.lady.holderId}`} to={[...tableSpot(seatOf(g.lady.holderId), n, mySeat, 0.74, 0.32)].map((v, i) => (i === 1 ? v + 0.03 : v)) as [number, number, number]} flip>
          <Coin color="#7FC4E0" text="호수" />
        </Glide>
      )}
      {showVotes && voteIds.map((id) => {
        const revealed = faceUp ? faceUp[id] : null;
        return (
          <Glide key={`v-${id}`} to={[...tableSpot(seatOf(id), n, mySeat, 0.74, -0.04)].map((v, i) => (i === 1 ? v + 0.02 : v)) as [number, number, number]} flip={revealed !== null}>
            <Card kind={revealed === null ? null : revealed ? 'yes' : 'no'} back="#34466B" />
          </Glide>
        );
      })}
      {(g.phase === 'QUEST' || g.phase === 'QUEST_REVEAL') && <QuestCards g={g} />}
    </group>
  );
}
