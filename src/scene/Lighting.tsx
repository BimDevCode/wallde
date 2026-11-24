import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Sky } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BOUNDS } from '../model/apartment.ts';
import { useStore } from '../state/store';
import { QUALITY } from './quality';
import { ShadowRefresher, requestShadows } from './shadows';
import { sunAt } from './sun';

const CENTER = new THREE.Vector3((BOUNDS.x0 + BOUNDS.x1) / 2, BOUNDS.height / 2, (BOUNDS.z0 + BOUNDS.z1) / 2);

export function Lighting() {
  const sun = useStore((s) => s.sun);
  const ambient = useStore((s) => s.ambient);
  const exposure = useStore((s) => s.exposure);
  const shadows = useStore((s) => s.shadows);
  const mode = useStore((s) => s.mode);
  const top = useStore((s) => s.visibleLevel);
  const context = useStore((s) => s.context);
  const rev = useStore((s) => s.rev);
  const quality = useStore((s) => QUALITY[s.quality]);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const state = useMemo(() => sunAt(sun.hour), [sun.hour]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(CENTER);
    return o;
  }, []);
  const sunPosition = useMemo(() => CENTER.clone().addScaledVector(state.direction, 45), [state]);

  // Soft, neutral image-based fill light, generated in memory (no HDR file to download).
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, invalidate]);

  useEffect(() => {
    // Even at night some light bounces around a lit flat, so the fill never drops to nothing.
    scene.environmentIntensity = ambient * (0.2 + 0.8 * (sun.on ? state.daylight : 0));
    invalidate();
  }, [scene, ambient, state, sun.on, invalidate]);

  useEffect(() => {
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [gl, exposure, invalidate]);

  const sunIntensity = sun.on ? sun.intensity * state.daylight : 0;
  // Shadow maps are redrawn only when something that affects them changes.
  const token = `${sun.hour}|${sun.on}|${shadows}|${mode}|${top}|${context}|${rev}|${quality.sunShadow}`;
  useEffect(() => {
    requestShadows();
  }, [token]);

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={state.direction.clone().multiplyScalar(1000)}
        turbidity={5}
        rayleigh={state.daylight > 0.05 ? 1.1 : 0.15}
        mieCoefficient={0.004}
        mieDirectionalG={0.82}
      />
      <primitive object={target} />
      <directionalLight
        target={target}
        position={sunPosition}
        color={state.color}
        intensity={sunIntensity}
        castShadow={shadows}
        key={quality.sunShadow}
        shadow-mapSize={[quality.sunShadow, quality.sunShadow]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      >
        <orthographicCamera attach="shadow-camera" args={[-13, 13, 13, -13, 1, 90]} />
      </directionalLight>
      <ShadowRefresher />
    </>
  );
}
