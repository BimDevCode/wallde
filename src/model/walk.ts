/**
 * First-person movement data: what you can stand on and what you bump into.
 * Deliberately simple — axis-aligned boxes and a circle — because every wall
 * in this plan is axis-aligned.
 */
import { F2F, LEVELS, RAILINGS, ROOMS, SLABS, STAIRS, WALLS, pointInPolygon } from './apartment.ts';
import { isAlongX, wallHeight } from './build.ts';
import type { Room, Slab } from './types.ts';

export interface Collider {
  x0: number; x1: number; z0: number; z1: number; y0: number; y1: number;
}

export const EYE_HEIGHT = 1.62;
export const PLAYER_RADIUS = 0.22;
/** Highest ledge you can walk up without jumping; also how far the body clears the floor. */
const STEP = 0.5;
const BODY_TOP = 1.75;
/** Furniture lower than this (rugs, mats) is walked over rather than around. */
const RUG = 0.08;
const GROUND_Y = -0.05;

function buildColliders(): Collider[] {
  const out: Collider[] = [];
  for (const w of WALLS) {
    const y0 = LEVELS[w.level].elevation;
    const y1 = y0 + wallHeight(w);
    const [x0, z0, x1, z1] = w.rect;
    const alongX = isAlongX(w);
    const piece = (a: number, b: number, ya: number, yb: number) => {
      if (b - a < 1e-6 || yb - ya < 1e-6) return;
      out.push(alongX ? { x0: a, x1: b, z0, z1, y0: ya, y1: yb } : { x0, x1, z0: a, z1: b, y0: ya, y1: yb });
    };
    let cursor = alongX ? x0 : z0;
    const end = alongX ? x1 : z1;
    for (const o of [...(w.openings ?? [])].sort((a, b) => a.from - b.from)) {
      piece(cursor, o.from, y0, y1);
      if (o.kind === 'door') {
        piece(o.from, o.to, y0 + o.head, y1);
      } else if (o.kind === 'balconyDoor') {
        // One leaf is shut, the other open.
        piece(o.from, (o.from + o.to) / 2, y0, y1);
        piece((o.from + o.to) / 2, o.to, y0 + o.head, y1);
      } else {
        piece(o.from, o.to, y0, y1);
      }
      cursor = o.to;
    }
    piece(cursor, end, y0, y1);
  }
  for (const r of RAILINGS) {
    const y0 = LEVELS[r.level].elevation;
    out.push({ x0: r.rect[0], x1: r.rect[2], z0: r.rect[1], z1: r.rect[3], y0, y1: y0 + r.height });
  }
  return out;
}

export const COLLIDERS = buildColliders();

/** A box that may be turned to any angle — furniture, which the user moves around at will. */
export interface Obstacle {
  x: number; z: number;
  /** Half width and half depth. */
  hw: number; hd: number;
  cos: number; sin: number;
  y0: number; y1: number;
}

let obstacles: Obstacle[] = [];

export function setObstacles(list: Obstacle[]): void {
  obstacles = list;
}

const inSlab = (s: Slab, x: number, z: number) =>
  pointInPolygon(x, z, s.outline) && !(s.holes ?? []).some((h) => pointInPolygon(x, z, h));

/** Height of the surface under (x, z) that someone whose feet are at `feetY` would stand on. */
export function groundAt(x: number, z: number, feetY: number): number {
  let best = GROUND_Y;
  const consider = (h: number) => {
    if (h <= feetY + STEP && h > best) best = h;
  };
  for (const s of SLABS) if (inSlab(s, x, z)) consider(s.top);
  for (const st of STAIRS) {
    if (x < st.x0 || x > st.x1) continue;
    const t = (z - st.zBottom) / (st.zTop - st.zBottom);
    if (t < 0 || t > 1) continue;
    consider(LEVELS[st.level].elevation + F2F * t);
  }
  return best;
}

/** Pushes a circle at (x, z) out of every collider that overlaps the body's height range. */
export function resolveCollisions(x: number, z: number, feetY: number): [number, number] {
  const lo = feetY + STEP, hi = feetY + BODY_TOP;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const c of COLLIDERS) {
      if (c.y1 <= lo || c.y0 >= hi) continue;
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= PLAYER_RADIUS * PLAYER_RADIUS) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * PLAYER_RADIUS;
        z = nz + (dz / d) * PLAYER_RADIUS;
      } else {
        // Centre is inside the box: leave through the nearest face.
        const exits = [x - c.x0, c.x1 - x, z - c.z0, c.z1 - z];
        const k = exits.indexOf(Math.min(...exits));
        if (k === 0) x = c.x0 - PLAYER_RADIUS;
        else if (k === 1) x = c.x1 + PLAYER_RADIUS;
        else if (k === 2) z = c.z0 - PLAYER_RADIUS;
        else z = c.z1 + PLAYER_RADIUS;
      }
      moved = true;
    }
    for (const o of obstacles) {
      // Floors have steps you can climb; furniture does not, so anything taller than a rug is in the way.
      if (o.y1 <= feetY + RUG || o.y0 >= hi) continue;
      // Work in the box's own frame, where it is axis-aligned, then turn the answer back.
      const wx = x - o.x, wz = z - o.z;
      let lx = wx * o.cos - wz * o.sin;
      let lz = wx * o.sin + wz * o.cos;
      const nx = Math.max(-o.hw, Math.min(lx, o.hw));
      const nz = Math.max(-o.hd, Math.min(lz, o.hd));
      const dx = lx - nx, dz = lz - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= PLAYER_RADIUS * PLAYER_RADIUS) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        lx = nx + (dx / d) * PLAYER_RADIUS;
        lz = nz + (dz / d) * PLAYER_RADIUS;
      } else {
        const exits = [lx + o.hw, o.hw - lx, lz + o.hd, o.hd - lz];
        const k = exits.indexOf(Math.min(...exits));
        if (k === 0) lx = -o.hw - PLAYER_RADIUS;
        else if (k === 1) lx = o.hw + PLAYER_RADIUS;
        else if (k === 2) lz = -o.hd - PLAYER_RADIUS;
        else lz = o.hd + PLAYER_RADIUS;
      }
      x = o.x + lx * o.cos + lz * o.sin;
      z = o.z - lx * o.sin + lz * o.cos;
      moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}

/** Which storey a given feet height belongs to. */
export function levelAt(feetY: number): number {
  let level = 0;
  for (const l of LEVELS) if (feetY >= l.elevation - 0.6) level = l.index;
  return level;
}

/** Room containing a point, counting someone part-way up a flight as on the stairs. */
export function roomAtHeight(x: number, z: number, feetY: number): Room | undefined {
  const level = levelAt(feetY);
  const hit = (l: number) => ROOMS.find((r) => r.level === l && pointInPolygon(x, z, r.polygon));
  return hit(level) ?? (level > 0 ? hit(level - 1) : undefined);
}

// Lets the movement rules be exercised from the browser console during development.
if (import.meta.env?.DEV) {
  (globalThis as unknown as { __walk: object }).__walk = { resolveCollisions, groundAt, obstacles: () => obstacles };
}
