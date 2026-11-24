import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildSurfaces, type Surface } from '../model/build.ts';
import { LEVELS, ROOMS, groupOf, polygonCentroid, roomAt, roomById } from '../model/apartment.ts';
import { furnitureDef, lampDef, sampleFurniture, sampleLamps } from '../model/furniture.ts';
import type { FurnitureItem, Lamp, LampKind, Product, Room } from '../model/types.ts';
import { defaultAssignment, registerCustomPreset, type Assignment, type MaterialPreset } from '../materials/library';
import { QUALITY, type QualityId } from '../scene/quality';

// ───────────── Static scene description ─────────────

export const SURFACES: Surface[] = buildSurfaces();
export const SURFACE_BY_KEY = new Map(SURFACES.map((s) => [s.key, s]));

/** Area of every surface in m², for quantities in the shopping list. */
export const SURFACE_AREA = new Map(
  SURFACES.map((s) => {
    const { positions: p, indices } = s.mesh;
    let area = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    return [s.key, area] as const;
  }),
);

export const WARM = '#ffd9a8';
export const NEUTRAL = '#fff0dc';
export const COOL = '#eaf2ff';

/** Rooms with a window: by day their lamps are off, the way you would find the flat. */
export const hasDaylight = (room: Room | undefined): boolean => room?.type === 'living' || room?.type === 'bedroom';

/** The room a lamp or piece of furniture stands in. */
export const roomOf = (o: { level: number; x: number; z: number }): Room | undefined => roomAt(o.level, o.x, o.z);
/** Rooms that share a switch (a room and its stair) count as one. */
export const groupAt = (o: { level: number; x: number; z: number }): string | null => {
  const room = roomOf(o);
  return room ? groupOf(room) : null;
};

/** The fittings a newly finished flat comes with: one ceiling light per room. */
function defaultLamps(): Lamp[] {
  const byType: Record<string, number> = { living: 9, bedroom: 8, bath: 5, hall: 5, utility: 4, stairs: 6, balcony: 4 };
  return ROOMS.flatMap((room) =>
    (room.lights ?? []).map(([x, z], i): Lamp => ({
      id: `${room.id}-${i}`, kind: 'ceiling', level: room.level, x, z,
      on: !hasDaylight(roomById(groupOf(room)) ?? room),
      intensity: byType[room.type] ?? 6,
      color: room.type === 'bath' ? NEUTRAL : WARM,
    })),
  );
}

function defaultAssignments(): Record<string, Assignment> {
  return Object.fromEntries(SURFACES.filter((s) => s.selectable).map((s) => [s.key, defaultAssignment(s)]));
}

// ───────────── Store ─────────────

export type Mode = 'orbit' | 'walk';

export interface Player {
  x: number;
  y: number;
  z: number;
  yaw: number;
  level: number;
  roomId: string | null;
}

/** A lamp or piece of furniture the user has selected. */
export interface Picked {
  type: 'lamp' | 'furniture';
  id: string;
}

/** Something waiting for a click on a floor to be put down. */
export type Placing =
  | { type: 'lamp'; kind: LampKind }
  | { type: 'furniture'; kind: string; product?: Product };

/** Plenty for a flat; each one costs shader work on every pixel. */
export const MAX_LAMPS = 36;

interface AppState {
  mode: Mode;
  /** Highest storey drawn in the overview; 3 also shows the roof. */
  visibleLevel: number;
  selected: string | null;
  assignments: Record<string, Assignment>;
  lamps: Lamp[];
  furniture: FurnitureItem[];
  products: Product[];
  sun: { on: boolean; hour: number; intensity: number };
  ambient: number;
  exposure: number;
  ao: boolean;
  shadows: boolean;
  context: boolean;
  quality: QualityId;
  /** Lower the resolution automatically when the frame rate drops. */
  autoResolution: boolean;
  customPresets: MaterialPreset[];
  panelOpen: boolean;

  // Transient
  locked: boolean;
  player: Player;
  teleport: { x: number; z: number; level: number; id: number; yaw?: number; pitch?: number } | null;
  focus: { x: number; y: number; z: number; id: number } | null;
  picked: Picked | null;
  placing: Placing | null;
  /** Where the item being placed would land. */
  ghost: { x: number; z: number; level: number } | null;
  /** Bumped whenever lamps or furniture change, so shadows know to refresh. */
  rev: number;
  /** Resolution scale in use right now, and the frame rate last measured while moving. */
  dpr: number;
  fps: number | null;

  setMode: (mode: Mode) => void;
  setVisibleLevel: (level: number) => void;
  select: (key: string | null) => void;
  assign: (keys: string[], patch: Partial<Assignment>) => void;
  resetMaterials: () => void;
  setSun: (patch: Partial<AppState['sun']>) => void;
  patch: (patch: Partial<Pick<AppState, 'ambient' | 'exposure' | 'ao' | 'shadows' | 'context' | 'panelOpen' | 'locked' | 'ghost' | 'autoResolution' | 'dpr' | 'fps'>>) => void;
  setQuality: (quality: QualityId) => void;
  setPlayer: (player: Player) => void;
  goToRoom: (roomId: string) => void;
  walkTo: (x: number, z: number, level: number) => void;
  addCustomPreset: (preset: MaterialPreset) => void;

  // Lamps
  updateLamp: (id: string, patch: Partial<Lamp>) => void;
  removeLamp: (id: string) => void;
  setAllLamps: (on: boolean) => void;
  /** Switches every lamp in a room group; with no value, toggles them. */
  switchRoom: (group: string, on?: boolean) => void;
  /** Sun position plus which lamps are on: 'day' leaves only windowless rooms lit. */
  setScene: (hour: number, lamps: 'day' | 'all') => void;
  resetLamps: () => void;

  // Furniture
  updateFurniture: (id: string, patch: Partial<FurnitureItem>) => void;
  removeFurniture: (id: string) => void;
  duplicateFurniture: (id: string) => void;
  furnishSample: () => void;
  clearFurniture: () => void;

  // Placing and picking
  pick: (picked: Picked | null) => void;
  /** In the overview this arms a click on a floor; in walk mode the item lands in front of you. */
  startPlacing: (placing: Placing | null) => void;
  placeAt: (x: number, z: number, level: number, rot?: number) => void;
  removePicked: () => void;
  setProducts: (products: Product[]) => void;
}

/** Resolution to begin at: the screen's own density, limited by the preset. */
function startDpr(quality: QualityId): number {
  const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(device, QUALITY[quality].dprCap);
}

let requestId = 0;
let serial = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(serial++).toString(36)}`;
const snap = (v: number, step = 0.05) => Math.round(v / step) * step;

/** A point safely inside a room: its light fitting if it has one, else the centroid. */
export function roomAnchor(room: Room): [number, number] {
  return room.lights?.[0] ? [room.lights[0][0], room.lights[0][1]] : polygonCentroid(room.polygon);
}

const START_ROOM = roomById('salon')!;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'orbit',
      visibleLevel: 2,
      selected: null,
      assignments: defaultAssignments(),
      lamps: defaultLamps(),
      furniture: [],
      products: [],
      sun: { on: true, hour: 14.5, intensity: 3.4 },
      ambient: 0.55,
      exposure: 1,
      ao: false,
      shadows: true,
      context: true,
      quality: 'balanced',
      autoResolution: true,
      customPresets: [],
      panelOpen: true,

      locked: false,
      player: { x: 4.6, y: LEVELS[1].elevation, z: 12.3, yaw: 0.96, level: 1, roomId: START_ROOM.id },
      teleport: null,
      focus: null,
      picked: null,
      placing: null,
      ghost: null,
      rev: 0,
      dpr: startDpr('balanced'),
      fps: null,

      setMode: (mode) => set({ mode, locked: false, placing: null, ghost: null }),
      setVisibleLevel: (visibleLevel) => set({ visibleLevel }),
      select: (selected) => set(selected ? { selected, picked: null } : { selected }),
      assign: (keys, patch) =>
        set((s) => {
          const assignments = { ...s.assignments };
          for (const key of keys) {
            const current = assignments[key];
            if (!current) continue;
            // A different material starts from its own colour, not the previous tint.
            const next = patch.preset && patch.preset !== current.preset
              ? { rot: current.rot, ...patch, preset: patch.preset }
              : { ...current, ...patch };
            assignments[key] = next;
          }
          return { assignments };
        }),
      resetMaterials: () => set({ assignments: defaultAssignments() }),
      setSun: (patch) => set((s) => ({ sun: { ...s.sun, ...patch } })),
      patch: (patch) => set(patch),
      // Screen-space ambient occlusion is the costliest effect, so only 'High' turns it on.
      setQuality: (quality) => set({ quality, ao: quality === 'high', dpr: startDpr(quality), fps: null }),
      setPlayer: (player) => set({ player }),
      goToRoom: (roomId) => {
        const room = roomById(roomId);
        if (!room) return;
        const [x, z] = roomAnchor(room);
        const y = LEVELS[room.level].elevation;
        if (get().mode === 'walk') {
          set({ teleport: { x, z, level: room.level, id: ++requestId } });
        } else {
          set((s) => ({
            visibleLevel: s.visibleLevel >= 3 || s.visibleLevel < room.level ? room.level : s.visibleLevel,
            focus: { x, y: y + 1, z, id: ++requestId },
          }));
        }
      },
      walkTo: (x, z, level) =>
        set({ mode: 'walk', locked: false, placing: null, ghost: null, teleport: { x, z, level, id: ++requestId } }),
      addCustomPreset: (preset) => {
        registerCustomPreset(preset);
        set((s) => ({ customPresets: [...s.customPresets, preset] }));
      },

      updateLamp: (id, patch) =>
        set((s) => ({ lamps: s.lamps.map((l) => (l.id === id ? { ...l, ...patch } : l)), rev: s.rev + 1 })),
      removeLamp: (id) =>
        set((s) => ({
          lamps: s.lamps.filter((l) => l.id !== id),
          picked: s.picked?.id === id ? null : s.picked,
          rev: s.rev + 1,
        })),
      setAllLamps: (on) => set((s) => ({ lamps: s.lamps.map((l) => ({ ...l, on })) })),
      switchRoom: (group, on) =>
        set((s) => {
          const inRoom = s.lamps.filter((l) => groupAt(l) === group);
          const next = on ?? !inRoom.some((l) => l.on);
          return { lamps: s.lamps.map((l) => (inRoom.includes(l) ? { ...l, on: next } : l)) };
        }),
      setScene: (hour, lamps) =>
        set((s) => ({
          sun: { ...s.sun, hour, on: true },
          lamps: s.lamps.map((l) => {
            const room = roomOf(l);
            return { ...l, on: lamps === 'all' || !hasDaylight(room ? roomById(groupOf(room)) ?? room : undefined) };
          }),
        })),
      resetLamps: () => set((s) => ({ lamps: defaultLamps(), picked: s.picked?.type === 'lamp' ? null : s.picked, rev: s.rev + 1 })),

      updateFurniture: (id, patch) =>
        set((s) => ({ furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)), rev: s.rev + 1 })),
      removeFurniture: (id) =>
        set((s) => ({
          furniture: s.furniture.filter((f) => f.id !== id),
          picked: s.picked?.id === id ? null : s.picked,
          rev: s.rev + 1,
        })),
      duplicateFurniture: (id) =>
        set((s) => {
          const source = s.furniture.find((f) => f.id === id);
          if (!source) return {};
          const copy = { ...source, id: newId(source.kind), x: snap(source.x + 0.3), z: snap(source.z + 0.3) };
          return { furniture: [...s.furniture, copy], picked: { type: 'furniture', id: copy.id }, rev: s.rev + 1 };
        }),
      furnishSample: () =>
        set((s) => ({
          // Replaces an earlier sample but keeps anything the user placed themselves.
          furniture: [...s.furniture.filter((f) => !f.id.startsWith('sample-')), ...sampleFurniture()],
          lamps: [...s.lamps.filter((l) => !l.id.startsWith('sample-')), ...sampleLamps()].slice(0, MAX_LAMPS),
          picked: null,
          rev: s.rev + 1,
        })),
      clearFurniture: () =>
        set((s) => ({ furniture: [], picked: s.picked?.type === 'furniture' ? null : s.picked, rev: s.rev + 1 })),

      pick: (picked) => set(picked ? { picked, selected: null } : { picked }),
      startPlacing: (placing) => {
        const s = get();
        if (!placing) return set({ placing: null, ghost: null });
        if (s.mode === 'walk') {
          // No floor to click while walking: put it down a step and a half ahead, facing you.
          const { x, z, yaw, level } = s.player;
          set({ placing });
          get().placeAt(x - Math.sin(yaw) * 1.6, z - Math.cos(yaw) * 1.6, level, snap((yaw * 180) / Math.PI, 15));
        } else {
          set({ placing, ghost: null, picked: null, selected: null });
        }
      },
      placeAt: (px, pz, level, rot = 0) =>
        set((s) => {
          const p = s.placing;
          if (!p) return {};
          const x = snap(px), z = snap(pz);
          if (p.type === 'lamp') {
            if (s.lamps.length >= MAX_LAMPS) return { placing: null, ghost: null };
            const def = lampDef(p.kind);
            const lamp: Lamp = {
              id: newId(p.kind), kind: p.kind, level, x, z, on: true, intensity: def.intensity, color: WARM,
              drop: def.drop, angle: def.angle,
            };
            return { lamps: [...s.lamps, lamp], picked: { type: 'lamp', id: lamp.id }, selected: null, placing: null, ghost: null, rev: s.rev + 1 };
          }
          const def = furnitureDef(p.kind);
          const item: FurnitureItem = {
            id: newId(def.kind), kind: def.kind, level, x, z, rot,
            w: p.product?.w ?? def.size[0], d: p.product?.d ?? def.size[1], h: p.product?.h ?? def.size[2],
            color: def.color,
            ...(p.product
              ? { name: p.product.name, product: { name: p.product.name, url: p.product.url, price: p.product.price } }
              : {}),
          };
          return { furniture: [...s.furniture, item], picked: { type: 'furniture', id: item.id }, selected: null, placing: null, ghost: null, rev: s.rev + 1 };
        }),
      removePicked: () => {
        const p = get().picked;
        if (p?.type === 'lamp') get().removeLamp(p.id);
        else if (p) get().removeFurniture(p.id);
      },
      setProducts: (products) => set({ products }),
    }),
    {
      name: 'botanika-5m2',
      version: 5,
      // Version 4 predates the render presets: keep everything the user arranged, adopt the new
      // default rendering. Anything older is dropped rather than half-applied.
      migrate: (saved, version) => (version === 4 ? { ...(saved as object), ao: false, quality: 'balanced' } : {}),
      partialize: (s) => ({
        assignments: s.assignments, lamps: s.lamps, furniture: s.furniture, products: s.products, sun: s.sun,
        ambient: s.ambient, exposure: s.exposure, ao: s.ao, shadows: s.shadows, context: s.context,
        quality: s.quality, autoResolution: s.autoResolution,
      }),
      // Saved finishes only apply to surfaces that still exist; new surfaces get defaults.
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<AppState>;
        const assignments = { ...current.assignments };
        for (const [key, value] of Object.entries(p.assignments ?? {})) if (key in assignments) assignments[key] = value;
        const quality = p.quality && p.quality in QUALITY ? p.quality : current.quality;
        return { ...current, ...p, assignments, quality, dpr: startDpr(quality) };
      },
    },
  ),
);

/** Which surfaces a material change should reach, relative to the selected one. */
export type Scope = 'surface' | 'room' | 'level' | 'all';

export function keysInScope(key: string, scope: Scope): string[] {
  const s = SURFACE_BY_KEY.get(key);
  if (!s) return [];
  if (scope === 'surface') return [key];
  return SURFACES.filter((o) => {
    if (!o.selectable || o.kind !== s.kind) return false;
    if (scope === 'room') return o.group !== undefined && o.group === s.group;
    if (scope === 'level') return o.level === s.level;
    return true;
  }).map((o) => o.key);
}

// Handy when poking at the scene from the browser console during development.
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;
