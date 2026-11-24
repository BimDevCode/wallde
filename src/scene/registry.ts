import type * as THREE from 'three';

/**
 * Live three.js objects that non-React code needs to reach: the walk-mode
 * raycaster picks against them, the exporter serialises the root group.
 */
export const sceneRegistry = {
  /** Building surfaces by surface key. */
  meshes: new Map<string, THREE.Mesh>(),
  /** Placed lamps and furniture; each carries `userData.pick`. */
  objects: new Map<string, THREE.Object3D>(),
  /** Everything that belongs to the flat: building, furniture, light fittings. */
  root: null as THREE.Group | null,
  /** The pass that draws the scene; its depth pre-pass can be forced on or off to measure what it saves. */
  scenePass: null as { prePass: boolean | null } | null,
  /** The ambient-occlusion pass, for diagnostics. */
  ao: null as unknown,
  /** Overview camera pose, kept so leaving walk mode returns to the same view. */
  orbit: null as { position: THREE.Vector3; target: THREE.Vector3 } | null,
};

if (import.meta.env.DEV) (window as unknown as { __scene: typeof sceneRegistry }).__scene = sceneRegistry;
