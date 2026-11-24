/**
 * Botanika (osiedle Niezapominajek) — apartment 5M2, traced from the developer's plan.
 *
 * Dimensions were measured off the brochure drawing using its 0–5 m scale bar
 * (54 px per metre), so they are accurate to a few centimetres, not survey grade.
 * Room areas computed from these outlines, less the shafts, land within ~3 % of
 * the brochure table.
 *
 * Origin: north-west outer corner of the top floor. X = east, Z = south.
 */
import type { ContextBox, Level, Opening, Railing, Room, Slab, Stair, Wall } from './types.ts';

export const PROJECT = {
  name: 'Botanika 5M2',
  estate: 'Botanika — osiedle Niezapominajek',
  totalArea: 109.94,
};

/** Storey heights are not on the plan; these are typical values for this building type. */
export const F2F = 2.9;
export const SLAB = 0.25;
export const CLEAR = F2F - SLAB;

export const LEVELS: Level[] = [
  { index: 0, id: 'parter', name: 'Parter', elevation: 0 },
  { index: 1, id: 'pietro-1', name: '1 piętro', elevation: F2F },
  { index: 2, id: 'pietro-2', name: '2 piętro', elevation: 2 * F2F },
];

const win = (id: string, from: number, to: number): Opening => ({ id, kind: 'window', from, to, sill: 0.85, head: 2.35 });
const balcony = (id: string, from: number, to: number): Opening => ({ id, kind: 'balconyDoor', from, to, sill: 0, head: 2.35 });
const door = (id: string, from: number, to: number): Opening => ({ id, kind: 'door', from, to, sill: 0, head: 2.05 });

export const WALLS: Wall[] = [
  // ───────────── Parter: entrance vestibule and the stair up ─────────────
  {
    id: '0-vest-n', level: 0, exterior: true, rect: [5.22, 1.04, 7.31, 1.22],
    openings: [{ id: 'entrance', kind: 'entrance', from: 6.07, to: 7.07, sill: 0, head: 2.1 }],
  },
  { id: '0-vest-w', level: 0, exterior: true, rect: [5.22, 1.22, 5.4, 2.34] },
  { id: '0-vest-s', level: 0, exterior: true, rect: [5.22, 2.34, 5.83, 2.52] },
  { id: '0-east-vest', level: 0, exterior: true, rect: [7.11, 1.22, 7.31, 2.34] },
  { id: '0-east-stair', level: 0, exterior: true, rect: [7.11, 2.34, 7.31, 6.64], height: F2F },
  { id: '0-stair-w', level: 0, exterior: true, rect: [5.83, 2.34, 6.03, 6.64], height: F2F },
  { id: '0-stair-s', level: 0, exterior: true, rect: [6.03, 6.46, 7.11, 6.64] },

  // ───────────── 1 piętro: hall, WC, living room with kitchenette ─────────────
  { id: '1-west', level: 1, exterior: true, rect: [0, 7.57, 0.18, 11.88] },
  { id: '1-north', level: 1, exterior: true, rect: [0, 7.39, 3.33, 7.57] },
  { id: '1-wc-w', level: 1, exterior: true, rect: [3.33, 6.46, 3.53, 8.48] },
  { id: '1-hall-n', level: 1, exterior: true, rect: [3.53, 6.46, 5.83, 6.64] },
  { id: '1-tower-w', level: 1, exterior: true, rect: [5.83, 2.17, 6.03, 6.64] },
  { id: '1-tower-n', level: 1, exterior: true, rect: [6.03, 2.17, 7.31, 2.34] },
  { id: '1-east', level: 1, exterior: true, rect: [7.11, 2.34, 7.31, 13.12] },
  {
    id: '1-south', level: 1, exterior: true, rect: [2.85, 13.12, 7.31, 13.32],
    openings: [win('1-win-s', 3.69, 5.67)],
  },
  { id: '1-jog', level: 1, exterior: true, rect: [2.85, 12.06, 3.04, 13.12] },
  {
    id: '1-south-w', level: 1, exterior: true, rect: [0, 11.88, 3.04, 12.06],
    openings: [balcony('1-balcony-door', 0.7, 2.67)],
  },
  { id: '1-wc-e', level: 1, rect: [4.58, 6.64, 4.68, 8.38], openings: [door('1-door-wc', 7.38, 8.28)] },
  { id: '1-wc-s', level: 1, rect: [3.53, 8.38, 4.68, 8.48] },
  { id: '1-stair-w', level: 1, rect: [5.92, 8.48, 6.03, 11.9] },
  // Closes the low space under the upper flight (not drawn on the plan).
  { id: '1-understair', level: 1, rect: [6.03, 8.48, 7.11, 8.58], height: 2.1 },
  { id: '1-chimney', level: 1, shaft: true, rect: [0.18, 7.57, 0.48, 8.13] },

  // ───────────── 2 piętro: three rooms, two bathrooms, utility room ─────────────
  {
    id: '2-north-ne', level: 2, exterior: true, rect: [3.8, 0, 7.31, 0.2],
    openings: [win('2-win-n-pokoj', 4.61, 6.6)],
  },
  { id: '2-west-ne', level: 2, exterior: true, rect: [3.8, 0.2, 3.96, 1.96] },
  {
    id: '2-north-nw', level: 2, exterior: true, rect: [0, 1.8, 3.8, 1.96],
    openings: [win('2-win-n-pokoj2', 0.89, 2.85)],
  },
  { id: '2-west', level: 2, exterior: true, rect: [0, 1.96, 0.18, 10.28] },
  {
    id: '2-south-w', level: 2, exterior: true, rect: [0, 10.28, 3.04, 10.44],
    openings: [balcony('2-balcony-door', 0.72, 2.7)],
  },
  { id: '2-jog', level: 2, exterior: true, rect: [2.85, 10.44, 3.04, 13.12] },
  {
    id: '2-south', level: 2, exterior: true, rect: [2.85, 13.12, 7.31, 13.32],
    openings: [win('2-win-s', 3.72, 5.72)],
  },
  { id: '2-east', level: 2, exterior: true, rect: [7.11, 0.2, 7.31, 13.12] },
  { id: '2-pokoj2-e', level: 2, rect: [3.86, 1.96, 3.96, 5.52], openings: [door('2-door-pokoj2', 4.02, 4.92)] },
  { id: '2-pokoj2-s', level: 2, rect: [0.18, 5.52, 3.96, 5.64] },
  { id: '2-util-e', level: 2, rect: [3.86, 5.64, 3.96, 7.59], openings: [door('2-door-util', 6.34, 7.24)] },
  { id: '2-pokoj-s', level: 2, rect: [3.96, 3.82, 7.11, 3.94], openings: [door('2-door-pokoj', 4.06, 4.96)] },
  { id: '2-bath-w', level: 2, rect: [5.06, 3.94, 5.16, 6.5], openings: [door('2-door-bath', 4.54, 5.44)] },
  { id: '2-bath-s', level: 2, rect: [5.06, 6.5, 7.11, 6.64] },
  { id: '2-small-div', level: 2, rect: [2.41, 5.64, 2.53, 7.59] },
  {
    id: '2-pokoj3-n', level: 2, rect: [0.18, 7.59, 5.92, 7.73],
    openings: [door('2-door-bath2', 0.95, 1.85), door('2-door-pokoj3', 4.39, 5.29)],
  },
  { id: '2-stair-w', level: 2, rect: [5.92, 7.59, 6.03, 12.07] },
  { id: '2-stair-s', level: 2, rect: [6.03, 11.96, 7.11, 12.07] },
  { id: '2-shaft-bath-n', level: 2, shaft: true, rect: [5.16, 3.94, 6.15, 4.2] },
  { id: '2-shaft-bath-s', level: 2, shaft: true, rect: [5.16, 6.24, 5.91, 6.5] },
  { id: '2-shaft-w-a', level: 2, shaft: true, rect: [0.18, 7.33, 0.5, 7.59] },
  { id: '2-shaft-w-b', level: 2, shaft: true, rect: [0.18, 7.73, 0.5, 8.19] },
  { id: '2-shaft-util', level: 2, shaft: true, rect: [3.5, 7.3, 3.86, 7.59] },
  { id: '2-shaft-pokoj2', level: 2, shaft: true, rect: [0.18, 5.24, 0.85, 5.52] },
];

export const ROOMS: Room[] = [
  // Parter
  {
    id: 'wiatrolap-parter', level: 0, name: 'Wiatrołap (parter)', type: 'hall', area: 3.0,
    polygon: [[5.4, 1.22], [7.11, 1.22], [7.11, 2.4], [6.03, 2.4], [6.03, 2.34], [5.4, 2.34]],
    lights: [[6.25, 1.78]],
  },
  {
    id: 'klatka-0', level: 0, name: 'Klatka schodowa', type: 'stairs', group: 'klatka',
    polygon: [[6.03, 2.4], [7.11, 2.4], [7.11, 6.46], [6.03, 6.46]],
    floor: false, ceiling: false,
  },

  // 1 piętro
  {
    id: 'klatka-1', level: 1, name: 'Klatka schodowa', type: 'stairs', group: 'klatka',
    polygon: [[6.03, 2.34], [7.11, 2.34], [7.11, 6.45], [6.03, 6.45]],
    floor: false, lights: [[6.57, 4.3]],
  },
  {
    id: 'wc', level: 1, name: 'WC', type: 'bath', area: 1.83,
    polygon: [[3.53, 6.64], [4.58, 6.64], [4.58, 8.38], [3.53, 8.38]],
    lights: [[4.05, 7.5]],
  },
  {
    id: 'wiatrolap', level: 1, name: 'Wiatrołap', type: 'hall', area: 7.98,
    polygon: [[4.68, 6.64], [6.03, 6.64], [6.03, 6.45], [7.11, 6.45], [7.11, 8.48], [4.68, 8.48]],
    // The upper flight passes over the east end, so the ceiling stops short of it.
    ceilingPolygon: [[4.68, 6.64], [6.03, 6.64], [6.03, 6.45], [7.11, 6.45], [7.11, 7.7], [6.03, 7.7], [6.03, 8.48], [4.68, 8.48]],
    lights: [[5.35, 7.5]],
  },
  {
    id: 'schody-1', level: 1, name: 'Schody na 2 piętro', type: 'stairs', group: 'wiatrolap',
    polygon: [[6.03, 8.58], [7.11, 8.58], [7.11, 11.9], [6.03, 11.9]],
    floor: false, ceiling: false,
  },
  {
    id: 'salon', level: 1, name: 'Salon z aneksem kuchennym', type: 'living', area: 27.47,
    polygon: [
      [0.18, 7.57], [3.33, 7.57], [3.33, 8.48], [5.92, 8.48], [5.92, 11.9], [7.11, 11.9],
      [7.11, 13.12], [3.04, 13.12], [3.04, 11.88], [0.18, 11.88],
    ],
    lights: [[1.75, 9.75], [4.7, 11.0]],
  },
  {
    id: 'balkon-1', level: 1, name: 'Balkon', type: 'balcony', outdoor: true, ceiling: false,
    polygon: [[0.06, 12.06], [2.85, 12.06], [2.85, 13.32], [2.79, 13.32], [2.79, 13.92], [0.06, 13.92]],
  },

  // 2 piętro
  {
    id: 'pokoj', level: 2, name: 'Pokój', type: 'bedroom', area: 11.21,
    polygon: [[3.96, 0.2], [7.11, 0.2], [7.11, 3.82], [3.96, 3.82]],
    lights: [[5.53, 2.0]],
  },
  {
    id: 'pokoj-2', level: 2, name: 'Pokój 2', type: 'bedroom', area: 12.88,
    polygon: [[0.18, 1.96], [3.86, 1.96], [3.86, 5.52], [0.18, 5.52]],
    lights: [[2.02, 3.74]],
  },
  {
    id: 'lazienka', level: 2, name: 'Łazienka', type: 'bath', area: 4.42,
    polygon: [[5.16, 3.94], [7.11, 3.94], [7.11, 6.5], [5.16, 6.5]],
    lights: [[6.2, 5.25]],
  },
  {
    id: 'lazienka-2', level: 2, name: 'Łazienka 2', type: 'bath', area: 4.17,
    polygon: [[0.18, 5.64], [2.41, 5.64], [2.41, 7.59], [0.18, 7.59]],
    lights: [[1.3, 6.55]],
  },
  {
    id: 'pom-gosp', level: 2, name: 'Pom. gospodarcze', type: 'utility', area: 2.49,
    polygon: [[2.53, 5.64], [3.86, 5.64], [3.86, 7.59], [2.53, 7.59]],
    lights: [[3.15, 6.5]],
  },
  {
    id: 'korytarz', level: 2, name: 'Korytarz', type: 'hall', area: 10.73,
    polygon: [[3.96, 3.94], [5.06, 3.94], [5.06, 6.64], [7.11, 6.64], [7.11, 7.7], [6.03, 7.7], [6.03, 7.59], [3.96, 7.59]],
    lights: [[4.51, 5.6]],
  },
  {
    id: 'schody-2', level: 2, name: 'Schody', type: 'stairs', group: 'korytarz',
    polygon: [[6.03, 7.7], [7.11, 7.7], [7.11, 11.96], [6.03, 11.96]],
    floor: false, lights: [[6.57, 10.1]],
  },
  {
    id: 'pokoj-3', level: 2, name: 'Pokój 3', type: 'bedroom', area: 23.76,
    polygon: [
      [0.18, 7.73], [5.92, 7.73], [5.92, 12.07], [7.11, 12.07],
      [7.11, 13.12], [3.04, 13.12], [3.04, 10.28], [0.18, 10.28],
    ],
    lights: [[2.2, 9.0], [4.5, 11.5]],
  },
  {
    id: 'balkon-2', level: 2, name: 'Balkon (2 piętro)', type: 'balcony', outdoor: true, ceiling: false,
    polygon: [[0.06, 10.44], [2.85, 10.44], [2.85, 13.26], [0.06, 13.26]],
  },
];

/**
 * The lower flight is drawn on the plan filling the whole stair tower, so the
 * vestibule is modelled as a single-storey volume in front of it.
 */
export const STAIRS: Stair[] = [
  { id: 'schody-a', name: 'Schody parter → 1 piętro', level: 0, x0: 6.03, x1: 7.11, zBottom: 2.4, zTop: 6.45, risers: 16 },
  { id: 'schody-b', name: 'Schody 1 → 2 piętro', level: 1, x0: 6.03, x1: 7.11, zBottom: 11.9, zTop: 7.7, risers: 16 },
];

export const SLABS: Slab[] = [
  {
    id: 'slab-parter', name: 'Płyta parteru', level: 0, capOf: null, kind: 'base', top: 0, thickness: SLAB,
    outline: [[5.22, 1.04], [7.31, 1.04], [7.31, 6.64], [5.83, 6.64], [5.83, 2.52], [5.22, 2.52]],
  },
  {
    id: 'slab-vest-roof', name: 'Dach wiatrołapu', level: 0, capOf: 0, kind: 'roof', top: F2F, thickness: SLAB,
    outline: [[5.22, 1.04], [7.31, 1.04], [7.31, 2.34], [5.83, 2.34], [5.83, 2.52], [5.22, 2.52]],
  },
  {
    id: 'slab-1', name: 'Strop nad parterem', level: 1, capOf: 0, kind: 'floor', top: F2F, thickness: SLAB,
    outline: [
      [0, 7.39], [3.33, 7.39], [3.33, 6.46], [5.83, 6.46], [5.83, 6.64], [6.03, 6.64], [6.03, 6.45],
      [7.11, 6.45], [7.11, 6.64], [7.31, 6.64], [7.31, 13.32], [2.85, 13.32], [2.85, 12.06], [0, 12.06],
    ],
  },
  {
    id: 'slab-balkon-1', name: 'Płyta balkonu', level: 1, capOf: null, kind: 'balcony', top: F2F, thickness: 0.2,
    outline: [[0, 12.06], [2.85, 12.06], [2.85, 13.98], [0, 13.98]],
  },
  {
    id: 'slab-2', name: 'Strop nad 1 piętrem', level: 2, capOf: 1, kind: 'floor', top: 2 * F2F, thickness: SLAB,
    outline: [[3.8, 0], [7.31, 0], [7.31, 13.32], [0, 13.32], [0, 1.8], [3.8, 1.8]],
    holes: [[[6.03, 7.7], [7.11, 7.7], [7.11, 11.96], [6.03, 11.96]]],
  },
  {
    id: 'roof', name: 'Dach', level: 2, capOf: 2, kind: 'roof', top: 3 * F2F, thickness: SLAB,
    outline: [[3.8, 0], [7.31, 0], [7.31, 13.32], [2.85, 13.32], [2.85, 10.44], [0, 10.44], [0, 1.8], [3.8, 1.8]],
  },
];

export const RAILINGS: Railing[] = [
  { id: 'rail-1-w', level: 1, rect: [0, 12.06, 0.06, 13.98], height: 1.1 },
  { id: 'rail-1-s', level: 1, rect: [0.06, 13.92, 2.85, 13.98], height: 1.1 },
  { id: 'rail-1-e', level: 1, rect: [2.79, 13.32, 2.85, 13.92], height: 1.1 },
  { id: 'rail-2-w', level: 2, rect: [0, 10.44, 0.06, 13.32], height: 1.1 },
  { id: 'rail-2-s', level: 2, rect: [0.06, 13.26, 2.85, 13.32], height: 1.1 },
];

/** Rest of the building around the flat — unknown, so shown only as plain volumes. */
export const CONTEXT: ContextBox[] = [
  // Under the first floor
  { rect: [0, 7.39, 3.33, 12.06], y0: 0, y1: CLEAR },
  { rect: [2.85, 12.06, 3.33, 13.32], y0: 0, y1: CLEAR },
  { rect: [3.33, 6.64, 5.83, 13.32], y0: 0, y1: CLEAR },
  { rect: [5.83, 6.64, 7.31, 13.32], y0: 0, y1: CLEAR },
  // Under the parts of the second floor that overhang the first
  { rect: [0, 0, 3.8, 1.8], y0: 0, y1: 2 * F2F - SLAB },
  { rect: [0, 1.8, 3.33, 7.39], y0: 0, y1: 2 * F2F - SLAB },
  { rect: [3.33, 1.8, 5.22, 6.46], y0: 0, y1: 2 * F2F - SLAB },
  { rect: [5.22, 2.52, 5.83, 6.46], y0: 0, y1: 2 * F2F - SLAB },
  { rect: [3.8, 0, 7.31, 1.04], y0: 0, y1: 2 * F2F - SLAB },
  { rect: [3.8, 1.04, 5.22, 1.8], y0: 0, y1: 2 * F2F - SLAB },
  { rect: [5.22, 1.04, 7.31, 2.17], y0: F2F, y1: 2 * F2F - SLAB },
  { rect: [5.22, 2.17, 5.83, 2.52], y0: F2F, y1: 2 * F2F - SLAB },
];

/** Overall plan extents, used to frame cameras, lights and the minimap. */
export const BOUNDS = { x0: 0, x1: 7.31, z0: 0, z1: 13.98, height: 3 * F2F };

export const roomById = (id: string): Room | undefined => ROOMS.find((r) => r.id === id);
export const groupOf = (room: Room): string => room.group ?? room.id;

export function polygonArea(poly: readonly (readonly [number, number])[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

export function pointInPolygon(x: number, z: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function roomAt(level: number, x: number, z: number): Room | undefined {
  return ROOMS.find((r) => r.level === level && pointInPolygon(x, z, r.polygon));
}

export function polygonCentroid(poly: readonly (readonly [number, number])[]): [number, number] {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const f = x1 * z2 - x2 * z1;
    a += f;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  return [cx / (3 * a), cz / (3 * a)];
}
