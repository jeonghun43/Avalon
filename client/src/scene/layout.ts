// 원탁 좌표: 테이블 중심이 원점. 내 자리가 항상 카메라 쪽(+Z)에 오도록 회전한다.
export const TABLE_R = 2.7;
export const TABLE_H = 0.95;
export const SEAT_R = 3.45;
export const EYE_H = 2.45;

/** 자리 seat의 각도. mySeat가 +Z(카메라 쪽)에 오고, 나머지는 시계 방향으로 놓인다 */
export function seatAngle(seat: number, n: number, mySeat: number) {
  return Math.PI / 2 + (2 * Math.PI * (seat - mySeat)) / n;
}

export function seatPos(seat: number, n: number, mySeat: number, r = SEAT_R): [number, number] {
  const a = seatAngle(seat, n, mySeat);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/** 테이블 위, 자리 앞쪽 지점 (f = 테이블 반지름 대비 비율, off = 각도 오프셋) */
export function tableSpot(seat: number, n: number, mySeat: number, f: number, off = 0): [number, number, number] {
  const a = seatAngle(seat, n, mySeat) + off;
  return [Math.cos(a) * TABLE_R * f, TABLE_H + 0.01, Math.sin(a) * TABLE_R * f];
}

/** (x, z)에서 원점을 바라보는 y 회전 (모델 정면 +Z 기준) */
export function faceCenter(x: number, z: number) {
  return Math.atan2(-x, -z);
}

/** 몸이 bodyYaw로 서 있을 때 (fromX, fromZ)에서 (toX, toZ)를 보려면 고개를 얼마나 돌려야 하는지 */
export function headYawTo(bodyYaw: number, fromX: number, fromZ: number, toX: number, toZ: number) {
  const want = Math.atan2(toX - fromX, toZ - fromZ);
  let d = want - bodyYaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.max(-1.2, Math.min(1.2, d));
}
