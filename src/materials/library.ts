import * as THREE from 'three';
import { invalidate } from '@react-three/fiber';
import type { Surface, SurfaceKind } from '../model/build.ts';
import { roomById } from '../model/apartment.ts';
import { TEXTURES } from './textures';

export interface MaterialPreset {
  id: string;
  name: string;
  /** Where it is offered first; every preset can still go on any surface. */
  use: 'floor' | 'wall' | 'both';
  /** Flat swatch colour, also the default tint for untextured presets. */
  color: string;
  roughness: number;
  bumpScale?: number;
  /** Texture key in TEXTURES, or a custom image URL. */
  texture?: string;
  imageUrl?: string;
  size?: [number, number];
}

export const PRESETS: MaterialPreset[] = [
  { id: 'paint', name: 'Paint', use: 'wall', color: '#ebe7df', roughness: 0.93 },
  { id: 'plaster', name: 'Fine plaster', use: 'wall', color: '#f0eee9', roughness: 0.96, bumpScale: 1.2, texture: 'plaster' },
  { id: 'concrete', name: 'Raw concrete', use: 'both', color: '#a3a29e', roughness: 0.86, bumpScale: 1.5, texture: 'concrete' },
  { id: 'brick-red', name: 'Red brick', use: 'wall', color: '#9e543e', roughness: 0.92, bumpScale: 5, texture: 'brick-red' },
  { id: 'brick-white', name: 'White brick', use: 'wall', color: '#ece9e2', roughness: 0.9, bumpScale: 5, texture: 'brick-white' },
  { id: 'subway', name: 'Subway tile', use: 'wall', color: '#f7f7f3', roughness: 0.16, bumpScale: 2, texture: 'subway' },
  { id: 'tile-beige', name: 'Beige stone', use: 'both', color: '#dbd0be', roughness: 0.34, bumpScale: 1.5, texture: 'tile-beige' },
  { id: 'slats', name: 'Oak slat panel', use: 'wall', color: '#ba8e60', roughness: 0.62, bumpScale: 8, texture: 'slats' },
  { id: 'pinstripe', name: 'Pinstripe paper', use: 'wall', color: '#f1ede4', roughness: 0.9, texture: 'pinstripe' },
  { id: 'oak', name: 'Oak planks', use: 'floor', color: '#be9464', roughness: 0.52, bumpScale: 1, texture: 'oak' },
  { id: 'walnut', name: 'Walnut planks', use: 'floor', color: '#684832', roughness: 0.48, bumpScale: 1, texture: 'walnut' },
  { id: 'ash', name: 'Whitewashed ash', use: 'floor', color: '#ded0ba', roughness: 0.58, bumpScale: 1, texture: 'ash' },
  { id: 'parquet', name: 'Basket parquet', use: 'floor', color: '#b08354', roughness: 0.5, bumpScale: 1, texture: 'parquet' },
  { id: 'tile-grey', name: 'Grey porcelain', use: 'floor', color: '#9e9f9c', roughness: 0.38, bumpScale: 1.5, texture: 'tile-grey' },
  { id: 'marble', name: 'White marble', use: 'both', color: '#efede8', roughness: 0.14, bumpScale: 1, texture: 'marble' },
  { id: 'checker', name: 'Checker tile', use: 'floor', color: '#8a8a88', roughness: 0.22, bumpScale: 1.5, texture: 'checker' },
  { id: 'terrazzo', name: 'Terrazzo', use: 'floor', color: '#d6d1c6', roughness: 0.3, texture: 'terrazzo' },
  { id: 'carpet', name: 'Wool carpet', use: 'floor', color: '#bcb09e', roughness: 1, bumpScale: 2.5, texture: 'carpet' },
  { id: 'decking', name: 'Timber decking', use: 'floor', color: '#84684f', roughness: 0.82, bumpScale: 4, texture: 'decking' },
];

/** What a surface is finished with. */
export interface Assignment {
  preset: string;
  /** Multiplies the texture (or is the colour itself for plain paint). */
  tint?: string;
  /** Pattern size multiplier. */
  scale?: number;
  /** Turn the pattern a quarter turn — e.g. to run planks the other way. */
  rot?: boolean;
}

const customPresets = new Map<string, MaterialPreset>();

export function registerCustomPreset(preset: MaterialPreset): void {
  customPresets.set(preset.id, preset);
}

export function presetById(id: string): MaterialPreset {
  return PRESETS.find((p) => p.id === id) ?? customPresets.get(id) ?? PRESETS[0];
}

// ───────────── Textures ─────────────

interface BaseTextures {
  map: THREE.Texture | null;
  bump: THREE.Texture | null;
  size: [number, number];
  thumb: string;
}

const baseCache = new Map<string, BaseTextures>();
const loader = new THREE.TextureLoader();

function prepare(tex: THREE.Texture, color: boolean): THREE.Texture {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function thumbnail(source: HTMLCanvasElement): string {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const side = Math.min(source.width, source.height) / 2;
  c.getContext('2d')!.drawImage(source, 0, 0, side, side, 0, 0, 96, 96);
  return c.toDataURL('image/jpeg', 0.8);
}

function baseTextures(preset: MaterialPreset): BaseTextures {
  let base = baseCache.get(preset.id);
  if (base) return base;
  if (preset.imageUrl) {
    // The image arrives later; the overview draws on demand, so ask for a frame when it does.
    base = { map: prepare(loader.load(preset.imageUrl, () => invalidate()), true), bump: null, size: preset.size ?? [1, 1], thumb: preset.imageUrl };
  } else if (preset.texture && TEXTURES[preset.texture]) {
    const spec = TEXTURES[preset.texture];
    const canvases = spec.draw();
    base = {
      map: prepare(new THREE.CanvasTexture(canvases.color), true),
      bump: canvases.bump ? prepare(new THREE.CanvasTexture(canvases.bump), false) : null,
      size: spec.size,
      thumb: thumbnail(canvases.color),
    };
  } else {
    base = { map: null, bump: null, size: [1, 1], thumb: '' };
  }
  baseCache.set(preset.id, base);
  return base;
}

/** Small preview image for a preset; empty for plain colours. */
export function presetThumbnail(id: string): string {
  return baseTextures(presetById(id)).thumb;
}

// ───────────── Materials ─────────────

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export function materialFor(a: Assignment): THREE.MeshStandardMaterial {
  const key = `${a.preset}|${a.tint ?? ''}|${a.scale ?? 1}|${a.rot ? 1 : 0}`;
  let material = materialCache.get(key);
  if (material) return material;

  const preset = presetById(a.preset);
  const base = baseTextures(preset);
  const scale = a.scale ?? 1;
  const place = (tex: THREE.Texture | null) => {
    if (!tex) return null;
    const t = tex.clone();
    t.repeat.set(1 / (base.size[0] * scale), 1 / (base.size[1] * scale));
    t.rotation = a.rot ? Math.PI / 2 : 0;
    t.needsUpdate = true;
    return t;
  };
  material = new THREE.MeshStandardMaterial({
    color: a.tint ?? (base.map ? '#ffffff' : preset.color),
    map: place(base.map),
    bumpMap: place(base.bump),
    bumpScale: preset.bumpScale ?? 1,
    roughness: preset.roughness,
    metalness: 0,
  });
  materialCache.set(key, material);
  return material;
}

const fixed = (params: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.9, ...params });

/** Black, with the darkness carried in each vertex's alpha: used for baked corner shading and furniture grounding. */
export const SHADE_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#000000', vertexColors: true, transparent: true, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

/** Materials for the parts of the model the user does not restyle. */
export const FIXED_MATERIALS: Partial<Record<SurfaceKind, THREE.Material>> = {
  shade: SHADE_MATERIAL,
  shadeCeiling: SHADE_MATERIAL,
  cut: fixed({ color: '#2b2d31', roughness: 1 }),
  trim: fixed({ color: '#f2efe9' }),
  threshold: fixed({ color: '#5d4a38', roughness: 0.6 }),
  frame: fixed({ color: '#33363b', roughness: 0.55 }),
  doorFrame: fixed({ color: '#f4f2ed', roughness: 0.6 }),
  door: fixed({ color: '#3a3e44', roughness: 0.5 }),
  rail: fixed({ color: '#2e3033', roughness: 0.4, metalness: 0.7 }),
  slab: fixed({ color: '#dddad4' }),
  stairBody: fixed({ color: '#eeebe5' }),
  context: fixed({ color: '#8e9195', roughness: 1 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#d5e6ea', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false,
    envMapIntensity: 1.4, side: THREE.DoubleSide,
  }),
};

// ───────────── Defaults ─────────────

/** The finish each surface starts with — a plausible developer-standard fit-out. */
export function defaultAssignment(s: Surface): Assignment {
  const room = s.roomId ? roomById(s.roomId) : undefined;
  const type = room?.type;
  switch (s.kind) {
    case 'floor':
      if (type === 'balcony') return { preset: 'decking' };
      if (type === 'bath') return { preset: 'tile-grey', scale: 0.5 };
      if (type === 'utility') return { preset: 'tile-grey', scale: 0.5 };
      if (room?.level === 0) return { preset: 'tile-grey' };
      if (type === 'hall' && room?.level === 1) return { preset: 'tile-grey' };
      return { preset: 'oak' };
    case 'wall':
      if (s.roomId === 'lazienka') return { preset: 'tile-beige' };
      if (s.roomId === 'lazienka-2' || s.roomId === 'wc') return { preset: 'subway' };
      return { preset: 'paint' };
    case 'tread':
      return { preset: 'oak', rot: true };
    case 'facade':
      return { preset: 'plaster', tint: '#e4e0d6' };
    default:
      return { preset: 'paint', tint: '#f1eee8' };
  }
}
