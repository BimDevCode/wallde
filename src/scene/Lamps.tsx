import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BOUNDS, CLEAR, LEVELS, groupOf, roomById } from '../model/apartment.ts';
import type { Lamp } from '../model/types.ts';
import { SURFACE_BY_KEY, groupAt, useStore } from '../state/store';
import { levelShown, usePlaceable } from './placeable';
import { QUALITY } from './quality';
import { sceneRegistry } from './registry';
import { requestShadows } from './shadows';

/** The light source hangs a little below a ceiling fitting so it washes the ceiling instead of scorching it. */
const LAMP_DROP = 0.38;
const AMBER = '#ffb347';
const CENTER = { x: (BOUNDS.x0 + BOUNDS.x1) / 2, y: BOUNDS.height / 2, z: (BOUNDS.z0 + BOUNDS.z1) / 2 };

/** Where the light itself sits. */
function lightPosition(l: Lamp): [number, number, number] {
  const floor = LEVELS[l.level].elevation;
  const ceiling = floor + CLEAR;
  if (l.kind === 'pendant') return [l.x, ceiling - (l.drop ?? 0.9) - 0.1, l.z];
  if (l.kind === 'spot') return [l.x, ceiling - 0.04, l.z];
  if (l.kind === 'floor') return [l.x, floor + 1.42, l.z];
  return [l.x, ceiling - 0.06 - LAMP_DROP, l.z];
}

// ───────────── The lights themselves ─────────────

interface Ranked {
  lamp: Lamp;
  score: number;
}

/**
 * Orders the lit lamps by how much they matter to the current view: the room you
 * are in (or have selected) first, then by distance, with other storeys last.
 */
function rankLamps(s: ReturnType<typeof useStore.getState>, focus: { x: number; y: number; z: number }): Ranked[] {
  const walking = s.mode === 'walk';
  const focusLevel = walking ? s.player.level : Math.min(s.visibleLevel, LEVELS.length - 1);
  let ownGroup: string | null = null;
  if (walking) {
    const room = s.player.roomId ? roomById(s.player.roomId) : undefined;
    ownGroup = room ? groupOf(room) : null;
  } else if (s.selected) {
    ownGroup = SURFACE_BY_KEY.get(s.selected)?.group ?? null;
  }
  const pickedId = s.picked?.type === 'lamp' ? s.picked.id : null;

  const ranked: Ranked[] = [];
  for (const lamp of s.lamps) {
    if (!lamp.on || !levelShown(lamp.level, s.mode, s.visibleLevel)) continue;
    const [x, y, z] = lightPosition(lamp);
    let score = Math.hypot(x - focus.x, y - focus.y, z - focus.z);
    if (lamp.level !== focusLevel) score += walking ? 6 : 40;
    if (ownGroup && groupAt(lamp) === ownGroup) score -= 30;
    if (lamp.id === pickedId) score -= 60;
    ranked.push({ lamp, score });
  }
  return ranked.sort((a, b) => a.score - b.score);
}

/**
 * Every lit pixel pays for every light in the scene, so the scene holds a small,
 * fixed set of real lights and lends them to whichever lamps matter most right
 * now. Lamps beyond that still glow but no longer light their surroundings; the
 * last one in fades out rather than popping. The first light of each kind casts
 * shadows. Because the count never changes, adding a lamp or walking between
 * rooms never forces the shaders to recompile.
 */
function LightPool({ points, spots, shadowSize }: { points: number; spots: number; shadowSize: number }) {
  const shadows = useStore((s) => s.shadows);
  const pointLights = useRef<(THREE.PointLight | null)[]>([]);
  const spotLights = useRef<(THREE.SpotLight | null)[]>([]);
  const targets = useMemo(() => Array.from({ length: spots }, () => new THREE.Object3D()), [spots]);
  const book = useRef({ dirty: true, timer: 0, lead: '' });

  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (
          s.lamps !== prev.lamps || s.mode !== prev.mode || s.visibleLevel !== prev.visibleLevel ||
          s.picked !== prev.picked || s.selected !== prev.selected || s.player.roomId !== prev.player.roomId
        ) book.current.dirty = true;
      }),
    [],
  );
  useEffect(() => {
    book.current.dirty = true;
  }, [points, spots]);

  useFrame((three, delta) => {
    const b = book.current;
    b.timer += delta;
    if (!b.dirty && b.timer < 0.2) return;
    b.dirty = false;
    b.timer = 0;

    const s = useStore.getState();
    const orbitTarget = (three.controls as { target?: THREE.Vector3 } | null)?.target;
    const focus = s.mode === 'walk'
      ? { x: s.player.x, y: s.player.y + 1.5, z: s.player.z }
      : orbitTarget ?? CENTER;
    const ranked = rankLamps(s, focus);
    let lead = '';

    const lend = <L extends THREE.PointLight | THREE.SpotLight>(lights: (L | null)[], list: Ranked[], apply: (light: L, lamp: Lamp, slot: number) => void) => {
      const cutoff = list[lights.length]?.score;
      lights.forEach((light, i) => {
        if (!light) return;
        const entry = list[i];
        if (!entry) {
          light.intensity = 0;
          return;
        }
        const { lamp, score } = entry;
        // The lamp about to drop out of the set dims over the last stretch instead of switching off.
        const weight = i === 0 || cutoff === undefined ? 1 : THREE.MathUtils.clamp((cutoff - score) / 2, 0, 1);
        const [x, y, z] = lightPosition(lamp);
        light.position.set(x, y, z);
        if (light.userData.tint !== lamp.color) {
          light.color.set(lamp.color);
          light.userData.tint = lamp.color;
        }
        light.intensity = lamp.intensity * weight;
        apply(light, lamp, i);
        if (i === 0) lead += `${lamp.id}:${x},${y},${z},${lamp.angle ?? ''}|`;
      });
    };

    lend(pointLights.current.slice(0, points), ranked.filter((r) => r.lamp.kind !== 'spot'), () => {});
    lend(spotLights.current.slice(0, spots), ranked.filter((r) => r.lamp.kind === 'spot'), (light, lamp, i) => {
      light.angle = THREE.MathUtils.degToRad((lamp.angle ?? 70) / 2);
      targets[i].position.set(lamp.x, LEVELS[lamp.level].elevation, lamp.z);
      targets[i].updateMatrixWorld();
    });

    // Only the leading light of each kind casts shadows; redraw them when it changes hands or moves.
    if (lead !== b.lead) {
      b.lead = lead;
      requestShadows();
    }
  });

  return (
    <>
      {Array.from({ length: points }, (_, i) => (
        <pointLight
          key={`point-${i}`}
          ref={(light) => { pointLights.current[i] = light; }}
          position={[0, -50, 0]}
          intensity={0}
          distance={9}
          decay={2}
          castShadow={i === 0 && shadows}
          shadow-mapSize={[shadowSize, shadowSize]}
          shadow-bias={-0.002}
          shadow-normalBias={0.03}
          shadow-camera-near={0.05}
          shadow-camera-far={10}
        />
      ))}
      {targets.map((target, i) => (
        <group key={`spot-${i}`}>
          <primitive object={target} position={[0, -60, 0]} />
          <spotLight
            ref={(light) => { spotLights.current[i] = light; }}
            target={target}
            position={[0, -50, 0]}
            intensity={0}
            penumbra={0.55}
            distance={8}
            decay={2}
            castShadow={i === 0 && shadows}
            shadow-mapSize={[shadowSize, shadowSize]}
            shadow-bias={-0.0015}
            shadow-normalBias={0.03}
          />
        </group>
      ))}
    </>
  );
}

// ───────────── The fittings you see ─────────────

function Glow({ lamp, lit, side }: { lamp: Lamp; lit: boolean; side?: THREE.Side }) {
  return (
    <meshStandardMaterial color="#f4f1ea" emissive={lamp.color} emissiveIntensity={lit ? 2.4 : 0} roughness={0.6} side={side} />
  );
}

function Fitting({ lamp, lit }: { lamp: Lamp; lit: boolean }) {
  const floor = LEVELS[lamp.level].elevation;
  const ceiling = floor + CLEAR;
  if (lamp.kind === 'pendant') {
    const drop = lamp.drop ?? 0.9;
    return (
      <>
        <mesh position-y={ceiling - drop / 2}>
          <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
          <meshStandardMaterial color="#26282b" />
        </mesh>
        <mesh position-y={ceiling - drop}>
          <cylinderGeometry args={[0.05, 0.19, 0.18, 28, 1, true]} />
          <meshStandardMaterial color="#2b2d31" roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh position-y={ceiling - drop - 0.04}>
          <sphereGeometry args={[0.055, 18, 12]} />
          <Glow lamp={lamp} lit={lit} />
        </mesh>
      </>
    );
  }
  if (lamp.kind === 'spot') {
    return (
      <>
        <mesh position-y={ceiling - 0.008}>
          <cylinderGeometry args={[0.062, 0.062, 0.016, 24]} />
          <meshStandardMaterial color="#e9e6df" roughness={0.4} />
        </mesh>
        <mesh position-y={ceiling - 0.014}>
          <cylinderGeometry args={[0.042, 0.042, 0.012, 24]} />
          <Glow lamp={lamp} lit={lit} />
        </mesh>
      </>
    );
  }
  if (lamp.kind === 'floor') {
    return (
      <>
        <mesh position-y={floor + 0.012} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.024, 24]} />
          <meshStandardMaterial color="#26282b" roughness={0.5} />
        </mesh>
        <mesh position-y={floor + 0.68} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 1.32, 8]} />
          <meshStandardMaterial color="#26282b" roughness={0.5} />
        </mesh>
        <mesh position-y={floor + 1.46}>
          <cylinderGeometry args={[0.14, 0.18, 0.28, 28, 1, true]} />
          <Glow lamp={lamp} lit={lit} side={THREE.DoubleSide} />
        </mesh>
      </>
    );
  }
  return (
    <mesh position-y={ceiling - 0.022}>
      <cylinderGeometry args={[0.14, 0.15, 0.04, 28]} />
      <Glow lamp={lamp} lit={lit} />
    </mesh>
  );
}

const LampFitting = memo(function LampFitting({ lamp, picked }: { lamp: Lamp; picked: boolean }) {
  const floor = LEVELS[lamp.level].elevation;
  const position = lightPosition(lamp);
  const handlers = usePlaceable({ type: 'lamp', id: lamp.id }, lamp.level, lamp, (x, z) =>
    useStore.getState().updateLamp(lamp.id, { x, z }),
  );
  const register = useCallback(
    (group: THREE.Group | null) => {
      if (group) sceneRegistry.objects.set(`lamp:${lamp.id}`, group);
      else sceneRegistry.objects.delete(`lamp:${lamp.id}`);
    },
    [lamp.id],
  );

  return (
    <group ref={register} position={[lamp.x, 0, lamp.z]} userData={{ pick: { type: 'lamp', id: lamp.id } }} {...handlers}>
      <Fitting lamp={lamp} lit={lamp.on} />
      {/* Small fittings are hard to hit, so each gets a generous unseen handle. */}
      <mesh position-y={lamp.kind === 'floor' ? floor + 0.8 : position[1] + (lamp.kind === 'ceiling' ? LAMP_DROP : 0)}>
        {lamp.kind === 'floor' ? <cylinderGeometry args={[0.2, 0.2, 1.6, 12]} /> : <sphereGeometry args={[0.22, 12, 8]} />}
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {picked &&
        [floor + 0.02, position[1]].map((y) => (
          <mesh key={y} rotation-x={-Math.PI / 2} position-y={y} renderOrder={30}>
            <ringGeometry args={[0.25, 0.3, 40]} />
            <meshBasicMaterial color={AMBER} toneMapped={false} depthTest={false} transparent side={THREE.DoubleSide} />
          </mesh>
        ))}
    </group>
  );
});

export function Lamps() {
  const lamps = useStore((s) => s.lamps);
  const mode = useStore((s) => s.mode);
  const top = useStore((s) => s.visibleLevel);
  const quality = useStore((s) => QUALITY[s.quality]);
  const pickedId = useStore((s) => (s.picked?.type === 'lamp' ? s.picked.id : null));

  return (
    <>
      {lamps
        .filter((l) => levelShown(l.level, mode, top))
        .map((l) => (
          <LampFitting key={l.id} lamp={l} picked={l.id === pickedId} />
        ))}
      <LightPool key={`${quality.points}-${quality.spots}`} points={quality.points} spots={quality.spots} shadowSize={quality.lampShadow} />
    </>
  );
}
