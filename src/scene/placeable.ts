import { useRef } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { LEVELS } from '../model/apartment.ts';
import { useStore, type Picked } from '../state/store';

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const point = new THREE.Vector3();

export function levelShown(level: number, mode: string, top: number): boolean {
  return mode === 'walk' || top >= 3 || level <= top;
}

/**
 * Pointer handlers for something standing in the flat: a click selects it, and in
 * the overview a drag slides it across its own floor (5 cm steps, 1 cm with Alt).
 */
export function usePlaceable(
  target: Picked,
  level: number,
  position: { x: number; z: number },
  move: (x: number, z: number) => void,
) {
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const drag = useRef<{ dx: number; dz: number; sx: number; sy: number; moving: boolean } | null>(null);

  const onFloor = (e: ThreeEvent<PointerEvent>) => {
    plane.constant = -LEVELS[level].elevation;
    return e.ray.intersectPlane(plane, point);
  };

  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      const s = useStore.getState();
      if (s.mode !== 'orbit' || s.placing || e.button !== 0) return;
      e.stopPropagation();
      s.pick(target);
      const p = onFloor(e);
      if (!p) return;
      drag.current = { dx: position.x - p.x, dz: position.z - p.z, sx: e.clientX, sy: e.clientY, moving: false };
      (e.target as Element).setPointerCapture(e.pointerId);
      if (controls) controls.enabled = false;
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current;
      if (!d) return;
      e.stopPropagation();
      if (!d.moving && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      d.moving = true;
      const p = onFloor(e);
      if (!p) return;
      const step = e.altKey ? 0.01 : 0.05;
      move(Math.round((p.x + d.dx) / step) * step, Math.round((p.z + d.dz) / step) * step);
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current) return;
      drag.current = null;
      (e.target as Element).releasePointerCapture(e.pointerId);
      if (controls) controls.enabled = true;
    },
    // Without this the click would carry on to the floor behind and select that instead.
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (useStore.getState().mode === 'orbit' && !useStore.getState().placing) e.stopPropagation();
    },
  };
}
