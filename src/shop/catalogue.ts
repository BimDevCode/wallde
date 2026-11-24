/**
 * The shopping list: everything placed in the flat plus the finishes by area,
 * each with either the product the user chose or a shop search for that kind of thing.
 */
import { furnitureDef, lampDef } from '../model/furniture.ts';
import type { FurnitureItem, Lamp } from '../model/types.ts';
import { presetById, type Assignment } from '../materials/library';
import { SURFACE_AREA, SURFACE_BY_KEY, roomOf } from '../state/store';
import { FINISH_SEARCH, leroySearchUrl } from './leroy.ts';

export interface ShoppingRow {
  group: 'Furniture' | 'Lighting' | 'Finishes';
  item: string;
  where: string;
  quantity: string;
  price?: number;
  /** The chosen product if one is attached, otherwise a shop search for this kind of thing. */
  url: string;
  linked: boolean;
}

export function shoppingList(s: {
  furniture: FurnitureItem[];
  lamps: Lamp[];
  assignments: Record<string, Assignment>;
}): ShoppingRow[] {
  const rows: ShoppingRow[] = [];
  const where = (o: { level: number; x: number; z: number }) => roomOf(o)?.name ?? 'Outside a room';

  for (const f of s.furniture) {
    const def = furnitureDef(f.kind);
    rows.push({
      group: 'Furniture',
      item: f.product?.name || f.name || def.name,
      where: where(f),
      quantity: `1 × ${Math.round(f.w * 100)}×${Math.round(f.d * 100)}×${Math.round(f.h * 100)} cm`,
      price: f.product?.price,
      url: f.product?.url || (def.search ? leroySearchUrl(def.search) : ''),
      linked: !!f.product?.url,
    });
  }
  for (const l of s.lamps) {
    const def = lampDef(l.kind);
    rows.push({
      group: 'Lighting',
      item: l.product?.name || def.name,
      where: where(l),
      quantity: '1',
      price: l.product?.price,
      url: l.product?.url || leroySearchUrl(def.search),
      linked: !!l.product?.url,
    });
  }

  // Finishes are bought by area: add up every surface that shares a material.
  const labels: Record<string, string> = { floor: 'Floors', wall: 'Walls', ceiling: 'Ceilings', tread: 'Stair treads' };
  const areas = new Map<string, { preset: string; tint?: string; label: string; area: number }>();
  for (const [key, a] of Object.entries(s.assignments)) {
    const surface = SURFACE_BY_KEY.get(key);
    const label = surface && labels[surface.kind];
    if (!label) continue;
    const id = `${label}|${a.preset}|${a.tint ?? ''}`;
    const entry = areas.get(id) ?? { preset: a.preset, tint: a.tint, label, area: 0 };
    entry.area += SURFACE_AREA.get(key) ?? 0;
    areas.set(id, entry);
  }
  for (const e of areas.values()) {
    const preset = presetById(e.preset);
    const query = FINISH_SEARCH[preset.id];
    rows.push({
      group: 'Finishes',
      item: e.tint && e.tint.toLowerCase() !== '#ffffff' ? `${preset.name} (${e.tint})` : preset.name,
      where: e.label,
      quantity: `${e.area.toFixed(1)} m²`,
      url: query ? leroySearchUrl(query) : '',
      linked: false,
    });
  }
  return rows;
}

export function shoppingCsv(rows: ShoppingRow[]): string {
  const cell = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Group', 'Item', 'Where', 'Quantity', 'Price (zł)', 'Product chosen', 'Link'].map(cell).join(';'),
    ...rows.map((r) =>
      [r.group, r.item, r.where, r.quantity, r.price ?? '', r.linked ? 'yes' : 'no', r.url].map(cell).join(';'),
    ),
  ];
  // The BOM makes Excel read the Polish characters correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
