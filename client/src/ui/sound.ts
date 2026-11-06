// 효과음은 파일 없이 Web Audio로 짧게 합성한다. 소리는 사용자가 한 번 클릭한 뒤에만 난다 (브라우저 정책)
import { useStore } from '../store';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ready() {
  if (useStore.getState().muted) return false;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export const sound = {
  /** 내 차례 */
  turn() { if (ready()) { tone(660, 0, 0.18); tone(880, 0.12, 0.25); } },
  /** 카드 뒤집기 */
  flip() { if (ready()) tone(320, 0, 0.08, 'triangle', 0.15); },
  success() { if (ready()) { tone(523, 0, 0.2); tone(659, 0.1, 0.2); tone(784, 0.2, 0.35); } },
  fail() { if (ready()) { tone(220, 0, 0.35, 'sawtooth', 0.07); tone(165, 0.18, 0.5, 'sawtooth', 0.07); } },
};

const KEY = 'avalon-muted';
export function loadMuted() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function saveMuted(v: boolean) {
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* 저장 못 해도 이번 세션은 적용 */ }
}
