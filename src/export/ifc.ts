/**
 * IFC2x3 writer for the apartment — the route into Revit (File ▸ Open ▸ IFC).
 *
 * Walls go out as IfcWallStandardCase with an axis line, a layer set and real
 * openings, so Revit can rebuild them as walls rather than dumb solids. Rooms go
 * out as IfcSpace. No dependencies: the file is assembled as STEP text, which
 * also lets this module run unchanged in Node (`npm run export:ifc`).
 */
import {
  CLEAR, F2F, LEVELS, PROJECT, RAILINGS, ROOMS, SLABS, STAIRS, WALLS, polygonArea,
} from '../model/apartment.ts';
import { furnitureDef, lampDef } from '../model/furniture.ts';
import type { FurnitureItem, Lamp, Opening, Vec2, Wall } from '../model/types.ts';

/** IFC has Y pointing north; the plan's Z points south. Flipping about this line keeps Y positive. */
const NORTH_EDGE = 14;

interface Ref { ref: number }
interface Raw { raw: string }
type Arg = number | string | null | Ref | Raw | Arg[];

const E = (name: string): Raw => ({ raw: `.${name}.` });
const int = (n: number): Raw => ({ raw: String(Math.round(n)) });
const STAR: Raw = { raw: '*' };

function real(x: number): string {
  if (Math.abs(x) < 5e-7) return '0.';
  return x.toFixed(6).replace(/0+$/, '');
}

/** STEP strings are 7-bit; anything else (ł, ó, ę…) is written as \X2\hhhh\X0\. */
function str(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "'") out += "''";
    else if (ch === '\\') out += '\\\\';
    else if (code >= 32 && code < 127) out += ch;
    else out += `\\X2\\${code.toString(16).toUpperCase().padStart(4, '0')}\\X0\\`;
  }
  return `'${out}'`;
}

function fmt(a: Arg): string {
  if (a === null) return '$';
  if (typeof a === 'number') return real(a);
  if (typeof a === 'string') return str(a);
  if (Array.isArray(a)) return `(${a.map(fmt).join(',')})`;
  if ('ref' in a) return `#${a.ref}`;
  return a.raw;
}

/** Stable 22-character IFC GlobalId derived from a name, so re-exports keep their identities. */
function guid(seed: string): string {
  const words = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    for (let k = 0; k < 4; k++) {
      words[k] = Math.imul(words[k] ^ (c + k * 131), 0x01000193 + k * 2);
      words[k] ^= words[k] >>> 15;
    }
  }
  let value = 0n;
  for (const w of words) value = (value << 32n) | BigInt(w >>> 0);
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let out = '';
  for (let i = 0; i < 22; i++) {
    out = alphabet[Number(value & 63n)] + out;
    value >>= 6n;
  }
  return out;
}

export interface IfcOptions {
  author?: string;
  date?: Date;
  /** Placed furniture, exported as simple blocks of the right size. */
  furniture?: FurnitureItem[];
  lamps?: Lamp[];
}

export function buildIfc(options: IfcOptions = {}): string {
  const date = options.date ?? new Date();
  const lines: string[] = [];
  let counter = 0;
  const add = (type: string, ...args: Arg[]): Ref => {
    counter += 1;
    lines.push(`#${counter}=${type}(${args.map(fmt).join(',')});`);
    return { ref: counter };
  };

  // ── Shared geometry helpers ──
  const pt3 = (x: number, y: number, z: number) => add('IFCCARTESIANPOINT', [x, y, z]);
  const pt2 = (x: number, y: number) => add('IFCCARTESIANPOINT', [x, y]);
  const dir3 = (x: number, y: number, z: number) => add('IFCDIRECTION', [x, y, z]);
  const dir2 = (x: number, y: number) => add('IFCDIRECTION', [x, y]);
  const origin = pt3(0, 0, 0);
  const zUp = dir3(0, 0, 1);
  const xDir = dir3(1, 0, 0);
  const worldAxes = add('IFCAXIS2PLACEMENT3D', origin, zUp, xDir);
  const axes3 = (p: [number, number, number], axis?: [number, number, number], refDir?: [number, number, number]) =>
    add('IFCAXIS2PLACEMENT3D', pt3(...p), axis ? dir3(...axis) : null, refDir ? dir3(...refDir) : null);
  const placement = (relTo: Ref | null, p: [number, number, number], axis?: [number, number, number], refDir?: [number, number, number]) =>
    add('IFCLOCALPLACEMENT', relTo, axes3(p, axis, refDir));
  const fy = (z: number) => NORTH_EDGE - z;

  // ── Ownership, units, contexts ──
  const person = add('IFCPERSON', null, options.author ?? 'Owner', null, null, null, null, null, null);
  const org = add('IFCORGANIZATION', null, 'Botanika 3D', null, null, null);
  const personOrg = add('IFCPERSONANDORGANIZATION', person, org, null);
  const app = add('IFCAPPLICATION', org, '0.1.0', 'Botanika Apartment 3D', 'botanika-3d');
  const owner = add('IFCOWNERHISTORY', personOrg, app, null, E('ADDED'), null, null, null, int(date.getTime() / 1000));

  const units = add('IFCUNITASSIGNMENT', [
    add('IFCSIUNIT', STAR, E('LENGTHUNIT'), null, E('METRE')),
    add('IFCSIUNIT', STAR, E('AREAUNIT'), null, E('SQUARE_METRE')),
    add('IFCSIUNIT', STAR, E('VOLUMEUNIT'), null, E('CUBIC_METRE')),
    add('IFCSIUNIT', STAR, E('PLANEANGLEUNIT'), null, E('RADIAN')),
  ]);
  const context = add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', int(3), 1e-5, worldAxes, dir2(0, 1));
  const bodyCtx = add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', 'Body', 'Model', STAR, STAR, STAR, STAR, context, null, E('MODEL_VIEW'), null);
  const axisCtx = add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', 'Axis', 'Model', STAR, STAR, STAR, STAR, context, null, E('GRAPH_VIEW'), null);

  // ── Spatial structure ──
  const project = add('IFCPROJECT', guid('project'), owner, PROJECT.name, PROJECT.estate, null, null, null, [context], units);
  const sitePlacement = placement(null, [0, 0, 0]);
  const site = add('IFCSITE', guid('site'), owner, 'Site', null, null, sitePlacement, null, null, E('ELEMENT'), null, null, null, null, null);
  const buildingPlacement = placement(sitePlacement, [0, 0, 0]);
  const building = add('IFCBUILDING', guid('building'), owner, PROJECT.name, null, null, buildingPlacement, null, PROJECT.estate, E('ELEMENT'), null, null, null);
  const storeys = LEVELS.map((l) => {
    const place = placement(buildingPlacement, [0, 0, l.elevation]);
    const entity = add('IFCBUILDINGSTOREY', guid(`storey/${l.id}`), owner, l.name, null, null, place, null, l.name, E('ELEMENT'), l.elevation);
    return { place, entity, elements: [] as Ref[], spaces: [] as Ref[], elevation: l.elevation };
  });
  add('IFCRELAGGREGATES', guid('rel/project'), owner, null, null, project, [site]);
  add('IFCRELAGGREGATES', guid('rel/site'), owner, null, null, site, [building]);
  add('IFCRELAGGREGATES', guid('rel/building'), owner, null, null, building, storeys.map((s) => s.entity));

  // ── Reusable solids ──
  const extrusionUp = dir3(0, 0, 1);
  /** Rectangle from (0,0) to (dx,dy) in the local XY plane, pushed along local Z. */
  const boxSolid = (dx: number, dy: number, dz: number, x = 0, y = 0): Ref => {
    const profile = add(
      'IFCRECTANGLEPROFILEDEF', E('AREA'), null,
      add('IFCAXIS2PLACEMENT2D', pt2(x + dx / 2, y + dy / 2), null), dx, dy,
    );
    return add('IFCEXTRUDEDAREASOLID', profile, worldAxes, extrusionUp, dz);
  };
  const loop = (points: [number, number][]): Ref => add('IFCPOLYLINE', [...points, points[0]].map(([x, y]) => pt2(x, y)));
  const planLoop = (ring: readonly Vec2[]): Ref => loop(ring.map(([x, z]): [number, number] => [x, fy(z)]));
  const polygonSolid = (outline: readonly Vec2[], holes: readonly (readonly Vec2[])[], depth: number): Ref => {
    const profile = holes.length
      ? add('IFCARBITRARYPROFILEDEFWITHVOIDS', E('AREA'), null, planLoop(outline), holes.map(planLoop))
      : add('IFCARBITRARYCLOSEDPROFILEDEF', E('AREA'), null, planLoop(outline));
    return add('IFCEXTRUDEDAREASOLID', profile, worldAxes, extrusionUp, depth);
  };
  const bodyShape = (solid: Ref): Ref =>
    add('IFCPRODUCTDEFINITIONSHAPE', null, null, [add('IFCSHAPEREPRESENTATION', bodyCtx, 'Body', 'SweptSolid', [solid])]);

  const boolProp = (name: string, value: boolean) =>
    add('IFCPROPERTYSINGLEVALUE', name, null, { raw: `IFCBOOLEAN(.${value ? 'T' : 'F'}.)` }, null);
  const textProp = (name: string, value: string) =>
    add('IFCPROPERTYSINGLEVALUE', name, null, { raw: `IFCLABEL(${str(value)})` }, null);
  const pset = (seed: string, name: string, target: Ref, props: Ref[]) => {
    const set = add('IFCPROPERTYSET', guid(`pset/${seed}`), owner, name, null, props);
    add('IFCRELDEFINESBYPROPERTIES', guid(`relpset/${seed}`), owner, null, null, [target], set);
  };

  // ── Wall types: one material layer set per thickness ──
  const masonry = add('IFCMATERIAL', 'Masonry');
  const partition = add('IFCMATERIAL', 'Partition');
  const layerUsages = new Map<string, { usage: Ref; walls: Ref[] }>();
  const usageFor = (thickness: number, exterior: boolean) => {
    const key = `${exterior ? 'ext' : 'int'}-${Math.round(thickness * 1000)}`;
    let entry = layerUsages.get(key);
    if (!entry) {
      const layer = add('IFCMATERIALLAYER', exterior ? masonry : partition, thickness, null);
      const set = add('IFCMATERIALLAYERSET', [layer], `${exterior ? 'Exterior' : 'Interior'} wall ${Math.round(thickness * 1000)} mm`);
      entry = { usage: add('IFCMATERIALLAYERSETUSAGE', set, E('AXIS2'), E('POSITIVE'), -thickness / 2), walls: [] };
      layerUsages.set(key, entry);
    }
    return entry;
  };

  // ── Walls, with their doors and windows ──
  for (const w of WALLS) {
    const storey = storeys[w.level];
    const [x0, z0, x1, z1] = w.rect;
    const alongX = x1 - x0 >= z1 - z0;
    const length = alongX ? x1 - x0 : z1 - z0;
    const thickness = alongX ? z1 - z0 : x1 - x0;
    const height = w.height ?? CLEAR;
    // Local X runs along the wall; openings are stored as world X or Z, so `from - start` is local.
    const start = alongX ? x0 : z0;
    const place = alongX
      ? placement(storey.place, [x0, fy((z0 + z1) / 2), 0])
      : placement(storey.place, [(x0 + x1) / 2, fy(z0), 0], [0, 0, 1], [0, -1, 0]);

    const axis = add('IFCSHAPEREPRESENTATION', axisCtx, 'Axis', 'Curve2D', [add('IFCPOLYLINE', [pt2(0, 0), pt2(length, 0)])]);
    const body = add('IFCSHAPEREPRESENTATION', bodyCtx, 'Body', 'SweptSolid', [boxSolid(length, thickness, height, 0, -thickness / 2)]);
    const shape = add('IFCPRODUCTDEFINITIONSHAPE', null, null, [axis, body]);
    const name = w.shaft ? `Shaft ${w.id}` : `Wall ${w.id}`;
    const wall = add('IFCWALLSTANDARDCASE', guid(`wall/${w.id}`), owner, name, null, w.shaft ? 'Shaft' : null, place, shape, w.id);
    storey.elements.push(wall);
    usageFor(thickness, !!w.exterior).walls.push(wall);
    pset(`wall/${w.id}`, 'Pset_WallCommon', wall, [boolProp('IsExternal', !!w.exterior), textProp('Reference', w.shaft ? 'Shaft' : w.exterior ? 'Exterior' : 'Interior')]);

    for (const o of w.openings ?? []) addOpening(w, o, wall, place, storey, start, thickness);
  }
  for (const [key, entry] of layerUsages) {
    add('IFCRELASSOCIATESMATERIAL', guid(`relmat/${key}`), owner, null, null, entry.walls, entry.usage);
  }

  function addOpening(
    w: Wall, o: Opening, wall: Ref, wallPlace: Ref,
    storey: (typeof storeys)[number], start: number, thickness: number,
  ) {
    const width = o.to - o.from;
    const height = o.head - o.sill;
    const u = o.from - start;
    // Void: a width × height rectangle in the wall's plane, pushed straight through it.
    const through = thickness + 0.1;
    const voidPlace = placement(wallPlace, [u, through / 2, o.sill], [0, -1, 0], [1, 0, 0]);
    const voidEl = add(
      'IFCOPENINGELEMENT', guid(`void/${o.id}`), owner, `Opening ${o.id}`, null, null,
      voidPlace, bodyShape(boxSolid(width, height, through)), null,
    );
    add('IFCRELVOIDSELEMENT', guid(`relvoid/${o.id}`), owner, null, null, wall, voidEl);

    // Filling: a plain leaf / glazed unit standing in the opening.
    const leaf = o.kind === 'window' || o.kind === 'balconyDoor' ? 0.07 : 0.045;
    const fillPlace = placement(wallPlace, [u, 0, o.sill]);
    const shape = bodyShape(boxSolid(width, leaf, height, 0, -leaf / 2));
    const isDoor = o.kind !== 'window';
    const label = { window: 'Window', balconyDoor: 'Balcony door', door: 'Door', entrance: 'Entrance door' }[o.kind];
    const fill = add(
      isDoor ? 'IFCDOOR' : 'IFCWINDOW', guid(`fill/${o.id}`), owner, `${label} ${o.id}`, null, null,
      fillPlace, shape, o.id, height, width,
    );
    add('IFCRELFILLSELEMENT', guid(`relfill/${o.id}`), owner, null, null, voidEl, fill);
    storey.elements.push(fill);
    pset(`fill/${o.id}`, isDoor ? 'Pset_DoorCommon' : 'Pset_WindowCommon', fill, [boolProp('IsExternal', !!w.exterior)]);
  }

  // ── Slabs ──
  for (const s of SLABS) {
    const storey = storeys[s.level];
    const place = placement(storey.place, [0, 0, s.top - s.thickness - storey.elevation]);
    const type = s.kind === 'roof' ? 'ROOF' : s.kind === 'base' ? 'BASESLAB' : 'FLOOR';
    const slab = add(
      'IFCSLAB', guid(`slab/${s.id}`), owner, s.name, null, null,
      place, bodyShape(polygonSolid(s.outline, s.holes ?? [], s.thickness)), s.id, E(type),
    );
    storey.elements.push(slab);
  }

  // ── Stairs: the side profile extruded across the flight width ──
  for (const st of STAIRS) {
    const storey = storeys[st.level];
    const n = st.risers;
    const tread = Math.abs(st.zTop - st.zBottom) / (n - 1);
    const rise = F2F / n;
    const waist = 0.2;
    const run = (n - 1) * tread;
    const profilePts: [number, number][] = [[0, 0]];
    for (let k = 0; k < n; k++) {
      profilePts.push([k * tread, (k + 1) * rise]);
      if (k < n - 1) profilePts.push([(k + 1) * tread, (k + 1) * rise]);
    }
    profilePts.push([run, F2F - rise - waist], [(waist * tread) / rise, 0]);
    const profile = add('IFCARBITRARYCLOSEDPROFILEDEF', E('AREA'), null, loop(profilePts));
    const solid = add('IFCEXTRUDEDAREASOLID', profile, worldAxes, extrusionUp, st.x1 - st.x0);
    // Local X = direction of travel, local Y = up, local Z = across the flight.
    const south = st.zTop > st.zBottom;
    const place = south
      ? placement(storey.place, [st.x1, fy(st.zBottom), 0], [-1, 0, 0], [0, -1, 0])
      : placement(storey.place, [st.x0, fy(st.zBottom), 0], [1, 0, 0], [0, 1, 0]);
    const stair = add(
      'IFCSTAIR', guid(`stair/${st.id}`), owner, st.name, null, null,
      place, bodyShape(solid), st.id, E('STRAIGHT_RUN_STAIR'),
    );
    storey.elements.push(stair);
    pset(`stair/${st.id}`, 'Pset_StairCommon', stair, [
      add('IFCPROPERTYSINGLEVALUE', 'NumberOfRiser', null, { raw: `IFCCOUNTMEASURE(${n}.)` }, null),
      add('IFCPROPERTYSINGLEVALUE', 'NumberOfTreads', null, { raw: `IFCCOUNTMEASURE(${n - 1}.)` }, null),
      add('IFCPROPERTYSINGLEVALUE', 'RiserHeight', null, { raw: `IFCPOSITIVELENGTHMEASURE(${real(rise)})` }, null),
      add('IFCPROPERTYSINGLEVALUE', 'TreadLength', null, { raw: `IFCPOSITIVELENGTHMEASURE(${real(tread)})` }, null),
    ]);
  }

  // ── Balcony balustrades ──
  for (const r of RAILINGS) {
    const storey = storeys[r.level];
    const [x0, z0, x1, z1] = r.rect;
    const place = placement(storey.place, [x0, fy(z1), 0]);
    const railing = add(
      'IFCRAILING', guid(`railing/${r.id}`), owner, `Balustrade ${r.id}`, null, null,
      place, bodyShape(boxSolid(x1 - x0, z1 - z0, r.height)), r.id, E('BALUSTRADE'),
    );
    storey.elements.push(railing);
  }

  // ── Furniture and light fittings: blocks of the right size in the right place ──
  for (const f of options.furniture ?? []) {
    const storey = storeys[f.level];
    if (!storey) continue;
    const def = furnitureDef(f.kind);
    const a = (f.rot * Math.PI) / 180;
    // The item's width axis, turned from plan axes (Z south) into IFC axes (Y north).
    const place = placement(storey.place, [f.x, fy(f.z), def.lift ?? 0], [0, 0, 1], [Math.cos(a), Math.sin(a), 0]);
    const name = f.product?.name || f.name || def.name;
    const element = add(
      'IFCFURNISHINGELEMENT', guid(`furniture/${f.id}`), owner, name, null, def.name,
      place, bodyShape(boxSolid(f.w, f.d, f.h, -f.w / 2, -f.d / 2)), f.id,
    );
    storey.elements.push(element);
    if (f.product?.url) pset(`furniture/${f.id}`, 'Product', element, [textProp('Reference', f.product.url)]);
  }
  for (const l of options.lamps ?? []) {
    const storey = storeys[l.level];
    if (!storey) continue;
    const def = lampDef(l.kind);
    const [size, height, base] = l.kind === 'floor' ? [0.36, 1.6, 0] : [0.3, 0.05, CLEAR - 0.05];
    const place = placement(storey.place, [l.x - size / 2, fy(l.z) - size / 2, base]);
    const element = add(
      'IFCBUILDINGELEMENTPROXY', guid(`lamp/${l.id}`), owner, l.product?.name || def.name, null, 'Light fitting',
      place, bodyShape(boxSolid(size, size, height)), l.id, null,
    );
    storey.elements.push(element);
  }

  // ── Rooms (Name is the room number Revit shows, LongName the room name) ──
  for (const room of ROOMS) {
    if (room.floor === false) continue;
    const storey = storeys[room.level];
    const place = placement(storey.place, [0, 0, 0]);
    const number = `${room.level}.${String(storey.spaces.length + 1).padStart(2, '0')}`;
    const space = add(
      'IFCSPACE', guid(`space/${room.id}`), owner, number, null, null,
      place, bodyShape(polygonSolid(room.polygon, [], CLEAR)), room.name, E('ELEMENT'),
      E(room.outdoor ? 'EXTERNAL' : 'INTERNAL'), null,
    );
    storey.spaces.push(space);
    const measured = polygonArea(room.polygon);
    const quantities = add('IFCELEMENTQUANTITY', guid(`qto/${room.id}`), owner, 'BaseQuantities', null, null, [
      add('IFCQUANTITYAREA', 'NetFloorArea', null, null, room.area ?? measured),
      add('IFCQUANTITYAREA', 'GrossFloorArea', null, null, measured),
      add('IFCQUANTITYLENGTH', 'Height', null, null, CLEAR),
    ]);
    add('IFCRELDEFINESBYPROPERTIES', guid(`relqto/${room.id}`), owner, null, null, [space], quantities);
  }

  for (const [i, s] of storeys.entries()) {
    if (s.elements.length) {
      add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(`contain/${i}`), owner, null, null, s.elements, s.entity);
    }
    if (s.spaces.length) add('IFCRELAGGREGATES', guid(`spaces/${i}`), owner, null, null, s.entity, s.spaces);
  }

  const stamp = date.toISOString().slice(0, 19);
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
    `FILE_NAME(${str(IFC_FILE_NAME)},'${stamp}',(${str(options.author ?? 'Owner')}),('Botanika 3D'),'botanika-3d 0.1.0','Botanika Apartment 3D','');`,
    "FILE_SCHEMA(('IFC2X3'));",
    'ENDSEC;',
    'DATA;',
    ...lines,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n');
}

export const IFC_FILE_NAME = 'botanika-5M2.ifc';
