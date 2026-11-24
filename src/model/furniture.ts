/**
 * Furniture catalogue. Every piece is parametric: a function of width, depth
 * and height that returns a handful of boxes and cylinders, so any item can be
 * resized to match a real product and nothing has to be downloaded.
 *
 * Local axes: X = width, Z = depth with the front at +Z, Y = up from the floor.
 */
import type { FurnitureItem, Lamp, LampKind } from './types.ts';

export type PartShape = 'box' | 'cyl' | 'cylz';

/** What a part is made of. 'main' takes the item's own colour, 'soft' a lighter shade of it. */
export type PartRole =
  | 'main' | 'soft' | 'top' | 'wood' | 'metal' | 'steel' | 'white' | 'dark' | 'glass' | 'screen' | 'green' | 'mirror';

export interface Part {
  shape: PartShape;
  role: PartRole;
  /** Centre. */
  x: number; y: number; z: number;
  /** Size; for cylinders sx is the diameter and sy (or sz for 'cylz') the length. */
  sx: number; sy: number; sz: number;
}

export type Category = 'living' | 'dining' | 'kitchen' | 'bedroom' | 'bath' | 'storage';

export const CATEGORIES: { id: Category; name: string }[] = [
  { id: 'living', name: 'Living' },
  { id: 'dining', name: 'Dining' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'bath', name: 'Bath' },
  { id: 'storage', name: 'Storage' },
];

export interface FurnitureDef {
  kind: string;
  name: string;
  /** What to look for in a Polish shop. */
  search: string;
  category: Category;
  /** Default width, depth, height in metres. */
  size: [number, number, number];
  color: string;
  /** Mounting height for wall-hung pieces. */
  lift?: number;
  build: (w: number, d: number, h: number) => Part[];
}

const box = (role: PartRole, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Part => ({
  shape: 'box', role, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, sx: x1 - x0, sy: y1 - y0, sz: z1 - z0,
});
const cyl = (role: PartRole, x: number, z: number, dia: number, y0: number, y1: number): Part => ({
  shape: 'cyl', role, x, y: (y0 + y1) / 2, z, sx: dia, sy: y1 - y0, sz: dia,
});
const cylz = (role: PartRole, x: number, y: number, dia: number, z0: number, z1: number): Part => ({
  shape: 'cylz', role, x, y, z: (z0 + z1) / 2, sx: dia, sy: dia, sz: z1 - z0,
});

/** Four legs set in from the corners. */
function legs(w: number, d: number, top: number, t = 0.05, inset = 0.04, role: PartRole = 'dark'): Part[] {
  const x = w / 2 - inset, z = d / 2 - inset;
  return [[-x, -z], [x - t, -z], [-x, z - t], [x - t, z - t]].map(([lx, lz]) => box(role, lx, lx + t, 0, top, lz, lz + t));
}

const seating = (seats: number) => (w: number, d: number, h: number): Part[] => {
  const hw = w / 2, hd = d / 2;
  const arm = Math.min(0.17, w * 0.14), back = 0.2, leg = 0.1, seat = 0.42;
  const parts = [
    ...legs(w, d, leg, 0.06),
    box('main', -hw, hw, leg, seat - 0.1, -hd, hd),
    box('main', -hw, hw, leg, h, -hd, -hd + back),
    box('main', -hw, -hw + arm, leg, h * 0.78, -hd, hd),
    box('main', hw - arm, hw, leg, h * 0.78, -hd, hd),
  ];
  const cw = (w - 2 * arm) / seats;
  for (let i = 0; i < seats; i++) {
    const x0 = -hw + arm + i * cw + 0.012, x1 = -hw + arm + (i + 1) * cw - 0.012;
    parts.push(box('soft', x0, x1, seat - 0.1, seat + 0.04, -hd + back, hd - 0.02));
    parts.push(box('soft', x0, x1, seat + 0.04, h - 0.03, -hd + back, -hd + back + 0.14));
  }
  return parts;
};

const table = (legT: number) => (w: number, d: number, h: number): Part[] => [
  box('main', -w / 2, w / 2, h - 0.04, h, -d / 2, d / 2),
  ...legs(w, d, h - 0.04, legT, 0.05, 'main'),
];

function cabinetFronts(w: number, y0: number, y1: number, front: number, handleY: number): Part[] {
  const n = Math.max(1, Math.round(w / 0.6));
  const parts: Part[] = [];
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + ((i + 0.5) * w) / n;
    parts.push(box('metal', cx - 0.08, cx + 0.08, handleY, handleY + 0.014, front, front + 0.022));
    if (i > 0) {
      const gx = -w / 2 + (i * w) / n;
      parts.push(box('dark', gx - 0.002, gx + 0.002, y0, y1, front - 0.001, front + 0.002));
    }
  }
  return parts;
}

function kitchenBase(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2;
  return [
    box('dark', -hw, hw, 0, 0.1, -hd, hd - 0.06),
    box('main', -hw, hw, 0.1, h - 0.04, -hd, hd - 0.02),
    box('top', -hw, hw, h - 0.04, h, -hd, hd),
    ...cabinetFronts(w, 0.1, h - 0.04, hd - 0.02, h - 0.13),
  ];
}

function bed(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2;
  const parts = [
    ...legs(w, d, 0.1, 0.07, 0.05),
    box('main', -hw, hw, 0.1, 0.3, -hd, hd),
    box('main', -hw, hw, 0, Math.max(h, 0.6), -hd, -hd + 0.07),
    box('white', -hw + 0.03, hw - 0.03, 0.3, 0.5, -hd + 0.07, hd - 0.03),
    box('soft', -hw + 0.01, hw - 0.01, 0.5, 0.56, -hd + 0.75, hd - 0.02),
  ];
  const pillows = w > 1.2 ? 2 : 1;
  for (let i = 0; i < pillows; i++) {
    const pw = (w - 0.1) / pillows;
    const x0 = -hw + 0.05 + i * pw + 0.04;
    parts.push(box('white', x0, x0 + pw - 0.08, 0.5, 0.61, -hd + 0.13, -hd + 0.55));
  }
  return parts;
}

function bookshelf(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2, t = 0.022;
  const parts = [
    box('main', -hw, -hw + t, 0, h, -hd, hd),
    box('main', hw - t, hw, 0, h, -hd, hd),
    box('main', -hw + t, hw - t, 0, h, -hd, -hd + 0.01),
  ];
  const n = Math.max(2, Math.round(h / 0.38));
  const books: PartRole[] = ['dark', 'soft', 'green', 'white', 'wood'];
  for (let k = 0; k <= n; k++) {
    const y = (k * (h - t)) / n;
    parts.push(box('main', -hw + t, hw - t, y, y + t, -hd, hd));
    if (k < n && k % 2 === 0) {
      const span = (w - 2 * t) * (0.45 + 0.1 * (k % 3));
      parts.push(box(books[k % books.length], -hw + t + 0.02, -hw + t + 0.02 + span, y + t, y + t + 0.24, -hd + 0.03, hd - 0.06));
    }
  }
  return parts;
}

function wardrobe(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2;
  const n = Math.max(2, Math.round(w / 0.6));
  const parts = [box('dark', -hw, hw, 0, 0.06, -hd, hd - 0.05), box('main', -hw, hw, 0.06, h, -hd, hd - 0.02)];
  for (let i = 1; i < n; i++) {
    const gx = -hw + (i * w) / n;
    parts.push(box('dark', gx - 0.002, gx + 0.002, 0.06, h, hd - 0.021, hd - 0.018));
    const side = i % 2 === 1 ? -0.035 : 0.02;
    parts.push(box('metal', gx + side, gx + side + 0.014, 1.0, 1.28, hd - 0.02, hd + 0.005));
  }
  return parts;
}

function bathtub(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2, t = 0.06;
  return [
    box('white', -hw, hw, 0, 0.14, -hd, hd),
    box('white', -hw, hw, 0.14, h, -hd, -hd + t),
    box('white', -hw, hw, 0.14, h, hd - t, hd),
    box('white', -hw, -hw + t, 0.14, h, -hd + t, hd - t),
    box('white', hw - t, hw, 0.14, h, -hd + t, hd - t),
    cyl('steel', -hw + 0.03, 0, 0.03, h, h + 0.16),
    box('steel', -hw + 0.02, -hw + 0.2, h + 0.13, h + 0.155, -0.012, 0.012),
  ];
}

function shower(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2;
  // Walls go at the back and the left; the front and right are glazed.
  return [
    box('white', -hw, hw, 0, 0.05, -hd, hd),
    box('glass', -hw, hw, 0.05, h, hd - 0.012, hd),
    box('glass', hw - 0.012, hw, 0.05, h, -hd, hd - 0.012),
    box('steel', -hw, hw, h - 0.03, h, hd - 0.02, hd),
    box('steel', hw - 0.02, hw, h - 0.03, h, -hd, hd),
    cyl('steel', -hw + 0.08, -hd + 0.06, 0.025, 0.9, h - 0.05),
    box('steel', -hw + 0.02, -hw + 0.26, h - 0.07, h - 0.05, -hd + 0.02, -hd + 0.26),
  ];
}

function toilet(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2;
  return [
    box('white', -hw * 0.85, hw * 0.85, 0, 0.4, -hd + 0.16, hd - w / 2),
    cyl('white', 0, hd - w / 2, w * 0.85, 0, 0.4),
    box('white', -hw * 0.9, hw * 0.9, 0.4, 0.425, -hd + 0.16, hd - w / 2),
    cyl('white', 0, hd - w / 2, w * 0.9, 0.4, 0.425),
    box('white', -hw, hw, 0, h, -hd, -hd + 0.17),
    box('steel', -0.03, 0.03, h, h + 0.012, -hd + 0.06, -hd + 0.11),
  ];
}

function vanity(w: number, d: number, h: number): Part[] {
  const hw = w / 2, hd = d / 2;
  return [
    box('main', -hw, hw, 0.3, h - 0.05, -hd, hd - 0.01),
    ...cabinetFronts(w, 0.3, h - 0.05, hd - 0.01, h - 0.16),
    box('white', -hw, hw, h - 0.05, h, -hd, hd),
    cyl('white', 0, 0.02, Math.min(0.42, w * 0.6), h, h + 0.12),
    cyl('steel', 0, -hd + 0.06, 0.028, h, h + 0.24),
    box('steel', -0.012, 0.012, h + 0.215, h + 0.24, -hd + 0.06, -hd + 0.2),
    box('mirror', -hw, hw, 1.15, 1.85, -hd, -hd + 0.02),
  ];
}

export const FURNITURE: FurnitureDef[] = [
  // Living
  { kind: 'sofa-3', name: 'Sofa, 3 seats', search: 'sofa 3-osobowa', category: 'living', size: [2.2, 0.95, 0.8], color: '#8c9198', build: seating(3) },
  { kind: 'sofa-2', name: 'Sofa, 2 seats', search: 'sofa 2-osobowa', category: 'living', size: [1.6, 0.9, 0.8], color: '#8c9198', build: seating(2) },
  { kind: 'armchair', name: 'Armchair', search: 'fotel', category: 'living', size: [0.85, 0.85, 0.8], color: '#b98a5e', build: seating(1) },
  {
    kind: 'coffee-table', name: 'Coffee table', search: 'stolik kawowy', category: 'living', size: [1.1, 0.6, 0.4], color: '#b08a5e',
    build: (w, d, h) => [...table(0.04)(w, d, h), box('main', -w / 2 + 0.07, w / 2 - 0.07, 0.12, 0.14, -d / 2 + 0.07, d / 2 - 0.07)],
  },
  {
    kind: 'tv-unit', name: 'TV unit with TV', search: 'szafka rtv', category: 'living', size: [1.8, 0.42, 0.5], color: '#e9e6df',
    build: (w, d, h) => [
      ...legs(w, d, 0.1, 0.04, 0.06),
      box('main', -w / 2, w / 2, 0.1, h, -d / 2, d / 2 - 0.01),
      ...cabinetFronts(w, 0.1, h, d / 2 - 0.01, h - 0.1),
      box('dark', -0.16, 0.16, h, h + 0.05, -d / 2 + 0.04, -d / 2 + 0.24),
      box('screen', -w * 0.36, w * 0.36, h + 0.05, h + 0.05 + w * 0.41, -d / 2 + 0.1, -d / 2 + 0.14),
    ],
  },
  { kind: 'rug', name: 'Rug', search: 'dywan', category: 'living', size: [2.0, 1.4, 0.012], color: '#c9bca8', build: (w, d, h) => [box('main', -w / 2, w / 2, 0, h, -d / 2, d / 2)] },
  {
    kind: 'plant', name: 'Floor plant', search: 'roślina doniczkowa duża', category: 'living', size: [0.5, 0.5, 1.3], color: '#e8e4dc',
    build: (w, _d, h) => [
      cyl('main', 0, 0, w * 0.62, 0, 0.34),
      cyl('wood', 0, 0, 0.035, 0.34, h * 0.6),
      cyl('green', 0, 0, w * 0.8, h * 0.38, h * 0.52),
      cyl('green', 0, 0, w, h * 0.52, h * 0.82),
      cyl('green', 0, 0, w * 0.66, h * 0.82, h),
    ],
  },

  // Dining
  { kind: 'dining-table', name: 'Dining table', search: 'stół do jadalni', category: 'dining', size: [1.6, 0.9, 0.75], color: '#b08a5e', build: table(0.06) },
  {
    kind: 'chair', name: 'Chair', search: 'krzesło do jadalni', category: 'dining', size: [0.45, 0.5, 0.85], color: '#3d4046',
    build: (w, d, h) => [
      ...legs(w, d, 0.43, 0.03, 0.02),
      box('main', -w / 2, w / 2, 0.43, 0.47, -d / 2, d / 2),
      box('main', -w / 2, w / 2, 0.47, h, -d / 2, -d / 2 + 0.04),
    ],
  },
  {
    kind: 'bar-stool', name: 'Bar stool', search: 'hoker', category: 'dining', size: [0.4, 0.4, 0.75], color: '#3d4046',
    build: (w, d, h) => [...legs(w, d, h - 0.05, 0.03, 0.03), cyl('main', 0, 0, Math.min(w, d), h - 0.05, h)],
  },

  // Kitchen
  { kind: 'kitchen-base', name: 'Base cabinets', search: 'szafka kuchenna dolna', category: 'kitchen', size: [1.2, 0.6, 0.9], color: '#eeeae2', build: kitchenBase },
  {
    kind: 'kitchen-sink', name: 'Sink unit', search: 'zlewozmywak', category: 'kitchen', size: [1.2, 0.6, 0.9], color: '#eeeae2',
    build: (w, d, h) => [
      ...kitchenBase(w, d, h),
      box('steel', -0.26, 0.26, h, h + 0.006, -0.19, 0.2),
      box('dark', -0.21, 0.21, h + 0.006, h + 0.008, -0.15, 0.16),
      cyl('steel', 0, -d / 2 + 0.07, 0.03, h, h + 0.28),
      box('steel', -0.012, 0.012, h + 0.255, h + 0.28, -d / 2 + 0.07, -d / 2 + 0.24),
    ],
  },
  {
    kind: 'kitchen-hob', name: 'Hob and oven', search: 'płyta indukcyjna', category: 'kitchen', size: [0.6, 0.6, 0.9], color: '#eeeae2',
    build: (w, d, h) => [
      box('dark', -w / 2, w / 2, 0, 0.1, -d / 2, d / 2 - 0.06),
      box('main', -w / 2, w / 2, 0.1, h - 0.04, -d / 2, d / 2 - 0.02),
      box('top', -w / 2, w / 2, h - 0.04, h, -d / 2, d / 2),
      box('screen', -w / 2 + 0.03, w / 2 - 0.03, h, h + 0.008, -d / 2 + 0.06, d / 2 - 0.06),
      box('screen', -w / 2 + 0.03, w / 2 - 0.03, 0.16, h - 0.12, d / 2 - 0.02, d / 2 - 0.008),
      box('metal', -w / 2 + 0.08, w / 2 - 0.08, h - 0.17, h - 0.155, d / 2 - 0.008, d / 2 + 0.02),
    ],
  },
  {
    kind: 'kitchen-wall', name: 'Wall cabinets', search: 'szafka kuchenna wisząca', category: 'kitchen', size: [1.2, 0.35, 0.72], color: '#eeeae2', lift: 1.45,
    build: (w, d, h) => [box('main', -w / 2, w / 2, 0, h, -d / 2, d / 2 - 0.01), ...cabinetFronts(w, 0, h, d / 2 - 0.01, 0.06)],
  },
  {
    kind: 'fridge', name: 'Fridge-freezer', search: 'lodówka wolnostojąca', category: 'kitchen', size: [0.6, 0.65, 2.0], color: '#c9ccd0',
    build: (w, d, h) => [
      box('steel', -w / 2, w / 2, 0.03, h, -d / 2, d / 2 - 0.02),
      box('dark', -w / 2, w / 2, h * 0.36, h * 0.36 + 0.006, d / 2 - 0.021, d / 2 - 0.017),
      box('metal', w / 2 - 0.08, w / 2 - 0.066, h * 0.42, h * 0.72, d / 2 - 0.02, d / 2 + 0.012),
      box('metal', w / 2 - 0.08, w / 2 - 0.066, h * 0.16, h * 0.32, d / 2 - 0.02, d / 2 + 0.012),
    ],
  },
  {
    kind: 'island', name: 'Kitchen island', search: 'wyspa kuchenna', category: 'kitchen', size: [1.8, 0.9, 0.9], color: '#3d4046',
    build: (w, d, h) => [
      box('dark', -w / 2 + 0.06, w / 2 - 0.06, 0, 0.1, -d / 2 + 0.06, d / 2 - 0.06),
      box('main', -w / 2 + 0.03, w / 2 - 0.03, 0.1, h - 0.04, -d / 2 + 0.03, d / 2 - 0.03),
      box('top', -w / 2, w / 2, h - 0.04, h, -d / 2, d / 2),
    ],
  },

  // Bedroom
  { kind: 'bed-double', name: 'Double bed 160', search: 'łóżko 160x200', category: 'bedroom', size: [1.7, 2.1, 1.0], color: '#8a7f73', build: bed },
  { kind: 'bed-single', name: 'Single bed 90', search: 'łóżko 90x200', category: 'bedroom', size: [1.0, 2.05, 0.9], color: '#8a7f73', build: bed },
  {
    kind: 'nightstand', name: 'Bedside table', search: 'szafka nocna', category: 'bedroom', size: [0.45, 0.4, 0.5], color: '#b08a5e',
    build: (w, d, h) => [
      ...legs(w, d, 0.12, 0.03, 0.03),
      box('main', -w / 2, w / 2, 0.12, h, -d / 2, d / 2 - 0.01),
      box('metal', -0.06, 0.06, h - 0.12, h - 0.106, d / 2 - 0.01, d / 2 + 0.012),
    ],
  },
  {
    kind: 'desk', name: 'Desk', search: 'biurko', category: 'bedroom', size: [1.3, 0.6, 0.75], color: '#e9e6df',
    build: (w, d, h) => [
      box('main', -w / 2, w / 2, h - 0.03, h, -d / 2, d / 2),
      box('main', -w / 2 + 0.02, -w / 2 + 0.05, 0, h - 0.03, -d / 2 + 0.03, d / 2 - 0.03),
      box('main', w / 2 - 0.42, w / 2 - 0.02, 0.05, h - 0.03, -d / 2 + 0.03, d / 2 - 0.03),
      box('metal', w / 2 - 0.3, w / 2 - 0.14, h - 0.16, h - 0.146, d / 2 - 0.03, d / 2 - 0.008),
    ],
  },

  // Bath
  { kind: 'bathtub', name: 'Bathtub', search: 'wanna prostokątna', category: 'bath', size: [1.7, 0.75, 0.58], color: '#f4f3ef', build: bathtub },
  { kind: 'shower', name: 'Shower enclosure', search: 'kabina prysznicowa 90x90', category: 'bath', size: [0.9, 0.9, 2.0], color: '#f4f3ef', build: shower },
  { kind: 'toilet', name: 'Toilet', search: 'miska wc kompakt', category: 'bath', size: [0.37, 0.62, 0.8], color: '#f4f3ef', build: toilet },
  { kind: 'vanity', name: 'Washbasin unit', search: 'szafka z umywalką', category: 'bath', size: [0.8, 0.46, 0.85], color: '#b08a5e', build: vanity },
  {
    kind: 'washer', name: 'Washing machine', search: 'pralka', category: 'bath', size: [0.6, 0.6, 0.85], color: '#f4f3ef',
    build: (w, d, h) => [
      box('white', -w / 2, w / 2, 0.02, h, -d / 2, d / 2 - 0.02),
      cylz('screen', 0, h * 0.5, w * 0.58, d / 2 - 0.02, d / 2 - 0.004),
      box('dark', -w / 2 + 0.04, w / 2 - 0.04, h - 0.11, h - 0.04, d / 2 - 0.021, d / 2 - 0.016),
    ],
  },

  // Storage
  { kind: 'wardrobe', name: 'Wardrobe', search: 'szafa', category: 'storage', size: [1.8, 0.6, 2.3], color: '#e9e6df', build: wardrobe },
  { kind: 'bookshelf', name: 'Bookcase', search: 'regał na książki', category: 'storage', size: [0.9, 0.32, 2.0], color: '#e9e6df', build: bookshelf },
  {
    kind: 'sideboard', name: 'Sideboard', search: 'komoda', category: 'storage', size: [1.4, 0.42, 0.8], color: '#b08a5e',
    build: (w, d, h) => [...legs(w, d, 0.12, 0.04, 0.05), box('main', -w / 2, w / 2, 0.12, h, -d / 2, d / 2 - 0.01), ...cabinetFronts(w, 0.12, h, d / 2 - 0.01, h - 0.12)],
  },
  { kind: 'box', name: 'Plain block', search: '', category: 'storage', size: [0.6, 0.6, 0.6], color: '#b9b4aa', build: (w, d, h) => [box('main', -w / 2, w / 2, 0, h, -d / 2, d / 2)] },
];

const BY_KIND = new Map(FURNITURE.map((f) => [f.kind, f]));
export const furnitureDef = (kind: string): FurnitureDef => BY_KIND.get(kind) ?? BY_KIND.get('box')!;

// ───────────── Lamps ─────────────

export interface LampDef {
  kind: LampKind;
  name: string;
  search: string;
  intensity: number;
  drop?: number;
  angle?: number;
}

export const LAMPS: LampDef[] = [
  { kind: 'ceiling', name: 'Ceiling light', search: 'plafon led', intensity: 8 },
  { kind: 'pendant', name: 'Pendant', search: 'lampa wisząca', intensity: 7, drop: 0.9 },
  { kind: 'spot', name: 'Downlight', search: 'oczko sufitowe led', intensity: 16, angle: 70 },
  { kind: 'floor', name: 'Floor lamp', search: 'lampa podłogowa', intensity: 5 },
];
export const lampDef = (kind: LampKind): LampDef => LAMPS.find((l) => l.kind === kind) ?? LAMPS[0];

// ───────────── A starting point ─────────────

type Seed = [kind: string, level: number, x: number, z: number, rot: number, size?: [number, number, number], color?: string];

/** One plausible way to furnish the flat — a demonstration, not the developer's fit-out. */
const SAMPLE: Seed[] = [
  // 1 piętro — kitchen along the north wall of the living room
  ['fridge', 1, 0.86, 7.9, 0],
  ['kitchen-sink', 1, 1.76, 7.87, 0],
  ['kitchen-hob', 1, 2.66, 7.87, 0],
  ['kitchen-wall', 1, 2.06, 7.75, 0, [1.8, 0.35, 0.72]],
  // Lounge on the west side, facing a TV on the west wall
  ['tv-unit', 1, 0.4, 10.1, 90],
  ['rug', 1, 1.65, 10.1, 90],
  ['coffee-table', 1, 1.6, 10.1, 90],
  ['sofa-3', 1, 2.86, 10.1, 270],
  // Dining between the lounge and the stairs
  ['dining-table', 1, 4.42, 10.0, 90],
  ['chair', 1, 3.72, 9.6, 90],
  ['chair', 1, 3.72, 10.4, 90],
  ['chair', 1, 5.12, 9.6, 270],
  ['chair', 1, 5.12, 10.4, 270],
  ['plant', 1, 3.4, 12.75, 0],
  ['sideboard', 1, 5.25, 6.86, 0, [1.1, 0.4, 0.9]],
  ['toilet', 1, 4.05, 6.96, 0],
  ['vanity', 1, 3.73, 7.92, 90, [0.5, 0.38, 0.85]],
  ['plant', 1, 0.42, 13.55, 0, [0.4, 0.4, 0.9]],

  // 2 piętro — Pokój (north-east)
  ['bed-single', 2, 6.6, 1.3, 0],
  ['desk', 2, 4.95, 0.52, 0],
  ['wardrobe', 2, 6.45, 3.5, 180, [1.2, 0.6, 2.3]],
  // Pokój 2 (north-west)
  ['bed-double', 2, 1.24, 3.45, 90],
  ['nightstand', 2, 0.4, 2.36, 90],
  ['nightstand', 2, 0.4, 4.54, 90],
  ['wardrobe', 2, 2.3, 5.2, 180],
  // Pokój 3 (master)
  ['bed-double', 2, 4.1, 11.75, 90, [1.8, 2.1, 1.0]],
  ['nightstand', 2, 3.26, 10.62, 90],
  ['nightstand', 2, 3.26, 12.88, 90],
  ['wardrobe', 2, 3.1, 8.04, 0, [2.2, 0.6, 2.3]],
  ['armchair', 2, 0.85, 9.55, 60],
  // Łazienka
  ['bathtub', 2, 6.73, 5.2, 90, [1.6, 0.75, 0.58]],
  ['vanity', 2, 6.36, 6.26, 180],
  ['toilet', 2, 5.48, 5.84, 90],
  // Łazienka 2
  ['shower', 2, 1.96, 6.09, 270],
  ['toilet', 2, 1.1, 5.96, 0],
  ['vanity', 2, 0.42, 6.62, 90, [0.7, 0.46, 0.85]],
  // Pom. gospodarcze
  ['washer', 2, 2.84, 5.95, 0],
  ['bookshelf', 2, 2.7, 6.9, 90],
  // Terrace
  ['armchair', 2, 0.75, 11.4, 90, [0.75, 0.75, 0.75], '#6f7f6a'],
  ['armchair', 2, 0.75, 12.4, 90, [0.75, 0.75, 0.75], '#6f7f6a'],
  ['coffee-table', 2, 1.65, 11.9, 90, [0.7, 0.5, 0.4]],
];

export function sampleFurniture(): FurnitureItem[] {
  return SAMPLE.map(([kind, level, x, z, rot, size, color], i) => {
    const def = furnitureDef(kind);
    const [w, d, h] = size ?? def.size;
    return { id: `sample-${i}`, kind, level, x, z, rot, w, d, h, color: color ?? def.color };
  });
}

/** Extra lamps that go with the sample layout. */
export function sampleLamps(): Lamp[] {
  return [
    { id: 'sample-lamp-dining', kind: 'pendant', level: 1, x: 4.42, z: 10.0, on: true, intensity: 7, color: '#ffd9a8', drop: 1.05 },
    { id: 'sample-lamp-sofa', kind: 'floor', level: 1, x: 2.9, z: 8.72, on: true, intensity: 5, color: '#ffd9a8' },
    { id: 'sample-lamp-kitchen-1', kind: 'spot', level: 1, x: 1.4, z: 8.1, on: true, intensity: 16, color: '#fff0dc', angle: 70 },
    { id: 'sample-lamp-kitchen-2', kind: 'spot', level: 1, x: 2.5, z: 8.1, on: true, intensity: 16, color: '#fff0dc', angle: 70 },
  ];
}

/** Corners of an item's footprint in plan, for the minimap and for collisions. */
export function footprint(item: Pick<FurnitureItem, 'x' | 'z' | 'w' | 'd' | 'rot'>): [number, number][] {
  const a = (item.rot * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const hw = item.w / 2, hd = item.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [item.x + lx * cos + lz * sin, item.z - lx * sin + lz * cos]);
}
