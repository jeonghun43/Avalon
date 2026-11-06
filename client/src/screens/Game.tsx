import { useState } from 'react';
import type { RoomView } from '@avalon/shared';
import { GameScene } from '../scene/GameScene';
import { Overlay } from '../ui/Overlay';

export function Game({ view }: { view: RoomView }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return (
    <div className="game">
      <div className="scene" ref={setEl}>
        <GameScene view={view} element={el} />
      </div>
      <Overlay view={view} />
    </div>
  );
}
