/**
 * Turns the plan data into renderable surfaces. Pure data in, plain arrays out —
 * no three.js here, so the same module can be exercised from Node.
 *
 * Every wall face is split by the room it looks into, which is what lets each
 * room's walls (and each individual wall) carry its own material.
 */
import earcut from 'earcut';
import {
  CLEAR, CONTEXT, F2F, LEVELS, RAILINGS, ROOMS, SLABS, STAIRS, WALLS,
  groupOf, pointInPolygon, roomAt,
} from './apartment.ts';
import type { Opening, Room, Wall } from './types.ts';

export type SurfaceKind =
  | 'floor' | 'ceiling' | 'wall' | 'facade' | 'tread' | 'riser' | 'stairBody' | 'slab'
  | 'cut' | 'trim' | 'threshold' | 'frame' | 'doorFrame' | 'door' | 'glass' | 'rail' | 'context'
  | 'shade' | 'shadeCeiling';

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  /** RGBA per vertex; only the corner-shading strips carry it. */
  colors: number[];
}

export interface Surface {
  key: string;
  kind: SurfaceKind;
  level: number;
  /** For slabs: the level this slab forms the lid of. */
  capOf?: number | null;
  roomId?: string;
  group?: string;
  label: string;
  /** Whether the user can pick it and change its material. */
  selectable: boolean;
  mesh: MeshData;
}

type V3 = [number, number, number];

/** Finishes sit a few millimetres proud of the structure so they never z-fight with it. */
const FIN = 0.004;
const EPS = 0.01;
/** Corner shading: how far it reaches from a junction, how dark it is there, how far it floats off the surface. */
const SHADE_REACH = 0.45;
const SHADE_DEPTH = 0.36;
const SHADE_LIFT = 0.003;

/** World-scale UVs: one texture unit is one metre, whatever the face orientation. */
function uvFor(p: V3, n: V3): [number, number] {
  if (Math.abs(n[1]) > 0.5) return [p[0], p[2]];
  if (Math.abs(n[0]) > 0.5) return [p[2], p[1]];
  return [p[0], p[1]];
}

class Mesh implements MeshData {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];
  colors: number[] = [];

  /**
   * A soft dark band along the edge a–b, fading out over SHADE_REACH in the
   * direction `fade` on a surface facing `n`. Baked stand-in for ambient
   * occlusion: the darkening you get where two surfaces meet.
   */
  strip(a: V3, b: V3, fade: V3, n: V3, strength = SHADE_DEPTH, reach = SHADE_REACH): void {
    const base = this.positions.length / 3;
    // Three rows give the fade a curve instead of a straight ramp.
    for (const [t, alpha] of [[0, strength], [reach * 0.4, strength * 0.46], [reach, 0]]) {
      for (const p of [a, b]) {
        this.positions.push(p[0] + fade[0] * t + n[0] * SHADE_LIFT, p[1] + fade[1] * t + n[1] * SHADE_LIFT, p[2] + fade[2] * t + n[2] * SHADE_LIFT);
        this.normals.push(n[0], n[1], n[2]);
        this.uvs.push(0, 0);
        this.colors.push(0, 0, 0, alpha);
      }
    }
    const e: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const facing =
      (e[1] * fade[2] - e[2] * fade[1]) * n[0] + (e[2] * fade[0] - e[0] * fade[2]) * n[1] + (e[0] * fade[1] - e[1] * fade[0]) * n[2];
    for (let r = 0; r < 2; r++) {
      const i = base + r * 2;
      if (facing >= 0) this.indices.push(i, i + 1, i + 3, i, i + 3, i + 2);
      else this.indices.push(i, i + 3, i + 1, i, i + 2, i + 3);
    }
  }

  /** Planar polygon (optionally with holes), triangulated and wound to face `n`. */
  poly(ring: V3[], n: V3, holes: V3[][] = []): void {
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    let u = 0, v = 2;
    if (ax >= ay && ax >= az) { u = 2; v = 1; } else if (az >= ay) { u = 0; v = 1; }

    const pts: V3[] = [];
    const flat: number[] = [];
    const holeStart: number[] = [];
    [ring, ...holes].forEach((r, k) => {
      if (k > 0) holeStart.push(pts.length);
      for (const p of r) { pts.push(p); flat.push(p[u], p[v]); }
    });
    const tris = earcut(flat, holeStart, 2);
    const base = this.positions.length / 3;
    for (const p of pts) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
      const uv = uvFor(p, n);
      this.uvs.push(uv[0], uv[1]);
    }
    for (let i = 0; i < tris.length; i += 3) {
      const a = pts[tris[i]], b = pts[tris[i + 1]], c = pts[tris[i + 2]];
      const e1: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const d =
        (e1[1] * e2[2] - e1[2] * e2[1]) * n[0] +
        (e1[2] * e2[0] - e1[0] * e2[2]) * n[1] +
        (e1[0] * e2[1] - e1[1] * e2[0]) * n[2];
      if (d >= 0) this.indices.push(base + tris[i], base + tris[i + 1], base + tris[i + 2]);
      else this.indices.push(base + tris[i], base + tris[i + 2], base + tris[i + 1]);
    }
  }

  /** Vertical rectangle on the plane x = c or z = c. */
  vface(plane: 'x' | 'z', c: number, a: number, b: number, y0: number, y1: number, sign: number): void {
    if (b - a < 1e-6 || y1 - y0 < 1e-6) return;
    const P = (r: number, y: number): V3 => (plane === 'x' ? [c, y, r] : [r, y, c]);
    this.poly([P(a, y0), P(b, y0), P(b, y1), P(a, y1)], plane === 'x' ? [sign, 0, 0] : [0, 0, sign]);
  }

  /** Horizontal rectangle at height y, facing up (sign 1) or down (sign -1). */
  hface(x0: number, z0: number, x1: number, z1: number, y: number, sign: number): void {
    if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) return;
    this.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, sign, 0]);
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.vface('x', x0, z0, z1, y0, y1, -1);
    this.vface('x', x1, z0, z1, y0, y1, 1);
    this.vface('z', z0, x0, x1, y0, y1, -1);
    this.vface('z', z1, x0, x1, y0, y1, 1);
    this.hface(x0, z0, x1, z1, y1, 1);
    this.hface(x0, z0, x1, z1, y0, -1);
  }
}

export const wallHeight = (w: Wall): number => w.height ?? CLEAR;
export const isAlongX = (w: Wall): boolean => w.rect[2] - w.rect[0] >= w.rect[3] - w.rect[1];

const uniqSorted = (values: number[]): number[] =>
  [...values].sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 1e-6);

export function buildSurfaces(): Surface[] {
  const surfaces = new Map<string, Surface & { mesh: Mesh }>();
  const surf = (key: string, init: Omit<Surface, 'key' | 'mesh'>): Mesh => {
    let s = surfaces.get(key);
    if (!s) {
      s = { key, ...init, mesh: new Mesh() };
      surfaces.set(key, s);
    }
    return s.mesh;
  };

  const levelName = (level: number) => LEVELS[level].name;
  const fixed = (key: string, kind: SurfaceKind, level: number, label: string): Mesh =>
    surf(key, { kind, level, label, selectable: false });

  // ───────────── Walls ─────────────
  for (const level of LEVELS) {
    const walls = WALLS.filter((w) => w.level === level.index);
    const rooms = ROOMS.filter((r) => r.level === level.index);
    // Faces can only change what they look onto at these coordinates.
    const breaksX = [...walls.flatMap((w) => [w.rect[0], w.rect[2]]), ...rooms.flatMap((r) => r.polygon.map((p) => p[0]))];
    const breaksZ = [...walls.flatMap((w) => [w.rect[1], w.rect[3]]), ...rooms.flatMap((r) => r.polygon.map((p) => p[1]))];
    const y0 = level.elevation;

    for (const w of walls) {
      const [x0, z0, x1, z1] = w.rect;
      const h = wallHeight(w);
      const y1 = y0 + h;
      const alongX = isAlongX(w);
      const openings = [...(w.openings ?? [])].sort((a, b) => a.from - b.from);

      /** What a point just outside a face looks onto: a room, the outdoors, or another wall. */
      const classify = (px: number, pz: number): Room | 'ext' | null => {
        for (const o of walls) {
          if (o === w || wallHeight(o) < h - 1e-6) continue;
          if (px > o.rect[0] && px < o.rect[2] && pz > o.rect[1] && pz < o.rect[3]) return null;
        }
        return roomAt(level.index, px, pz) ?? 'ext';
      };

      const sides = [
        { name: 'n', plane: 'z' as const, c: z0, sign: -1, a: x0, b: x1, long: alongX },
        { name: 's', plane: 'z' as const, c: z1, sign: 1, a: x0, b: x1, long: alongX },
        { name: 'w', plane: 'x' as const, c: x0, sign: -1, a: z0, b: z1, long: !alongX },
        { name: 'e', plane: 'x' as const, c: x1, sign: 1, a: z0, b: z1, long: !alongX },
      ];

      for (const side of sides) {
        const breaks = side.plane === 'z' ? breaksX : breaksZ;
        const cuts = uniqSorted([side.a, side.b, ...breaks.filter((v) => v > side.a + 1e-6 && v < side.b - 1e-6)]);
        const runs: { a: number; b: number; cls: Room | 'ext' | null }[] = [];
        for (let i = 0; i + 1 < cuts.length; i++) {
          const mid = (cuts[i] + cuts[i + 1]) / 2;
          const off = side.c + side.sign * EPS;
          const cls = side.plane === 'z' ? classify(mid, off) : classify(off, mid);
          const last = runs[runs.length - 1];
          if (last && last.cls === cls) last.b = cuts[i + 1];
          else runs.push({ a: cuts[i], b: cuts[i + 1], cls });
        }

        for (const run of runs) {
          if (run.cls === null) continue;
          const mesh =
            run.cls === 'ext'
              ? surf(`facade/${level.index}`, {
                  kind: 'facade', level: level.index, label: `Facade · ${level.name}`, selectable: true,
                })
              : surf(`wall/${run.cls.id}/${w.id}.${side.name}`, {
                  kind: 'wall', level: level.index, roomId: run.cls.id, group: groupOf(run.cls),
                  label: `Wall · ${run.cls.name}`, selectable: true,
                });

          // Corner shading where this face meets the room's floor, ceiling and neighbouring walls.
          const room = run.cls === 'ext' ? null : run.cls;
          const N: V3 = side.plane === 'x' ? [side.sign, 0, 0] : [0, 0, side.sign];
          const P = (r: number, y: number): V3 => (side.plane === 'x' ? [side.c, y, r] : [r, y, side.c]);
          const top = Math.min(y1, y0 + CLEAR);
          const ceiled = !!room && room.ceiling !== false && !room.outdoor && h >= CLEAR - 1e-6;
          const shadeSpan = (a: number, b: number, atFloor: boolean, atCeiling: boolean) => {
            if (!room || b - a < 0.05) return;
            if (atFloor) {
              const shade = fixed(`shade/${level.index}`, 'shade', level.index, 'Corner shading');
              if (room.floor !== false) shade.strip(P(a, y0 + FIN), P(b, y0 + FIN), N, [0, 1, 0]);
              shade.strip(P(a, y0), P(b, y0), [0, 1, 0], N);
            }
            if (atCeiling && ceiled) {
              const shade = fixed(`shadeCeiling/${level.index}`, 'shadeCeiling', level.index, 'Corner shading');
              shade.strip(P(a, top - FIN), P(b, top - FIN), N, [0, -1, 0]);
              shade.strip(P(a, top), P(b, top), [0, -1, 0], N);
            }
          };

          let cursor = run.a;
          if (side.long) {
            for (const o of openings) {
              const from = Math.max(o.from, run.a);
              const to = Math.min(o.to, run.b);
              if (to - from < 1e-6) continue;
              mesh.vface(side.plane, side.c, cursor, from, y0, y1, side.sign);
              mesh.vface(side.plane, side.c, from, to, y0, y0 + o.sill, side.sign);
              mesh.vface(side.plane, side.c, from, to, y0 + o.head, y1, side.sign);
              shadeSpan(cursor, from, true, true);
              shadeSpan(from, to, o.sill > SHADE_REACH, y1 - (y0 + o.head) > SHADE_REACH);
              cursor = to;
            }
          }
          mesh.vface(side.plane, side.c, cursor, run.b, y0, y1, side.sign);
          shadeSpan(cursor, run.b, true, true);

          // Inside corners: the face runs into another wall at this end.
          if (room) {
            const corner = (r: number, beyond: number, into: number) => {
              const off = side.c + side.sign * EPS;
              const blocked = side.plane === 'z' ? classify(beyond, off) : classify(off, beyond);
              const open = side.long && openings.some((o) => o.from < Math.max(r, r + into * SHADE_REACH) && o.to > Math.min(r, r + into * SHADE_REACH));
              if (blocked !== null || open) return;
              const fade: V3 = side.plane === 'x' ? [0, 0, into] : [into, 0, 0];
              fixed(`shade/${level.index}`, 'shade', level.index, 'Corner shading').strip(P(r, y0), P(r, top), fade, N);
            };
            corner(run.a, run.a - 0.02, 1);
            corner(run.b, run.b + 0.02, -1);
          }
        }
      }

      // Section face on top of the wall — seen when the storey above is hidden.
      fixed(`cut/${level.index}`, 'cut', level.index, 'Wall section').hface(x0, z0, x1, z1, y1, 1);

      // Reveals inside each opening, then whatever fills it.
      const trim = fixed(`trim/${level.index}`, 'trim', level.index, 'Reveals');
      for (const o of openings) {
        const ya = y0 + o.sill, yb = y0 + o.head;
        if (alongX) {
          trim.vface('x', o.from, z0, z1, ya, yb, 1);
          trim.vface('x', o.to, z0, z1, ya, yb, -1);
          if (o.head < h) trim.hface(o.from, z0, o.to, z1, yb, -1);
          if (o.sill > 0) trim.hface(o.from, z0, o.to, z1, ya, 1);
          else fixed(`threshold/${level.index}`, 'threshold', level.index, 'Thresholds').hface(o.from, z0, o.to, z1, y0 + FIN, 1);
        } else {
          trim.vface('z', o.from, x0, x1, ya, yb, 1);
          trim.vface('z', o.to, x0, x1, ya, yb, -1);
          if (o.head < h) trim.hface(x0, o.from, x1, o.to, yb, -1);
          if (o.sill > 0) trim.hface(x0, o.from, x1, o.to, ya, 1);
          else fixed(`threshold/${level.index}`, 'threshold', level.index, 'Thresholds').hface(x0, o.from, x1, o.to, y0 + FIN, 1);
        }
        buildOpeningFill(w, o, alongX, y0, level.index, fixed);
      }
    }
  }

  // ───────────── Floor and ceiling finishes ─────────────
  for (const r of ROOMS) {
    const y = LEVELS[r.level].elevation;
    if (r.floor !== false) {
      surf(`floor/${r.id}`, {
        kind: 'floor', level: r.level, roomId: r.id, group: groupOf(r), label: `Floor · ${r.name}`, selectable: true,
      }).poly(r.polygon.map(([x, z]): V3 => [x, y + FIN, z]), [0, 1, 0]);
    }
    if (r.ceiling !== false && !r.outdoor) {
      surf(`ceiling/${r.id}`, {
        kind: 'ceiling', level: r.level, roomId: r.id, group: groupOf(r), label: `Ceiling · ${r.name}`, selectable: true,
      }).poly((r.ceilingPolygon ?? r.polygon).map(([x, z]): V3 => [x, y + CLEAR - FIN, z]), [0, -1, 0]);
    }
  }

  // ───────────── Slabs ─────────────
  for (const s of SLABS) {
    const mesh = surf(`slab/${s.id}`, {
      kind: 'slab', level: s.level, capOf: s.capOf, label: s.name, selectable: false,
    });
    const yt = s.top, yb = s.top - s.thickness;
    const holes = s.holes ?? [];
    const at = (ring: readonly (readonly [number, number])[], y: number) => ring.map(([x, z]): V3 => [x, y, z]);
    mesh.poly(at(s.outline, yt), [0, 1, 0], holes.map((hl) => at(hl, yt)));
    mesh.poly(at(s.outline, yb), [0, -1, 0], holes.map((hl) => at(hl, yb)));
    const solidAt = (x: number, z: number) =>
      pointInPolygon(x, z, s.outline) && !holes.some((hl) => pointInPolygon(x, z, hl));
    for (const ring of [s.outline, ...holes]) {
      for (let i = 0; i < ring.length; i++) {
        const [px, pz] = ring[i];
        const [qx, qz] = ring[(i + 1) % ring.length];
        const len = Math.hypot(qx - px, qz - pz);
        let nx = (qz - pz) / len, nz = -(qx - px) / len;
        if (solidAt((px + qx) / 2 + nx * EPS, (pz + qz) / 2 + nz * EPS)) { nx = -nx; nz = -nz; }
        mesh.poly([[px, yb, pz], [qx, yb, qz], [qx, yt, qz], [px, yt, pz]], [nx, 0, nz]);
      }
    }
  }

  // ───────────── Stairs ─────────────
  for (const st of STAIRS) {
    const y0 = LEVELS[st.level].elevation;
    const dir = Math.sign(st.zTop - st.zBottom);
    const n = st.risers;
    const tread = Math.abs(st.zTop - st.zBottom) / (n - 1);
    const rise = F2F / n;
    const waist = 0.2;
    const zAt = (s: number) => st.zBottom + dir * s;
    const meta = { level: st.level, roomId: undefined, group: undefined };
    const treads = surf(`stair/${st.id}/treads`, { ...meta, kind: 'tread', label: `Treads · ${st.name}`, selectable: true });
    const risers = surf(`stair/${st.id}/risers`, { ...meta, kind: 'riser', label: `Risers · ${st.name}`, selectable: true });
    const body = surf(`stair/${st.id}/body`, { ...meta, kind: 'stairBody', label: st.name, selectable: false });

    for (let k = 0; k < n; k++) {
      const z = zAt(k * tread);
      risers.vface('z', z, st.x0, st.x1, y0 + k * rise, y0 + (k + 1) * rise, -dir);
      if (k < n - 1) {
        const zn = zAt((k + 1) * tread);
        treads.hface(st.x0, Math.min(z, zn), st.x1, Math.max(z, zn), y0 + (k + 1) * rise, 1);
      }
    }

    // Side profile: sawtooth on top, sloping soffit underneath.
    const run = (n - 1) * tread;
    const profile: [number, number][] = [[0, 0]];
    for (let k = 0; k < n; k++) {
      profile.push([k * tread, (k + 1) * rise]);
      if (k < n - 1) profile.push([(k + 1) * tread, (k + 1) * rise]);
    }
    const soffitTop: [number, number] = [run, F2F - rise - waist];
    const soffitFoot: [number, number] = [(waist * tread) / rise, 0];
    profile.push(soffitTop, soffitFoot);
    for (const [x, sign] of [[st.x0, -1], [st.x1, 1]] as const) {
      body.poly(profile.map(([s, y]): V3 => [x, y0 + y, zAt(s)]), [sign, 0, 0]);
    }
    const slope = Math.hypot(rise, tread);
    body.poly(
      [
        [st.x0, y0 + soffitFoot[1], zAt(soffitFoot[0])], [st.x1, y0 + soffitFoot[1], zAt(soffitFoot[0])],
        [st.x1, y0 + soffitTop[1], zAt(soffitTop[0])], [st.x0, y0 + soffitTop[1], zAt(soffitTop[0])],
      ],
      [0, -tread / slope, (dir * rise) / slope],
    );
    body.vface('z', zAt(run), st.x0, st.x1, y0 + soffitTop[1], y0 + F2F - rise, dir);
  }

  // ───────────── Balcony balustrades ─────────────
  for (const r of RAILINGS) {
    const y0 = LEVELS[r.level].elevation;
    const [x0, z0, x1, z1] = r.rect;
    const thin = 0.012;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const glass = fixed(`glass/${r.level}`, 'glass', r.level, 'Glass');
    if (x1 - x0 < z1 - z0) glass.box(cx - thin, y0 + 0.02, z0, cx + thin, y0 + r.height - 0.04, z1);
    else glass.box(x0, y0 + 0.02, cz - thin, x1, y0 + r.height - 0.04, cz + thin);
    fixed(`rail/${r.level}`, 'rail', r.level, 'Railing').box(x0, y0 + r.height - 0.04, z0, x1, y0 + r.height, z1);
  }

  // ───────────── Neighbouring volumes ─────────────
  const context = fixed('context', 'context', 0, 'Neighbouring units');
  for (const c of CONTEXT) context.box(c.rect[0], c.y0, c.rect[1], c.rect[2], c.y1, c.rect[3]);

  return [...surfaces.values()].filter((s) => s.mesh.indices.length > 0);
}

/** Frames, glazing and door linings. */
function buildOpeningFill(
  w: Wall,
  o: Opening,
  alongX: boolean,
  y0: number,
  level: number,
  fixed: (key: string, kind: SurfaceKind, level: number, label: string) => Mesh,
): void {
  const [x0, z0, x1, z1] = w.rect;
  const v0 = alongX ? z0 : x0;
  const v1 = alongX ? z1 : x1;
  const c = (v0 + v1) / 2;
  /** Box given along-wall extent, across-wall extent and height. */
  const put = (m: Mesh, ua: number, ub: number, va: number, vb: number, ya: number, yb: number) => {
    if (alongX) m.box(ua, ya, va, ub, yb, vb);
    else m.box(va, ya, ua, vb, yb, ub);
  };
  const ya = y0 + o.sill, yb = y0 + o.head;
  const mid = (o.from + o.to) / 2;

  if (o.kind === 'window' || o.kind === 'balconyDoor') {
    const frame = fixed(`frame/${level}`, 'frame', level, 'Window frames');
    const glass = fixed(`glass/${level}`, 'glass', level, 'Glass');
    const fw = 0.06, fd = 0.035, bottom = o.kind === 'window' ? fw : 0.03;
    put(frame, o.from, o.from + fw, c - fd, c + fd, ya, yb);
    put(frame, o.to - fw, o.to, c - fd, c + fd, ya, yb);
    put(frame, o.from + fw, o.to - fw, c - fd, c + fd, yb - fw, yb);
    put(frame, o.from + fw, o.to - fw, c - fd, c + fd, ya, ya + bottom);
    put(frame, mid - 0.035, mid + 0.035, c - fd, c + fd, ya + bottom, yb - fw);
    // Balcony doors stand half open: one leaf glazed, the other left clear to walk through.
    put(glass, o.from + fw, mid - 0.035, c - 0.01, c + 0.01, ya + bottom, yb - fw);
    if (o.kind === 'window') put(glass, mid + 0.035, o.to - fw, c - 0.01, c + 0.01, ya + bottom, yb - fw);
  } else if (o.kind === 'door') {
    const lining = fixed(`doorFrame/${level}`, 'doorFrame', level, 'Door linings');
    const t = 0.03, proud = 0.012;
    put(lining, o.from, o.from + t, v0 - proud, v1 + proud, ya, yb);
    put(lining, o.to - t, o.to, v0 - proud, v1 + proud, ya, yb);
    put(lining, o.from + t, o.to - t, v0 - proud, v1 + proud, yb - t, yb);
  } else {
    const frame = fixed(`frame/${level}`, 'frame', level, 'Window frames');
    const fw = 0.06, fd = 0.045;
    put(frame, o.from, o.from + fw, c - fd, c + fd, ya, yb);
    put(frame, o.to - fw, o.to, c - fd, c + fd, ya, yb);
    put(frame, o.from + fw, o.to - fw, c - fd, c + fd, yb - fw, yb);
    put(fixed(`door/${level}`, 'door', level, 'Entrance door'), o.from + fw, o.to - fw, c - 0.025, c + 0.025, ya, yb - fw);
  }
}
