import type * as THREE from 'three';
import { sceneRegistry } from '../scene/registry';
import { useStore } from '../state/store';
import { buildIfc, IFC_FILE_NAME } from './ifc.ts';

export function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** The building model for Revit and other BIM tools, with whatever has been placed in it. */
export function downloadIfc(): void {
  const { furniture, lamps } = useStore.getState();
  save(new Blob([buildIfc({ furniture, lamps })], { type: 'application/x-step' }), IFC_FILE_NAME);
}

export function downloadText(text: string, name: string, type = 'text/csv;charset=utf-8'): void {
  save(new Blob([text], { type }), name);
}

/** The rendered scene, materials and textures included, for Blender, Unreal, web viewers… */
export async function downloadGlb(): Promise<void> {
  const group = sceneRegistry.root;
  if (!group) throw new Error('The 3D scene is not ready yet.');
  // Selection outlines are drawn inside the scene; clear them so they are not saved with it.
  useStore.getState().pick(null);
  useStore.getState().select(null);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  // Corner shading is a rendering trick of this app, not part of the model: leave it out of the file.
  const decals: [THREE.Object3D, THREE.Object3D][] = [];
  group.traverse((o) => {
    if (o.userData.decal && o.parent) decals.push([o, o.parent]);
  });
  decals.forEach(([o]) => o.removeFromParent());
  let result: ArrayBuffer | { [key: string]: unknown };
  try {
    result = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: false });
  } finally {
    decals.forEach(([o, parent]) => parent.add(o));
  }
  save(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }), 'botanika-5M2.glb');
}
