import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

/** 글자를 그린 텍스처 (카드 앞면, 라운드 보드 숫자 등). 외부 폰트 파일 없이 페이지에 로드된 Jua를 쓴다 */
export function labelTexture(text: string, bg: string, fg: string, opts: { w?: number; h?: number; size?: number; border?: string } = {}) {
  const { w = 256, h = 256, size = 96, border } = opts;
  const key = [text, bg, fg, w, h, size, border].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = Math.round(w * 0.05);
    g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${size}px Jua, "Malgun Gothic", sans-serif`;
  const lines = text.split('\n');
  lines.forEach((line, i) => g.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
