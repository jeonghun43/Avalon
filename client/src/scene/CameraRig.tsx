import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { api } from '../net/socket';
import { EYE_H, SEAT_R } from './layout';

/** 드래그 이동량. 이만큼 움직였으면 클릭으로 치지 않는다 */
export const drag = { moved: 0 };

const BASE_PITCH = -0.3;            // 기본으로 테이블을 내려다보는 각도
const YAW_LIMIT = 1.75;              // 좌우 약 ±100°
const PITCH_MIN = -0.62, PITCH_MAX = 0.62; // 기본 각도 기준 위아래 약 ±35°

/** 내 자리에 고정된 1인칭 카메라. 드래그로 둘러보고, 바라보는 방향을 서버로 보낸다 */
export function CameraRig({ element }: { element: HTMLElement | null }) {
  const camera = useThree((s) => s.camera);
  const look = useRef({ yaw: 0, pitch: 0 });
  const sent = useRef({ yaw: 99, pitch: 99, at: 0 });

  useEffect(() => {
    camera.position.set(0, EYE_H, SEAT_R + 0.25);
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useEffect(() => {
    if (!element) return;
    let down: { x: number; y: number; id: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      drag.moved = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.x = e.clientX;
      down.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      const k = 0.0042;
      look.current.yaw = Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, look.current.yaw + dx * k));
      look.current.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, look.current.pitch + dy * k));
    };
    const onUp = () => { down = null; };
    // 방향키로도 둘러보기 (입력 칸에 글을 쓰는 중이면 무시)
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const step = 0.12;
      const l = look.current;
      if (e.key === 'ArrowLeft') l.yaw = Math.min(YAW_LIMIT, l.yaw + step);
      else if (e.key === 'ArrowRight') l.yaw = Math.max(-YAW_LIMIT, l.yaw - step);
      else if (e.key === 'ArrowUp') l.pitch = Math.min(PITCH_MAX, l.pitch + step);
      else if (e.key === 'ArrowDown') l.pitch = Math.max(PITCH_MIN, l.pitch - step);
      else return;
      e.preventDefault();
    };
    element.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [element]);

  useFrame(({ clock }) => {
    const yaw = look.current.yaw;
    const pitch = BASE_PITCH + look.current.pitch;
    camera.rotation.y += (yaw - camera.rotation.y) * 0.35;
    camera.rotation.x += (pitch - camera.rotation.x) * 0.35;
    // 바라보는 방향: yaw는 "테이블 가운데를 볼 때 0", pitch는 위가 +
    const now = clock.elapsedTime;
    const s = sent.current;
    if (now - s.at > 0.1 && (Math.abs(s.yaw - yaw) > 0.02 || Math.abs(s.pitch - pitch) > 0.02)) {
      api.gaze(+yaw.toFixed(3), +pitch.toFixed(3));
      sent.current = { yaw, pitch, at: now };
    }
  });

  return null;
}
