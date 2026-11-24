import { useEffect, useRef, type ComponentRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';

import { useStore } from '../state/store';
import { sceneRegistry } from './registry';

const HOME = {
  position: new THREE.Vector3(17.5, 15.5, 25),
  target: new THREE.Vector3(3.65, 4, 7.4),
};

/** Overview camera: orbit, pan and zoom around the building. */
export function OrbitRig() {
  const camera = useThree((s) => s.camera);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const focus = useStore((s) => s.focus);
  const glide = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const pose = sceneRegistry.orbit ?? HOME;
    camera.position.copy(pose.position);
    camera.rotation.set(0, 0, 0);
    const c = controls.current;
    if (c) {
      c.target.copy(pose.target);
      c.update();
    }
  }, [camera]);

  useEffect(() => {
    if (focus) glide.current = new THREE.Vector3(focus.x, focus.y, focus.z);
  }, [focus]);

  useFrame((state, delta) => {
    const c = controls.current;
    if (!c) return;
    if (glide.current) {
      // Slide the whole view so the chosen room sits at the centre of the orbit.
      const step = glide.current.clone().sub(c.target).multiplyScalar(Math.min(1, delta * 5));
      c.target.add(step);
      camera.position.add(step);
      if (step.lengthSq() < 1e-6) glide.current = null;
      c.update();
      // The overview draws on demand, so the glide has to keep asking for frames.
      state.invalidate();
    }
    sceneRegistry.orbit ??= { position: new THREE.Vector3(), target: new THREE.Vector3() };
    sceneRegistry.orbit.position.copy(camera.position);
    sceneRegistry.orbit.target.copy(c.target);
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      minDistance={1.5}
      maxDistance={80}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  );
}
