import { memo, useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVELS } from '../model/apartment.ts';
import { furnitureDef, type PartRole } from '../model/furniture.ts';
import { setObstacles } from '../model/walk.ts';
import { SHADE_MATERIAL } from '../materials/library';
import type { FurnitureItem } from '../model/types.ts';
import { useStore } from '../state/store';
import { levelShown, usePlaceable } from './placeable';
import { SOLID_LAYER } from './quality';
import { sceneRegistry } from './registry';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
const BOX_EDGES = new THREE.EdgesGeometry(BOX);
const AMBER = '#ffb347';

const FIXED: Record<Exclude<PartRole, 'main' | 'soft'>, THREE.Material> = {
  top: new THREE.MeshStandardMaterial({ color: '#cdc8bf', roughness: 0.35 }),
  wood: new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.7 }),
  metal: new THREE.MeshStandardMaterial({ color: '#8f949a', roughness: 0.35, metalness: 0.8 }),
  steel: new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.3, metalness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.4 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.6 }),
  screen: new THREE.MeshStandardMaterial({ color: '#0c0d10', roughness: 0.15 }),
  green: new THREE.MeshStandardMaterial({ color: '#4f7a4a', roughness: 0.95 }),
  mirror: new THREE.MeshStandardMaterial({ color: '#e3e9ec', roughness: 0.04, metalness: 1 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#d5e6ea', roughness: 0.04, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide,
  }),
};

/** Seen from above only, and drawn double-sided so the triangle winding does not matter. */
const GROUNDING = SHADE_MATERIAL.clone();
GROUNDING.side = THREE.DoubleSide;

const tinted = new Map<string, THREE.Material>();

function materialFor(role: PartRole, color: string): THREE.Material {
  if (role !== 'main' && role !== 'soft') return FIXED[role];
  const key = `${role}|${color}`;
  let material = tinted.get(key);
  if (!material) {
    const base = new THREE.Color(color);
    // Cushions and bedding: the same colour, a touch lighter and softer.
    material = role === 'soft'
      ? new THREE.MeshStandardMaterial({ color: base.lerp(new THREE.Color('#ffffff'), 0.2), roughness: 0.98 })
      : new THREE.MeshStandardMaterial({ color: base, roughness: 0.72 });
    tinted.set(key, material);
  }
  return material;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const LYING = new THREE.Quaternion().setFromAxisAngle(X_AXIS, Math.PI / 2);
const UPRIGHT = new THREE.Quaternion();
const shapes = new Map<string, { role: PartRole; geometry: THREE.BufferGeometry }[]>();

/**
 * One mesh per material rather than one per part: a sofa is three draw calls
 * instead of a dozen. Identical pieces (four dining chairs) share the result.
 */
function shapeOf(kind: string, w: number, d: number, h: number): { role: PartRole; geometry: THREE.BufferGeometry }[] {
  const key = `${kind}|${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}`;
  let shape = shapes.get(key);
  if (shape) return shape;

  const byRole = new Map<PartRole, THREE.BufferGeometry[]>();
  const matrix = new THREE.Matrix4();
  for (const p of furnitureDef(kind).build(w, d, h)) {
    const lying = p.shape === 'cylz';
    const part = (p.shape === 'box' ? BOX : CYLINDER).clone();
    matrix.compose(
      new THREE.Vector3(p.x, p.y, p.z),
      lying ? LYING : UPRIGHT,
      lying ? new THREE.Vector3(p.sx, p.sz, p.sy) : new THREE.Vector3(p.sx, p.sy, p.sz),
    );
    part.applyMatrix4(matrix);
    const list = byRole.get(p.role);
    if (list) list.push(part);
    else byRole.set(p.role, [part]);
  }
  shape = [...byRole].map(([role, parts]) => {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return { role, geometry };
  });
  // Dragging a size field leaves a trail of one-off shapes; start over now and then.
  if (shapes.size > 300) {
    for (const old of shapes.values()) old.forEach((o) => o.geometry.dispose());
    shapes.clear();
  }
  shapes.set(key, shape);
  return shape;
}

const solid = (mesh: THREE.Mesh | null) => {
  mesh?.layers.enable(SOLID_LAYER);
};

const Piece = memo(function Piece({ item, picked }: { item: FurnitureItem; picked: boolean }) {
  const def = furnitureDef(item.kind);
  const shape = useMemo(() => shapeOf(item.kind, item.w, item.d, item.h), [item.kind, item.w, item.d, item.h]);
  const handlers = usePlaceable({ type: 'furniture', id: item.id }, item.level, item, (x, z) =>
    useStore.getState().updateFurniture(item.id, { x, z }),
  );
  const register = useCallback(
    (group: THREE.Group | null) => {
      if (group) sceneRegistry.objects.set(`furniture:${item.id}`, group);
      else sceneRegistry.objects.delete(`furniture:${item.id}`);
    },
    [item.id],
  );

  return (
    <group
      ref={register}
      name={item.name ?? def.name}
      position={[item.x, LEVELS[item.level].elevation + (def.lift ?? 0), item.z]}
      rotation-y={THREE.MathUtils.degToRad(item.rot)}
      userData={{ pick: { type: 'furniture', id: item.id } }}
      {...handlers}
    >
      {shape.map(({ role, geometry }) => (
        <mesh
          key={role}
          ref={role === 'glass' ? undefined : solid}
          geometry={geometry}
          material={materialFor(role, item.color)}
          castShadow={role !== 'glass'}
          receiveShadow={role !== 'glass'}
        />
      ))}
      {picked && (
        <lineSegments geometry={BOX_EDGES} position-y={item.h / 2} scale={[item.w + 0.05, item.h + 0.05, item.d + 0.05]} renderOrder={30}>
          <lineBasicMaterial color={AMBER} toneMapped={false} depthTest={false} transparent />
        </lineSegments>
      )}
    </group>
  );
});

/**
 * A soft dark patch under each piece so it sits on the floor instead of
 * hovering over it — the baked counterpart of contact shadows, in one draw call.
 */
function Grounding({ items }: { items: FurnitureItem[] }) {
  const geometry = useMemo(() => {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const feather = 0.14, depth = 0.34;
    for (const f of items) {
      const def = furnitureDef(f.kind);
      if (def.lift || f.h < 0.08) continue;
      const y = LEVELS[f.level].elevation + 0.009;
      const a = THREE.MathUtils.degToRad(f.rot);
      const cos = Math.cos(a), sin = Math.sin(a);
      const base = positions.length / 3;
      // Inner ring at full darkness just inside the footprint, outer ring fading to nothing.
      for (const [grow, alpha] of [[-0.03, depth], [feather, 0]]) {
        const hw = f.w / 2 + grow, hd = f.d / 2 + grow;
        for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
          positions.push(f.x + lx * cos + lz * sin, y, f.z - lx * sin + lz * cos);
          colors.push(0, 0, 0, alpha);
        }
      }
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        indices.push(base + i, base + j, base + 4 + j, base + i, base + 4 + j, base + 4 + i);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    g.setIndex(indices);
    return g;
  }, [items]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={GROUNDING} renderOrder={3} userData={{ decal: true }} />;
}

export function Furnishings() {
  const furniture = useStore((s) => s.furniture);
  const mode = useStore((s) => s.mode);
  const top = useStore((s) => s.visibleLevel);
  const ao = useStore((s) => s.ao);
  const shown = useMemo(() => furniture.filter((f) => levelShown(f.level, mode, top)), [furniture, mode, top]);
  const pickedId = useStore((s) => (s.picked?.type === 'furniture' ? s.picked.id : null));

  // Furniture is solid when you walk: keep the collision boxes in step with it.
  useEffect(() => {
    setObstacles(
      furniture.map((f) => {
        const a = THREE.MathUtils.degToRad(f.rot);
        const y0 = LEVELS[f.level].elevation + (furnitureDef(f.kind).lift ?? 0);
        return { x: f.x, z: f.z, hw: f.w / 2, hd: f.d / 2, cos: Math.cos(a), sin: Math.sin(a), y0, y1: y0 + f.h };
      }),
    );
  }, [furniture]);

  return (
    <>
      {shown.map((f) => (
        <Piece key={f.id} item={f} picked={f.id === pickedId} />
      ))}
      {!ao && <Grounding items={shown} />}
    </>
  );
}

/** Translucent stand-in that follows the pointer while something waits to be placed. */
export function Ghost() {
  const placing = useStore((s) => s.placing);
  const ghost = useStore((s) => s.ghost);
  if (!placing || !ghost) return null;
  const floor = LEVELS[ghost.level].elevation;
  const material = <meshBasicMaterial color={AMBER} transparent opacity={0.35} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />;
  if (placing.type === 'lamp') {
    return (
      <mesh rotation-x={-Math.PI / 2} position={[ghost.x, floor + 0.02, ghost.z]}>
        <ringGeometry args={[0.14, 0.26, 36]} />
        {material}
      </mesh>
    );
  }
  const def = furnitureDef(placing.kind);
  const w = placing.product?.w ?? def.size[0], d = placing.product?.d ?? def.size[1], h = placing.product?.h ?? def.size[2];
  return (
    <mesh geometry={BOX} position={[ghost.x, floor + (def.lift ?? 0) + h / 2, ghost.z]} scale={[w, h, d]}>
      {material}
    </mesh>
  );
}
