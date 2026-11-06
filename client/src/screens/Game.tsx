import { useState } from 'react';
import { useProgress } from '@react-three/drei';
import type { RoomView } from '@avalon/shared';
import { GameScene } from '../scene/GameScene';
import { Overlay } from '../ui/Overlay';

/** 캐릭터 모델을 불러오는 동안 빈 화면 대신 진행률을 보여준다 */
function Loading() {
  const { active, progress } = useProgress();
  const [done, setDone] = useState(false);
  if (done || (!active && progress >= 100)) {
    if (!done) setTimeout(() => setDone(true), 0);
    return null;
  }
  return (
    <div className="loading" role="status">
      <div className="logo">AVALON</div>
      <p>원탁을 준비하는 중… {Math.round(progress)}%</p>
    </div>
  );
}

export function Game({ view }: { view: RoomView }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return (
    <div className="game">
      <div className="scene" ref={setEl}>
        <GameScene view={view} element={el} />
      </div>
      <Overlay view={view} />
      <Loading />
    </div>
  );
}
