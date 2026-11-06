import { StrictMode, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { CHARACTERS, SEAT_COLORS } from '@avalon/shared';
import { Character, type Pose } from './scene/Character';
import { Chair, Room } from './scene/Room';
import { faceCenter, headYawTo, seatPos, TABLE_H } from './scene/layout';
import './ui/preview.css';

type LookMode = 'center' | 'target' | 'random';
const N = CHARACTERS.length;
const randomLook = () => CHARACTERS.map(() => ({ yaw: (Math.random() - 0.5) * 2, pitch: (Math.random() - 0.3) * 0.6 }));

function Preview() {
  const [pose, setPose] = useState<Pose>('Sit_Chair_Idle');
  const [mode, setMode] = useState<LookMode>('target');
  const [target, setTarget] = useState(0);
  const [rand, setRand] = useState(randomLook);

  return (
    <div className="pv">
      <Canvas shadows camera={{ position: [0, 6, 8.5], fov: 45 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#1A2329']} />
        <Suspense fallback={null}>
          <Room />
          {CHARACTERS.map((c, i) => {
            const [x, z] = seatPos(i, N, 0);
            const rotY = faceCenter(x, z);
            const [tx, tz] = seatPos(target, N, 0);
            const look =
              mode === 'center' ? { yaw: 0, pitch: 0.25 }
              : mode === 'random' ? rand[i]
              : i === target ? { yaw: 0, pitch: 0.25 } : { yaw: headYawTo(rotY, x, z, tx, tz), pitch: 0 };
            return (
              <group key={c.id} position={[x, 0, z]} rotation={[0, rotY, 0]}>
                {pose === 'Sit_Chair_Idle' && <Chair color={SEAT_COLORS[i]} />}
                <group onClick={(e) => { e.stopPropagation(); setTarget(i); setMode('target'); }}>
                  <Character model={c.id} pose={pose} look={look} />
                </group>
                <Html position={[0, pose === 'Sit_Chair_Idle' ? 2.75 : 3.1, pose === 'Sit_Chair_Idle' ? -0.35 : 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
                  <div className="plate" style={{ background: SEAT_COLORS[i] }}>{c.label}</div>
                </Html>
              </group>
            );
          })}
          <mesh position={[0, TABLE_H + 0.05, 0]} visible={false} />
        </Suspense>
        <OrbitControls target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={11} />
      </Canvas>

      <div className="ui pv-panel">
        <div className="pv-title">KayKit 캐릭터 9종</div>
        <p className="k">입장할 때 이 중에서 겹치지 않게 랜덤으로 배정돼요. 캐릭터를 클릭하면 모두가 그 사람을 쳐다봐요.</p>
        <div className="pv-row">
          <span className="k">자세</span>
          {([['Sit_Chair_Idle', '앉기'], ['Idle', '서기'], ['Cheer', '환호']] as const).map(([p, l]) => (
            <button key={p} className={`btn ${pose === p ? '' : 'ghost'}`} onClick={() => setPose(p)}>{l}</button>
          ))}
        </div>
        <div className="pv-row">
          <span className="k">고개</span>
          <button className={`btn ${mode === 'target' ? '' : 'ghost'}`} onClick={() => setMode('target')}>{CHARACTERS[target].label} 보기</button>
          <button className={`btn ${mode === 'center' ? '' : 'ghost'}`} onClick={() => setMode('center')}>테이블 보기</button>
          <button className={`btn ${mode === 'random' ? '' : 'ghost'}`} onClick={() => { setRand(randomLook()); setMode('random'); }}>두리번</button>
        </div>
        <p className="k">드래그로 회전, 휠로 확대해요. 모델: KayKit Adventurers · Skeletons (CC0, Kay Lousberg)</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>);
