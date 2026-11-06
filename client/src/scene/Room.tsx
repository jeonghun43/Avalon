import { SEAT_R, TABLE_H, TABLE_R } from './layout';

function Torch({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.07, 0.05, 0.7, 8]} />
        <meshStandardMaterial color="#3A2A1C" />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <coneGeometry args={[0.16, 0.42, 8]} />
        <meshBasicMaterial color="#F2A23A" />
      </mesh>
      <pointLight position={[0, 0.3, 0.4]} color="#FFB461" intensity={14} distance={14} decay={1.6} />
    </group>
  );
}

function Banner({ position, color, rotY }: { position: [number, number, number]; color: string; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[1.1, 2.4, 0.05]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.25, 0.05]}>
        <boxGeometry args={[1.35, 0.1, 0.1]} />
        <meshStandardMaterial color="#5A4430" />
      </mesh>
    </group>
  );
}

/** 돌방 + 원탁. 의자는 Seat에서 그린다 */
export function Room() {
  const wallR = SEAT_R + 5.5;
  return (
    <group>
      <ambientLight intensity={0.55} color="#9FB3C8" />
      <hemisphereLight args={['#C9D6E3', '#2A1E14', 0.5]} />
      <directionalLight position={[2, 9, 3]} intensity={0.9} color="#FFE2B8" castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />

      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[wallR, 48]} />
        <meshStandardMaterial color="#2B3238" />
      </mesh>
      {/* 바닥 카펫 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[SEAT_R + 1.1, 48]} />
        <meshStandardMaterial color="#5B2E2A" />
      </mesh>
      {/* 벽 */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[wallR, wallR, 8, 24, 1, true]} />
        <meshStandardMaterial color="#33424C" side={1} flatShading />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const r = wallR - 0.25;
        return <Torch key={i} position={[Math.cos(a) * r, 3.2, Math.sin(a) * r]} />;
      })}
      <Banner position={[-2.2, 4.2, -wallR + 0.4]} color="#2F5FA8" rotY={0} />
      <Banner position={[2.2, 4.2, -wallR + 0.4]} color="#A83A30" rotY={0} />

      {/* 원탁 */}
      <group>
        <mesh position={[0, TABLE_H - 0.09, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[TABLE_R, TABLE_R, 0.18, 48]} />
          <meshStandardMaterial color="#9A6B43" />
        </mesh>
        <mesh position={[0, TABLE_H - 0.2, 0]}>
          <cylinderGeometry args={[TABLE_R - 0.02, TABLE_R - 0.1, 0.08, 48]} />
          <meshStandardMaterial color="#5C3A22" />
        </mesh>
        <mesh position={[0, TABLE_H + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[TABLE_R - 0.32, TABLE_R - 0.24, 64]} />
          <meshStandardMaterial color="#7E5433" />
        </mesh>
        <mesh position={[0, TABLE_H + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.45, 48]} />
          <meshStandardMaterial color="#8A5D38" />
        </mesh>
        <mesh position={[0, (TABLE_H - 0.2) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.6, TABLE_H - 0.2, 16]} />
          <meshStandardMaterial color="#5C3A22" />
        </mesh>
      </group>
    </group>
  );
}

/** 자리 하나의 의자. KayKit Sit_Chair 자세는 엉덩이가 (0, 0.48, -0.4)에 오므로 좌판을 거기에 맞춘다 */
export function Chair({ color }: { color: string }) {
  return (
    <group position={[0, 0, -0.38]}>
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.1, 0.85]} />
        <meshStandardMaterial color="#4A2F1C" />
      </mesh>
      <mesh position={[0, 0.43, 0.02]} castShadow>
        <boxGeometry args={[0.8, 0.06, 0.72]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.95, -0.42]} castShadow>
        <boxGeometry args={[0.95, 1.1, 0.1]} />
        <meshStandardMaterial color="#4A2F1C" />
      </mesh>
      {[[-0.39, -0.35], [0.39, -0.35], [-0.39, 0.35], [0.39, 0.35]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.16, z]}>
          <boxGeometry args={[0.1, 0.32, 0.1]} />
          <meshStandardMaterial color="#3A2516" />
        </mesh>
      ))}
    </group>
  );
}
