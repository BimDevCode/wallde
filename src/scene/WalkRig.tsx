import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { LEVELS, groupOf, roomById } from '../model/apartment.ts';
import { EYE_HEIGHT, groundAt, levelAt, resolveCollisions, roomAtHeight } from '../model/walk.ts';
import { PRESETS } from '../materials/library';
import { SURFACE_BY_KEY, useStore } from '../state/store';
import { sceneRegistry } from './registry';

const WALK_SPEED = 2.3;
const RUN_SPEED = 4.4;
const LOOK_SPEED = 0.0023;
const raycaster = new THREE.Raycaster();

/** Selects whatever lies under a point of the view (0,0 = screen centre): furniture, a lamp or a surface. */
function pick(camera: THREE.Camera, ndcX: number, ndcY: number): void {
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const surfaces = [...sceneRegistry.meshes.values()].filter((m) => {
    const kind = SURFACE_BY_KEY.get(m.userData.key)?.kind;
    return m.visible && kind !== 'glass' && kind !== 'context' && !m.userData.decal;
  });
  const hit = raycaster.intersectObjects([...surfaces, ...sceneRegistry.objects.values()], true)[0];
  // A hit lands on a part; the thing it belongs to is the first ancestor that says what it is.
  let owner: THREE.Object3D | null = hit?.object ?? null;
  while (owner && !owner.userData.pick && !owner.userData.key) owner = owner.parent;
  const state = useStore.getState();
  if (owner?.userData.pick) {
    state.pick(owner.userData.pick);
    return;
  }
  const surface = owner ? SURFACE_BY_KEY.get(owner.userData.key) : undefined;
  state.pick(null);
  state.select(surface?.selectable ? surface.key : null);
}

/** Q / E step the selected surface through the material list without leaving the view. */
function cycleMaterial(step: number): void {
  const { selected, assignments, assign } = useStore.getState();
  if (!selected || !assignments[selected]) return;
  const i = PRESETS.findIndex((p) => p.id === assignments[selected].preset);
  assign([selected], { preset: PRESETS[(i + step + PRESETS.length) % PRESETS.length].id });
}

function toggleRoomLight(): void {
  const { player, switchRoom } = useStore.getState();
  const room = player.roomId ? roomById(player.roomId) : undefined;
  if (room) switchRoom(groupOf(room));
}

export function WalkRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const teleport = useStore((s) => s.teleport);
  const st = useRef({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0, keys: new Set<string>(), sync: 0, room: '' });

  // Stand where the store says; restore the overview lens on the way out.
  useEffect(() => {
    const p = useStore.getState().player;
    Object.assign(st.current, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: -0.04, vy: 0 });
    const lens = { fov: camera.fov, near: camera.near };
    camera.fov = 74;
    camera.near = 0.04;
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = lens.fov;
      camera.near = lens.near;
      camera.updateProjectionMatrix();
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
    };
  }, [camera, gl]);

  useEffect(() => {
    if (!teleport) return;
    Object.assign(st.current, { x: teleport.x, z: teleport.z, y: LEVELS[teleport.level].elevation, vy: 0 });
    if (teleport.yaw !== undefined) st.current.yaw = teleport.yaw;
    if (teleport.pitch !== undefined) st.current.pitch = teleport.pitch;
  }, [teleport]);

  useEffect(() => {
    const el = gl.domElement;
    const s = st.current;
    let press: { x: number; y: number; moved: boolean } | null = null;
    let lockRefused = false;
    const locked = () => document.pointerLockElement === el;
    const inUi = (e: Event) => e.target instanceof HTMLElement && e.target.closest('[data-ui]') !== null;

    const look = (dx: number, dy: number) => {
      s.yaw -= dx * LOOK_SPEED;
      s.pitch = THREE.MathUtils.clamp(s.pitch - dy * LOOK_SPEED, -1.45, 1.45);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (inUi(e) || e.metaKey || e.ctrlKey) return;
      s.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyQ') cycleMaterial(-1);
      else if (e.code === 'KeyE') cycleMaterial(1);
      else if (e.code === 'KeyL') toggleRoomLight();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => s.keys.delete(e.code);
    const onBlur = () => s.keys.clear();
    const onMouseMove = (e: MouseEvent) => {
      if (locked()) {
        look(e.movementX, e.movementY);
      } else if (press) {
        // No pointer lock (refused, or not offered here): drag to look instead.
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4) press.moved = true;
        if (press.moved) look(-e.movementX * 1.6, -e.movementY * 1.6);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) press = { x: e.clientX, y: e.clientY, moved: false };
    };
    const onPointerUp = (e: PointerEvent) => {
      const p = press;
      press = null;
      if (!p || p.moved || e.button !== 0) return;
      if (locked()) {
        pick(camera, 0, 0);
      } else if (lockRefused || e.shiftKey) {
        const r = el.getBoundingClientRect();
        pick(camera, ((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      } else {
        try {
          const request = el.requestPointerLock() as unknown as Promise<void> | undefined;
          request?.catch?.(() => { lockRefused = true; });
        } catch {
          lockRefused = true;
        }
      }
    };
    const onLockChange = () => {
      useStore.getState().patch({ locked: locked() });
      if (!locked()) s.keys.clear();
    };
    const onLockError = () => { lockRefused = true; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const s = st.current;
    const dt = Math.min(delta, 0.05);
    const k = s.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (k.has('ArrowLeft')) s.yaw += 1.9 * dt;
    if (k.has('ArrowRight')) s.yaw -= 1.9 * dt;

    if (fwd || side) {
      const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED) / Math.hypot(fwd, side);
      const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
      const vx = (-sin * fwd + cos * side) * speed;
      const vz = (-cos * fwd - sin * side) * speed;
      // Small sub-steps so a fast frame can never carry you through a thin partition.
      const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.05));
      for (let i = 0; i < steps; i++) {
        [s.x, s.z] = resolveCollisions(s.x + (vx * dt) / steps, s.z + (vz * dt) / steps, s.y);
      }
    }

    const ground = groundAt(s.x, s.z, s.y);
    if (s.y - ground > 0.35) {
      s.vy -= 14 * dt;
      s.y = Math.max(ground, s.y + s.vy * dt);
    } else {
      // Steps and stair treads: glide to the new height rather than snapping.
      s.y += (ground - s.y) * Math.min(1, dt * 16);
      s.vy = 0;
    }

    camera.position.set(s.x, s.y + EYE_HEIGHT, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');

    // The UI (minimap, room label, lights) only needs a few updates a second.
    s.sync += dt;
    const room = roomAtHeight(s.x, s.z, s.y)?.id ?? '';
    if (s.sync > 0.1 || room !== s.room) {
      s.sync = 0;
      s.room = room;
      useStore.getState().setPlayer({ x: s.x, y: s.y, z: s.z, yaw: s.yaw, level: levelAt(s.y), roomId: room || null });
    }
  });

  return null;
}
