/**
 * Plan data model. Everything is in metres.
 * Plan axes: X = east, Z = south (north is -Z), Y = up — the same axes three.js uses,
 * so the plan drawn north-up maps straight onto the scene seen from above.
 */

export type Vec2 = readonly [number, number];

export interface Level {
  index: number;
  id: string;
  name: string;
  /** Finished floor level above the ground floor. */
  elevation: number;
}

export type OpeningKind = 'door' | 'entrance' | 'window' | 'balconyDoor';

export interface Opening {
  id: string;
  kind: OpeningKind;
  /** Start / end along the wall's long axis, as world X or Z coordinates. */
  from: number;
  to: number;
  /** Heights above the level's floor. */
  sill: number;
  head: number;
}

export interface Wall {
  id: string;
  level: number;
  /** Footprint as [x0, z0, x1, z1]; walls are axis-aligned boxes. */
  rect: readonly [number, number, number, number];
  exterior?: boolean;
  /** Installation shaft / chimney rather than a wall. */
  shaft?: boolean;
  /** Height above the level's floor. Defaults to the clear storey height. */
  height?: number;
  openings?: Opening[];
}

export type RoomType = 'living' | 'bedroom' | 'bath' | 'hall' | 'utility' | 'stairs' | 'balcony';

export interface Room {
  id: string;
  level: number;
  name: string;
  type: RoomType;
  /** Rooms sharing a group share lights (e.g. stairwell split across two levels). */
  group?: string;
  /** Net area printed in the developer's brochure, m². */
  area?: number;
  /** Clear interior outline. */
  polygon: Vec2[];
  /** False where a stair or void replaces the floor / ceiling. */
  floor?: boolean;
  ceiling?: boolean;
  ceilingPolygon?: Vec2[];
  outdoor?: boolean;
  /** Ceiling light positions. */
  lights?: Vec2[];
}

export interface Stair {
  id: string;
  name: string;
  /** Level the flight starts on; it climbs one full storey. */
  level: number;
  x0: number;
  x1: number;
  /** Z of the first riser and of the last riser (edge of the upper floor). */
  zBottom: number;
  zTop: number;
  risers: number;
}

export interface Slab {
  id: string;
  name: string;
  /** Level the slab is drawn with. */
  level: number;
  /** Level whose rooms this slab covers, or null for a slab nothing sits under. */
  capOf: number | null;
  kind: 'base' | 'floor' | 'roof' | 'balcony';
  /** Absolute height of the top face. */
  top: number;
  thickness: number;
  outline: Vec2[];
  holes?: Vec2[][];
}

export interface Railing {
  id: string;
  level: number;
  rect: readonly [number, number, number, number];
  height: number;
}

/** Neighbouring parts of the building, shown as plain volumes for context. */
export interface ContextBox {
  rect: readonly [number, number, number, number];
  y0: number;
  y1: number;
}

// ───────────── Things the user places in the flat ─────────────

/** A shop product attached to a placed item, for the shopping list. */
export interface ProductLink {
  name?: string;
  url?: string;
  /** In złoty. */
  price?: number;
}

export type LampKind = 'ceiling' | 'pendant' | 'spot' | 'floor';

export interface Lamp {
  id: string;
  kind: LampKind;
  level: number;
  x: number;
  z: number;
  on: boolean;
  /** Candela, roughly: 8 ≈ a normal ceiling fitting. */
  intensity: number;
  color: string;
  /** Pendants: how far the shade hangs below the ceiling, in metres. */
  drop?: number;
  /** Spots: full beam angle in degrees. */
  angle?: number;
  product?: ProductLink;
}

export interface FurnitureItem {
  id: string;
  /** Key into the furniture catalogue. */
  kind: string;
  level: number;
  /** Centre of the footprint. */
  x: number;
  z: number;
  /** Degrees about the vertical axis; 0 faces south (towards +Z). */
  rot: number;
  w: number;
  d: number;
  h: number;
  color: string;
  name?: string;
  product?: ProductLink;
}

/** A row of an imported shop catalogue. Sizes are in metres once imported. */
export interface Product {
  id: string;
  name: string;
  url?: string;
  price?: number;
  w?: number;
  d?: number;
  h?: number;
  /** Catalogue model used as the 3D stand-in; a plain box if absent. */
  kind?: string;
}
