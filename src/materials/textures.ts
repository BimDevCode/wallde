/**
 * Procedural surface textures drawn on canvases at start-up — no image files to
 * ship or license. Every generator produces a seamlessly tiling colour map and,
 * where it helps, a height map for relief (grout lines, plank joints, mortar).
 */

export interface TextureCanvases {
  color: HTMLCanvasElement;
  bump?: HTMLCanvasElement;
}

type RGB = [number, number, number];
type Ctx = CanvasRenderingContext2D;

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

const css = ([r, g, b]: RGB, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Smooth noise that repeats exactly over the unit square. */
function tileNoise(seed: number, cellsX: number, cellsY: number, octaves: number): (u: number, v: number) => number {
  const layers: { cx: number; cy: number; grid: Float32Array }[] = [];
  const r = rng(seed);
  for (let o = 0; o < octaves; o++) {
    const cx = cellsX << o, cy = cellsY << o;
    const grid = new Float32Array(cx * cy);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    layers.push({ cx, cy, grid });
  }
  return (u, v) => {
    let sum = 0, amp = 0.5, norm = 0;
    for (const { cx, cy, grid } of layers) {
      const x = u * cx, y = v * cy;
      const xi = Math.floor(x), yi = Math.floor(y);
      const fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const x0 = ((xi % cx) + cx) % cx, x1 = (x0 + 1) % cx;
      const y0 = ((yi % cy) + cy) % cy, y1 = (y0 + 1) % cy;
      const a = grid[y0 * cx + x0], b = grid[y0 * cx + x1], c = grid[y1 * cx + x0], d = grid[y1 * cx + x1];
      sum += (a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

/** Small grey canvas of noise, cheap to stretch over a big one as a blend layer. */
function noiseLayer(size: number, fn: (u: number, v: number) => number, lo = 0, hi = 255): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const g = lo + (hi - lo) * fn(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function blend(ctx: Ctx, layer: HTMLCanvasElement, mode: GlobalCompositeOperation, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.drawImage(layer, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Fine random speckle, tiled across the canvas. */
function speckle(ctx: Ctx, seed: number, alpha: number): void {
  const r = rng(seed);
  blend(ctx, noiseLayer(256, () => r(), 60, 195), 'overlay', alpha);
}

/** Runs a drawing routine at every wrap offset so shapes crossing an edge reappear opposite. */
function wrapped(ctx: Ctx, draw: () => void): void {
  const { width: w, height: h } = ctx.canvas;
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      ctx.save();
      ctx.translate(dx, dy);
      draw();
      ctx.restore();
    }
  }
}

// ───────────── Wood ─────────────

interface PlankOptions {
  seed: number;
  rows: number;
  palette: RGB[];
  /** Gap between boards in px; 0 for tight parquet joints. */
  gap?: number;
  grain?: number;
  vertical?: boolean;
  gapColor?: string;
}

function planks(size: number, o: PlankOptions): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  const [bump, bctx] = makeCanvas(size, size);
  const r = rng(o.seed);
  const gap = o.gap ?? 0;
  bctx.fillStyle = '#fff';
  bctx.fillRect(0, 0, size, size);
  if (o.vertical) {
    for (const c of [ctx, bctx]) {
      c.translate(size / 2, size / 2);
      c.rotate(Math.PI / 2);
      c.translate(-size / 2, -size / 2);
    }
  }
  const rowH = size / o.rows;

  for (let row = 0; row < o.rows; row++) {
    const y0 = row * rowH, y1 = y0 + rowH;
    const j1 = r() * size;
    const joints = [j1, j1 + size * (0.38 + r() * 0.24), j1 + size];
    for (let p = 0; p < 2; p++) {
      const x0 = joints[p], x1 = joints[p + 1];
      const base = shade(o.palette[Math.floor(r() * o.palette.length)], 0.92 + r() * 0.16);
      const streaks = Array.from({ length: Math.round((o.grain ?? 1) * 46) }, () => ({
        y: y0 + r() * rowH,
        amp: 0.6 + r() * 2.2,
        len: 180 + r() * 420,
        phase: r() * 6.28,
        dark: r() < 0.62,
        alpha: 0.03 + r() * 0.09,
        width: 0.6 + r() * 1.6,
      }));
      for (const dx of [0, -size]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 + dx, y0, x1 - x0, rowH);
        ctx.clip();
        ctx.fillStyle = css(base);
        ctx.fillRect(x0 + dx, y0, x1 - x0, rowH);
        for (const s of streaks) {
          ctx.strokeStyle = s.dark ? css(shade(base, 0.55), s.alpha) : css(mix(base, [255, 250, 235], 0.6), s.alpha);
          ctx.lineWidth = s.width;
          ctx.beginPath();
          for (let x = x0 + dx; x <= x1 + dx + 24; x += 24) {
            const y = s.y + Math.sin((x - dx) / s.len * 6.28 + s.phase) * s.amp;
            if (x === x0 + dx) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
        // End joint
        for (const [c, style, lw] of [[ctx, o.gapColor ?? 'rgba(20,12,6,0.5)', Math.max(1.2, gap)], [bctx, '#222', Math.max(2.5, gap + 1)]] as const) {
          c.strokeStyle = style;
          c.lineWidth = lw;
          c.beginPath();
          c.moveTo(x0 + dx, y0);
          c.lineTo(x0 + dx, y1);
          c.stroke();
        }
      }
    }
    for (const [c, style, lw] of [[ctx, o.gapColor ?? 'rgba(20,12,6,0.55)', Math.max(1.4, gap)], [bctx, '#1a1a1a', Math.max(3, gap + 1.5)]] as const) {
      c.strokeStyle = style;
      c.lineWidth = lw;
      for (const y of row === 0 ? [0, size] : [y0]) {
        c.beginPath();
        c.moveTo(-size, y);
        c.lineTo(size * 2, y);
        c.stroke();
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  blend(ctx, noiseLayer(128, tileNoise(o.seed + 7, 3, 3, 3), 90, 165), 'soft-light', 0.55);
  return { color, bump };
}

function basketParquet(size: number): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  const [bump, bctx] = makeCanvas(size, size);
  const r = rng(41);
  bctx.fillStyle = '#fff';
  bctx.fillRect(0, 0, size, size);
  const mod = size / 2, strips = 4, sw = mod / strips;
  const palette: RGB[] = [[176, 131, 84], [164, 118, 72], [188, 145, 97], [171, 124, 79]];
  for (let my = 0; my < 2; my++) {
    for (let mx = 0; mx < 2; mx++) {
      const horizontal = (mx + my) % 2 === 0;
      for (let s = 0; s < strips; s++) {
        const base = shade(palette[Math.floor(r() * palette.length)], 0.93 + r() * 0.14);
        const x = mx * mod + (horizontal ? 0 : s * sw);
        const y = my * mod + (horizontal ? s * sw : 0);
        const w = horizontal ? mod : sw, h = horizontal ? sw : mod;
        ctx.fillStyle = css(base);
        ctx.fillRect(x, y, w, h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        for (let g = 0; g < 16; g++) {
          ctx.strokeStyle = css(shade(base, r() < 0.6 ? 0.62 : 1.25), 0.05 + r() * 0.08);
          ctx.lineWidth = 0.6 + r() * 1.4;
          ctx.beginPath();
          if (horizontal) { const gy = y + r() * h; ctx.moveTo(x, gy); ctx.lineTo(x + w, gy + (r() - 0.5) * 3); }
          else { const gx = x + r() * w; ctx.moveTo(gx, y); ctx.lineTo(gx + (r() - 0.5) * 3, y + h); }
          ctx.stroke();
        }
        ctx.restore();
        for (const [c, style, lw] of [[ctx, 'rgba(25,14,6,0.55)', 1.4], [bctx, '#222', 3]] as const) {
          c.strokeStyle = style;
          c.lineWidth = lw;
          c.strokeRect(x, y, w, h);
        }
      }
    }
  }
  return { color, bump };
}

function slats(size: number): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  const [bump, bctx] = makeCanvas(size, size);
  const r = rng(77);
  const n = 8, mod = size / n, gapW = mod * 0.28;
  ctx.fillStyle = '#181614';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const x = i * mod + gapW / 2, w = mod - gapW;
    const base = shade([186, 142, 96], 0.9 + r() * 0.2);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, css(shade(base, 0.78)));
    grad.addColorStop(0.18, css(base));
    grad.addColorStop(0.82, css(base));
    grad.addColorStop(1, css(shade(base, 0.7)));
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, size);
    for (let g = 0; g < 14; g++) {
      ctx.strokeStyle = css(shade(base, r() < 0.6 ? 0.6 : 1.2), 0.05 + r() * 0.08);
      ctx.lineWidth = 0.6 + r() * 1.2;
      const gx = x + r() * w;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, size);
      ctx.stroke();
    }
    bctx.fillStyle = '#fff';
    bctx.fillRect(x, 0, w, size);
  }
  return { color, bump };
}

// ───────────── Tile and stone ─────────────

interface TileOptions {
  seed: number;
  nx: number;
  ny: number;
  grout: number;
  groutColor: string;
  /** Row offset as a fraction of a tile, for running bond. */
  offset?: number;
  tile: (i: number, j: number, r: () => number) => RGB;
  /** Painted over each tile after its base colour. */
  detail?: (ctx: Ctx, x: number, y: number, w: number, h: number, base: RGB, r: () => number) => void;
  bumpTile?: string;
  bumpGrout?: string;
}

function tiles(size: number, o: TileOptions): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  const [bump, bctx] = makeCanvas(size, size);
  const r = rng(o.seed);
  ctx.fillStyle = o.groutColor;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = o.bumpGrout ?? '#2a2a2a';
  bctx.fillRect(0, 0, size, size);
  const tw = size / o.nx, th = size / o.ny, g = o.grout / 2;
  for (let j = 0; j < o.ny; j++) {
    const shift = (j % 2) * (o.offset ?? 0) * tw;
    for (let i = 0; i < o.nx; i++) {
      const base = o.tile(i, j, r);
      const seedState = r();
      for (const dx of shift > 0 ? [0, -size] : [0]) {
        const x = i * tw + shift + dx + g, y = j * th + g, w = tw - 2 * g, h = th - 2 * g;
        ctx.fillStyle = css(base);
        ctx.fillRect(x, y, w, h);
        if (o.detail) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          o.detail(ctx, x, y, w, h, base, rng(Math.floor(seedState * 1e9)));
          ctx.restore();
        }
        bctx.fillStyle = o.bumpTile ?? '#fff';
        bctx.fillRect(x, y, w, h);
      }
    }
  }
  return { color, bump };
}

function veins(ctx: Ctx, seed: number, count: number, tone: RGB, strength = 1): void {
  const { width: w } = ctx.canvas;
  const r = rng(seed);
  const paths = Array.from({ length: count }, () => {
    let x = r() * w, y = r() * w, a = 0.5 + (r() - 0.5) * 1.3;
    const pts: [number, number][] = [[x, y]];
    const steps = 30 + Math.floor(r() * 60);
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * 0.5;
      x += Math.cos(a) * 14;
      y += Math.sin(a) * 14;
      pts.push([x, y]);
    }
    return { pts, width: 0.7 + r() * 2.2, alpha: (0.18 + r() * 0.32) * strength };
  });
  wrapped(ctx, () => {
    for (const p of paths) {
      for (const [mul, a] of [[7, 0.12], [3, 0.3], [1, 1]] as const) {
        ctx.strokeStyle = css(tone, p.alpha * a);
        ctx.lineWidth = p.width * mul;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
  });
}

function marble(size: number): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#efede8';
  ctx.fillRect(0, 0, size, size);
  blend(ctx, noiseLayer(256, tileNoise(5, 3, 3, 4), 70, 200), 'soft-light', 0.5);
  veins(ctx, 11, 9, [96, 100, 108]);
  veins(ctx, 12, 14, [150, 146, 138], 0.6);
  // Slab joints: two by two.
  const [bump, bctx] = makeCanvas(size, size);
  bctx.fillStyle = '#fff';
  bctx.fillRect(0, 0, size, size);
  for (const [c, style, lw] of [[ctx, 'rgba(90,90,92,0.55)', 2], [bctx, '#333', 4]] as const) {
    c.strokeStyle = style;
    c.lineWidth = lw;
    for (const p of [0, size / 2, size]) {
      c.beginPath();
      c.moveTo(p, 0); c.lineTo(p, size);
      c.moveTo(0, p); c.lineTo(size, p);
      c.stroke();
    }
  }
  return { color, bump };
}

function terrazzo(size: number): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  const r = rng(23);
  ctx.fillStyle = '#ddd8cd';
  ctx.fillRect(0, 0, size, size);
  const palette: RGB[] = [[138, 143, 147], [201, 183, 156], [92, 85, 80], [183, 105, 79], [240, 235, 226], [154, 165, 155], [70, 82, 96]];
  const chips = Array.from({ length: 900 }, () => {
    const cx = r() * size, cy = r() * size, rad = 2 + r() * r() * 15, n = 5 + Math.floor(r() * 3);
    const rot = r() * 6.28;
    const pts = Array.from({ length: n }, (_, i): [number, number] => {
      const a = rot + (i / n) * 6.28, d = rad * (0.6 + r() * 0.5);
      return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
    });
    return { pts, color: css(shade(palette[Math.floor(r() * palette.length)], 0.9 + r() * 0.2)) };
  });
  wrapped(ctx, () => {
    for (const chip of chips) {
      ctx.fillStyle = chip.color;
      ctx.beginPath();
      chip.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }
  });
  speckle(ctx, 24, 0.25);
  return { color };
}

function cloudy(size: number, base: RGB, seed: number, contrast: number, pinholes = 0): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, size, size);
  const layer = noiseLayer(256, tileNoise(seed, 3, 3, 5), 128 - contrast, 128 + contrast);
  blend(ctx, layer, 'overlay', 1);
  speckle(ctx, seed + 1, 0.3);
  const [bump, bctx] = makeCanvas(256, 256);
  bctx.drawImage(layer, 0, 0);
  if (pinholes) {
    const r = rng(seed + 2);
    const holes = Array.from({ length: pinholes }, () => [r() * size, r() * size, 0.8 + r() * 2.4] as const);
    wrapped(ctx, () => {
      for (const [x, y, rad] of holes) {
        ctx.fillStyle = 'rgba(40,40,40,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, 6.3);
        ctx.fill();
      }
    });
  }
  return { color, bump };
}

function carpet(size: number): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  const r = rng(61);
  const low = tileNoise(62, 4, 4, 3);
  const img = ctx.createImageData(size, size);
  const base: RGB = [188, 176, 158];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = 0.82 + r() * 0.3 + (low(x / size, y / size) - 0.5) * 0.18;
      const i = (y * size + x) * 4;
      img.data[i] = base[0] * f;
      img.data[i + 1] = base[1] * f;
      img.data[i + 2] = base[2] * f;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { color, bump: color };
}

function brick(size: number, palette: RGB[], mortar: RGB, seed: number): TextureCanvases {
  const stone = tiles(size, {
    seed, nx: 4, ny: 12, grout: 10, groutColor: css(mortar), offset: 0.5,
    tile: (_i, _j, r) => shade(palette[Math.floor(r() * palette.length)], 0.86 + r() * 0.28),
    detail: (ctx, x, y, w, h, base, r) => {
      for (let k = 0; k < 70; k++) {
        ctx.fillStyle = css(shade(base, r() < 0.5 ? 0.7 : 1.22), 0.1 + r() * 0.16);
        ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 5, 1 + r() * 3);
      }
    },
    bumpGrout: '#555',
  });
  speckle(stone.color.getContext('2d')!, seed + 3, 0.35);
  return stone;
}

function pinstripe(size: number): TextureCanvases {
  const [color, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#f1ede4';
  ctx.fillRect(0, 0, size, size);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (size / n);
    ctx.fillStyle = 'rgba(120,112,98,0.28)';
    ctx.fillRect(x - 1.5, 0, 3, size);
    ctx.fillStyle = 'rgba(120,112,98,0.1)';
    ctx.fillRect(x + size / n / 2 - 0.75, 0, 1.5, size);
  }
  speckle(ctx, 91, 0.18);
  return { color };
}

// ───────────── Catalogue ─────────────

export interface TextureSpec {
  /** Real-world size one repeat of the texture covers, in metres. */
  size: [number, number];
  draw: () => TextureCanvases;
}

const OAK: RGB[] = [[190, 148, 100], [178, 136, 90], [200, 160, 112], [184, 142, 96]];
const WALNUT: RGB[] = [[104, 72, 50], [92, 62, 42], [116, 82, 58], [98, 68, 48]];
const ASH: RGB[] = [[222, 208, 186], [214, 199, 176], [230, 218, 198], [218, 204, 182]];
const DECK: RGB[] = [[132, 104, 80], [120, 94, 72], [140, 112, 88]];

export const TEXTURES: Record<string, TextureSpec> = {
  oak: { size: [2, 1], draw: () => planks(1024, { seed: 3, rows: 7, palette: OAK }) },
  walnut: { size: [2, 1], draw: () => planks(1024, { seed: 4, rows: 7, palette: WALNUT, grain: 1.2 }) },
  ash: { size: [2.2, 1.1], draw: () => planks(1024, { seed: 5, rows: 6, palette: ASH, grain: 0.7, gapColor: 'rgba(90,78,60,0.45)' }) },
  parquet: { size: [0.6, 0.6], draw: () => basketParquet(1024) },
  decking: { size: [2, 0.876], draw: () => planks(1024, { seed: 6, rows: 6, palette: DECK, gap: 5, grain: 1.5, gapColor: 'rgba(15,12,10,0.95)' }) },
  'tile-grey': {
    size: [1.2, 1.2],
    draw: () => {
      const t = tiles(1024, {
        seed: 8, nx: 2, ny: 2, grout: 5, groutColor: '#6f706e',
        tile: (_i, _j, r) => shade([158, 159, 156], 0.96 + r() * 0.08),
      });
      const ctx = t.color.getContext('2d')!;
      blend(ctx, noiseLayer(256, tileNoise(9, 4, 4, 4), 95, 160), 'overlay', 0.7);
      speckle(ctx, 10, 0.22);
      return t;
    },
  },
  'tile-beige': {
    size: [1.2, 0.6],
    draw: () => {
      const t = tiles(1024, {
        seed: 13, nx: 2, ny: 2, grout: 5, groutColor: '#a99f8f',
        tile: (_i, _j, r) => shade([219, 208, 190], 0.96 + r() * 0.07),
      });
      const ctx = t.color.getContext('2d')!;
      blend(ctx, noiseLayer(256, tileNoise(14, 3, 5, 4), 90, 165), 'overlay', 0.6);
      veins(ctx, 15, 6, [170, 152, 128], 0.5);
      return t;
    },
  },
  marble: { size: [1.2, 1.2], draw: () => marble(1024) },
  checker: {
    size: [0.6, 0.6],
    draw: () => tiles(512, {
      seed: 16, nx: 2, ny: 2, grout: 4, groutColor: '#8b8b88',
      tile: (i, j, r) => ((i + j) % 2 ? shade([34, 35, 38], 0.9 + r() * 0.2) : shade([240, 238, 232], 0.97 + r() * 0.05)),
    }),
  },
  terrazzo: { size: [1, 1], draw: () => terrazzo(1024) },
  subway: {
    size: [0.6, 0.6],
    draw: () => tiles(1024, {
      seed: 17, nx: 4, ny: 8, grout: 5, groutColor: '#b9b9b4', offset: 0.5,
      tile: (_i, _j, r) => shade([247, 247, 243], 0.965 + r() * 0.045),
      bumpGrout: '#666',
    }),
  },
  concrete: { size: [2, 2], draw: () => cloudy(1024, [163, 162, 158], 31, 34, 260) },
  plaster: { size: [1.6, 1.6], draw: () => cloudy(512, [240, 238, 233], 33, 12) },
  carpet: { size: [0.8, 0.8], draw: () => carpet(512) },
  'brick-red': { size: [1.04, 0.9], draw: () => brick(1024, [[158, 84, 62], [142, 72, 54], [170, 96, 70], [128, 66, 52]], [196, 190, 180], 51) },
  'brick-white': { size: [1.04, 0.9], draw: () => brick(1024, [[236, 233, 226], [228, 224, 216], [242, 240, 234]], [208, 205, 198], 52) },
  slats: { size: [0.336, 1], draw: () => slats(1024) },
  pinstripe: { size: [0.2, 0.2], draw: () => pinstripe(512) },
};
