import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../state/store';
import { DPR_STEPS, QUALITY } from './quality';

/**
 * In the overview nothing moves by itself, so frames are drawn only when
 * something changes — any change of app state, plus the camera controls, which
 * ask for frames themselves. An idle overview then costs no GPU time at all.
 */
export function RenderOnDemand() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const wake = () => invalidate(2);
    wake();
    const stop = useStore.subscribe(wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      stop();
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [invalidate]);
  return null;
}

const fresh = () => ({ time: 0, frames: 0, low: 0, high: 0, refresh: 60, heavy: Infinity, heavyUntil: 0 });

/**
 * Watches the frame rate while the view is actually moving and trades
 * resolution for smoothness: two slow seconds drop the resolution a step, a
 * sustained run at the display's refresh rate raises it again, up to the
 * preset's limit. Pauses (a tab in the background, an idle overview) are not
 * mistaken for slow frames.
 */
export function AdaptiveResolution() {
  const quality = useStore((s) => s.quality);
  const book = useRef(fresh());
  useEffect(() => {
    book.current = fresh();
  }, [quality]);

  useFrame((_, delta) => {
    const b = book.current;
    if (delta <= 0 || delta > 0.1) {
      b.time = 0;
      b.frames = 0;
      return;
    }
    b.time += delta;
    b.frames += 1;
    if (b.time < 1) return;
    const fps = b.frames / b.time;
    b.time = 0;
    b.frames = 0;
    b.refresh = Math.min(144, Math.max(b.refresh, fps));

    const s = useStore.getState();
    const shown = Math.round(fps);
    if (s.fps === null || Math.abs(s.fps - shown) >= 2) s.patch({ fps: shown });
    if (!s.autoResolution) return;

    b.low = fps < Math.min(52, b.refresh * 0.85) ? b.low + 1 : 0;
    b.high = fps > b.refresh * 0.92 ? b.high + 1 : 0;
    const cap = Math.min(QUALITY[s.quality].dprCap, window.devicePixelRatio || 1);
    const step = DPR_STEPS.reduce((best, v, i) => (Math.abs(v - s.dpr) < Math.abs(DPR_STEPS[best] - s.dpr) ? i : best), 0);
    const now = performance.now();
    if (b.low >= 2 && step > 0) {
      b.low = 0;
      // This resolution has just proved too heavy: do not climb back to it for a couple of
      // minutes, or the picture would keep flipping between two sharpnesses.
      b.heavy = DPR_STEPS[step];
      b.heavyUntil = now + 120000;
      s.patch({ dpr: DPR_STEPS[step - 1] });
    } else if (b.high >= 5 && step < DPR_STEPS.length - 1) {
      const next = DPR_STEPS[step + 1];
      const barred = next >= b.heavy - 1e-6 && now < b.heavyUntil;
      if (next <= cap + 1e-6 && !barred) {
        b.high = 0;
        s.patch({ dpr: next });
      }
    }
  });
  return null;
}
