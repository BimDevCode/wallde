import { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Surface } from '../model/build.ts';
import { FIXED_MATERIALS, materialFor } from '../materials/library';
import { SURFACES, useStore, type Mode } from '../state/store';
import { SOLID_LAYER } from './quality';
import { sceneRegistry } from './registry';

function toGeometry(s: Surface): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(s.mesh.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(s.mesh.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(s.mesh.uvs, 2));
  if (s.mesh.colors.length) g.setAttribute('color', new THREE.Float32BufferAttribute(s.mesh.colors, 4));
  g.setIndex(s.mesh.indices);
  g.computeBoundingSphere();
  return g;
}

const GEOMETRIES = new Map(SURFACES.map((s) => [s.key, toGeometry(s)]));
const FALLBACK = new THREE.MeshStandardMaterial({ color: '#cccccc' });

/**
 * In the overview everything above the chosen storey is lifted off, along with
 * that storey's own ceilings, so you look down into the rooms.
 */
function isVisible(s: Surface, mode: Mode, top: number, context: boolean, ao: boolean): boolean {
  if (s.kind === 'context') return context;
  // Baked corner shading stands in for screen-space ambient occlusion, so only one of them shows.
  if ((s.kind === 'shade' || s.kind === 'shadeCeiling') && ao) return false;
  if (mode === 'walk' || top >= 3) return true;
  if (s.kind === 'slab') return s.capOf == null ? s.level <= top : s.capOf < top;
  if (s.kind === 'ceiling' || s.kind === 'shadeCeiling') return s.level < top;
  return s.level <= top;
}

const isDecal = (kind: Surface['kind']) => kind === 'shade' || kind === 'shadeCeiling';

function SurfaceMesh({ surface }: { surface: Surface }) {
  const assignment = useStore((s) => (surface.selectable ? s.assignments[surface.key] : undefined));
  const visible = useStore((s) => isVisible(surface, s.mode, s.visibleLevel, s.context, s.ao));
  const placing = useStore((s) => s.placing !== null);
  const material = useMemo(
    () => (assignment ? materialFor(assignment) : FIXED_MATERIALS[surface.kind] ?? FALLBACK),
    [assignment, surface.kind],
  );
  const register = useCallback(
    (mesh: THREE.Mesh | null) => {
      if (mesh) {
        sceneRegistry.meshes.set(surface.key, mesh);
        if (surface.kind !== 'glass' && !isDecal(surface.kind)) mesh.layers.enable(SOLID_LAYER);
      } else {
        sceneRegistry.meshes.delete(surface.key);
      }
    },
    [surface.key, surface.kind],
  );

  // Glass and the neighbouring volumes let clicks through; everything else is solid.
  const decal = isDecal(surface.kind);
  const solid = surface.kind !== 'glass' && surface.kind !== 'context' && !decal;
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const state = useStore.getState();
    if (state.mode !== 'orbit' || !e.object.visible) return;
    e.stopPropagation();
    if (e.delta > 4) return;
    if (state.placing) {
      // Something is waiting to be put down: floors take it, everything else ignores the click.
      if (surface.kind === 'floor') state.placeAt(e.point.x, e.point.z, surface.level);
      return;
    }
    state.pick(null);
    state.select(surface.selectable ? surface.key : null);
  };
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    const state = useStore.getState();
    if (state.mode !== 'orbit' || state.placing || !e.object.visible) return;
    e.stopPropagation();
    if (surface.kind === 'floor') state.walkTo(e.point.x, e.point.z, surface.level);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const state = useStore.getState();
    if (!state.placing || state.mode !== 'orbit' || !e.object.visible) return;
    e.stopPropagation();
    const x = Math.round(e.point.x / 0.05) * 0.05, z = Math.round(e.point.z / 0.05) * 0.05;
    const g = state.ghost;
    if (surface.kind !== 'floor') {
      if (g) state.patch({ ghost: null });
    } else if (!g || g.x !== x || g.z !== z || g.level !== surface.level) {
      state.patch({ ghost: { x, z, level: surface.level } });
    }
  };

  return (
    <mesh
      ref={register}
      geometry={GEOMETRIES.get(surface.key)}
      material={material}
      visible={visible}
      castShadow={surface.kind !== 'glass' && !decal}
      receiveShadow={surface.kind !== 'glass' && !decal}
      renderOrder={decal ? 2 : 0}
      userData={{ key: surface.key, decal }}
      onClick={solid ? onClick : undefined}
      onDoubleClick={solid ? onDoubleClick : undefined}
      onPointerMove={solid && placing ? onPointerMove : undefined}
    />
  );
}

export function SelectionOutline() {
  const selected = useStore((s) => s.selected);
  const points = useMemo(() => {
    const geometry = selected ? GEOMETRIES.get(selected) : undefined;
    if (!geometry) return null;
    const edges = new THREE.EdgesGeometry(geometry, 20);
    const array = edges.getAttribute('position').array;
    edges.dispose();
    const out: [number, number, number][] = [];
    for (let i = 0; i < array.length; i += 3) out.push([array[i], array[i + 1], array[i + 2]]);
    return out.length ? out : null;
  }, [selected]);
  if (!points) return null;
  return (
    <Line
      key={selected ?? ''}
      points={points}
      segments
      color="#ffb347"
      lineWidth={2.5}
      depthTest={false}
      transparent
      opacity={0.95}
      renderOrder={30}
      toneMapped={false}
    />
  );
}

export function ApartmentModel() {
  return (
    <>
      {SURFACES.map((s) => (
        <SurfaceMesh key={s.key} surface={s} />
      ))}
    </>
  );
}

export function Ground() {
  return (
    <mesh ref={(mesh) => { mesh?.layers.enable(SOLID_LAYER); }} rotation-x={-Math.PI / 2} position={[3.6, -0.02, 7]} receiveShadow>
      <circleGeometry args={[140, 64]} />
      <meshStandardMaterial color="#8d9484" roughness={1} />
    </mesh>
  );
}
