import { useEffect } from 'react';
import { invalidate, useFrame, useThree } from '@react-three/fiber';

let pending = 4;

/** Ask for the shadow maps to be redrawn; they are otherwise left alone, since nothing in the flat moves by itself. */
export function requestShadows(): void {
  pending = 4;
  invalidate();
}

export function ShadowRefresher() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame((state) => {
    if (pending > 0) {
      gl.shadowMap.needsUpdate = true;
      pending -= 1;
      state.invalidate();
    }
  });
  return null;
}
