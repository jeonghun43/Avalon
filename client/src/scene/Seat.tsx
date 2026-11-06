import { useEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { CHAT, type PlayerInfo } from '@avalon/shared';
import { Character, type Pose } from './Character';
import { Chair } from './Room';
import { drag } from './CameraRig';
import type { Gaze } from '../store';

export interface SeatMarks {
  leader: boolean;
  host: boolean;
  lookingAtMe: boolean;
  /** 나만 보이는 표식: 악(빨강), 멀린 후보(보라) */
  secret: 'evil' | 'candidate' | null;
  roleTag: { text: string; evil: boolean } | null;
  selectable: boolean;
  selected: boolean;
  kickable: boolean;
}

interface Props {
  player: PlayerInfo;
  position: [number, number];
  rotY: number;
  gaze: Gaze;
  pose: Pose;
  marks: SeatMarks;
  onPick: () => void;
  onKick: () => void;
  /** 이 사람이 가장 최근에 한 말 (말풍선) */
  said: { id: string; text: string; receivedAt: number } | null;
}

/** 말한 지 6초 동안만 머리 위에 말풍선을 띄운다 */
function useBubble(said: Props['said']) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!said) return;
    const left = said.receivedAt + CHAT.bubbleMs - Date.now();
    if (left <= 0) return;
    setText(said.text);
    const t = setTimeout(() => setText(null), left);
    return () => clearTimeout(t);
  }, [said?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return text;
}

export function Seat({ player, position, rotY, gaze, pose, marks, onPick, onKick, said }: Props) {
  const [hover, setHover] = useState(false);
  const bubble = useBubble(said);
  const click = () => {
    if (drag.moved > 6 || !marks.selectable) return;
    onPick();
  };
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotY, 0]}>
      <Chair color={player.color} />
      <group
        onClick={(e) => { e.stopPropagation(); click(); }}
        onPointerOver={(e) => { e.stopPropagation(); if (marks.selectable) { setHover(true); document.body.style.cursor = 'pointer'; } }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        <Character model={player.model} pose={pose} look={gaze} opacity={player.connected ? 1 : 0.35} />
        {/* 클릭 영역을 넉넉하게: 보이지 않는 기둥 */}
        <mesh position={[0, 1.4, -0.3]} visible={false}>
          <cylinderGeometry args={[0.55, 0.55, 2.4, 8]} />
        </mesh>
      </group>
      {(marks.selected || (hover && marks.selectable)) && (
        <mesh position={[0, 0.05, -0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.86, 40]} />
          <meshBasicMaterial color={marks.selected ? '#F2B53A' : '#EDE6D6'} />
        </mesh>
      )}
      <Html position={[0, 2.85, -0.35]} center distanceFactor={7} zIndexRange={[5, 0]}>
        <div className={`plate-wrap ${marks.selectable ? 'pick' : ''}`} onClick={click}>
          {bubble && <div key={said?.id} className="bubble" role="status">{bubble}</div>}
          {marks.roleTag && <span className={`role-tag ${marks.roleTag.evil ? 'evil' : 'good'}`}>{marks.roleTag.text}</span>}
          <div className={`plate ${marks.selected ? "selected" : ""}`} style={{ background: player.color }}>
            {marks.secret && <span className={`secret ${marks.secret}`} title={marks.secret === 'evil' ? '악의 세력 (나만 보여요)' : '멀린 후보 (나만 보여요)'}>{marks.secret === 'evil' ? '악' : '후보'}</span>}
            {marks.leader && <span className="crown" aria-label="원정대장">♛</span>}
            <span>{player.nickname}</span>
            {marks.lookingAtMe && (
              <svg className="eye" viewBox="-12 -12 24 24" aria-label="나를 보는 중">
                <circle r="12" fill="#0E1113" />
                <path d="M-8 0 Q0 -7 8 0 Q0 7 -8 0Z" fill="#EDE6D6" />
                <circle r="3" fill="#0E1113" />
              </svg>
            )}
          </div>
          {marks.host && <span className="mini-tag">방장</span>}
          {!player.connected && <span className="mini-tag off">연결 끊김</span>}
          {marks.kickable && (
            <button className="kick" onClick={(e) => { e.stopPropagation(); onKick(); }} aria-label={`${player.nickname} 내보내기`}>내보내기</button>
          )}
        </div>
      </Html>
    </group>
  );
}
