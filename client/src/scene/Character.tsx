import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHARACTERS, type CharacterId } from '@avalon/shared';

export type Pose = 'Sit_Chair_Idle' | 'Idle' | 'Cheer';

interface Props {
  model: CharacterId;
  pose?: Pose;
  /** 고개 방향 (라디안). 몸 기준 좌우 yaw, 위아래 pitch */
  look?: { yaw: number; pitch: number };
  opacity?: number;
}

const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpRot = new THREE.Quaternion();
const tmpAxis = new THREE.Vector3();

const fileOf = (id: CharacterId) => `/models/${CHARACTERS.find((c) => c.id === id)!.file}`;

export function Character({ model, pose = 'Sit_Chair_Idle', look, opacity = 1 }: Props) {
  const gltf = useGLTF(fileOf(model));
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const head = useMemo(() => scene.getObjectByName('head') ?? null, [scene]);
  const cur = useRef({ yaw: 0, pitch: 0 });

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.material = (m.material as THREE.Material).clone();
    });
  }, [scene]);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
    });
  }, [scene, opacity]);

  useEffect(() => {
    const clip = gltf.animations.find((a) => a.name === pose);
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.reset().fadeIn(0.25).play();
    // 대기 동작이 모두 같은 박자로 움직이지 않게 시작 지점을 흩뜨림
    action.time = Math.random() * clip.duration;
    return () => void action.fadeOut(0.25);
  }, [gltf.animations, mixer, pose]);

  useFrame((_, dt) => {
    mixer.update(dt);
    if (!head) return;
    // 카메라는 ±100°까지 돌지만 고개는 자연스러운 범위까지만
    const t = { yaw: Math.max(-1.2, Math.min(1.2, look?.yaw ?? 0)), pitch: Math.max(-0.7, Math.min(0.5, look?.pitch ?? 0)) };
    const k = 1 - Math.exp(-dt * 10);
    cur.current.yaw += (t.yaw - cur.current.yaw) * k;
    cur.current.pitch += (t.pitch - cur.current.pitch) * k;
    // 애니메이션이 정한 자세 위에 고개 회전을 더함 (몸의 위쪽 축 기준 yaw, 머리 좌우 축 기준 pitch)
    head.parent!.getWorldQuaternion(tmpQ).invert();
    tmpAxis.set(0, 1, 0).applyQuaternion(scene.getWorldQuaternion(tmpQ2)).applyQuaternion(tmpQ);
    head.quaternion.premultiply(tmpRot.setFromAxisAngle(tmpAxis, cur.current.yaw));
    head.rotateX(-cur.current.pitch);
  });

  return <primitive object={scene} />;
}

CHARACTERS.forEach((c) => useGLTF.preload(`/models/${c.file}`));
