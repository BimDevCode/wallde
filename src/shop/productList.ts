/**
 * Reading a product list into the app. The list is a plain file (CSV or JSON)
 * that you put together by hand or receive as a retailer's product feed —
 * nothing is fetched from any shop's website.
 */
import { FURNITURE } from '../model/furniture.ts';
import type { Product } from '../model/types.ts';

const ALIASES: Record<string, keyof Product | 'kind'> = {
  name: 'name', nazwa: 'name', product: 'name', produkt: 'name', title: 'name',
  url: 'url', link: 'url', adres: 'url',
  price: 'price', cena: 'price',
  width: 'w', szerokosc: 'w', 'szerokość': 'w', w: 'w',
  depth: 'd', glebokosc: 'd', 'głębokość': 'd', d: 'd', length: 'd', dlugosc: 'd', 'długość': 'd',
  height: 'h', wysokosc: 'h', 'wysokość': 'h', h: 'h',
  kind: 'kind', model: 'kind', typ: 'kind', type: 'kind',
};

/** Words in a product name that suggest which 3D model should stand in for it. */
const HINTS: [RegExp, string][] = [
  [/szafka nocna|stolik nocny|bedside/i, 'nightstand'],
  [/rtv|tv unit/i, 'tv-unit'],
  [/stolik|coffee table|ława/i, 'coffee-table'],
  [/sofa|kanapa|narożnik/i, 'sofa-3'],
  [/fotel|armchair/i, 'armchair'],
  [/hoker|stool/i, 'bar-stool'],
  [/krzesł|chair/i, 'chair'],
  [/stół|stol |table/i, 'dining-table'],
  [/łóżko|lozko|bed/i, 'bed-double'],
  [/szafa|wardrobe/i, 'wardrobe'],
  [/regał|regal|bookcase|shelf/i, 'bookshelf'],
  [/komoda|sideboard/i, 'sideboard'],
  [/biurko|desk/i, 'desk'],
  [/wanna|bathtub/i, 'bathtub'],
  [/kabina|prysznic|shower/i, 'shower'],
  [/umywalk|washbasin|vanity/i, 'vanity'],
  [/wc|toalet|toilet/i, 'toilet'],
  [/pralka|washing/i, 'washer'],
  [/lodówk|lodowk|fridge/i, 'fridge'],
  [/dywan|rug/i, 'rug'],
];

function number(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  // "1 299,00 zł" and "2.499,50" are both common in Polish price lists.
  const digits = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(digits);
  return digits !== '' && Number.isFinite(n) ? n : undefined;
}

/** Splits CSV text into rows of cells; handles quotes and either , or ; as the separator. */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Reads a product list from CSV (with a header row) or a JSON array. Sizes are in centimetres. */
export function parseCatalogue(text: string): Product[] {
  const clean = text.replace(/^﻿/, '').trim();
  let records: Record<string, unknown>[];
  if (clean.startsWith('[') || clean.startsWith('{')) {
    const data: unknown = JSON.parse(clean);
    const list = Array.isArray(data) ? data : (data as { products?: unknown }).products;
    if (!Array.isArray(list)) throw new Error('The JSON file should be a list of products.');
    records = list as Record<string, unknown>[];
  } else {
    const [header, ...rows] = parseCsv(clean);
    if (!header || !rows.length) throw new Error('The file needs a header row and at least one product.');
    records = rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  }

  const products: Product[] = [];
  for (const record of records) {
    const fields: Partial<Record<keyof Product | 'kind', unknown>> = {};
    for (const [key, value] of Object.entries(record)) {
      const field = ALIASES[key.trim().toLowerCase()];
      if (field) fields[field] = value;
    }
    const name = String(fields.name ?? '').trim();
    if (!name) continue;
    const asked = String(fields.kind ?? '').trim().toLowerCase();
    const kind = FURNITURE.some((f) => f.kind === asked) ? asked : HINTS.find(([re]) => re.test(name))?.[1] ?? 'box';
    const cm = (v: unknown) => {
      const n = number(v);
      return n && n > 0 ? n / 100 : undefined;
    };
    const url = String(fields.url ?? '').trim();
    products.push({
      id: `product-${products.length}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
      name,
      url: /^https?:\/\//i.test(url) ? url : undefined,
      price: number(fields.price),
      w: cm(fields.w), d: cm(fields.d), h: cm(fields.h),
      kind,
    });
  }
  if (!products.length) throw new Error('No products found — the file needs at least a "name" column.');
  return products;
}

/** A starter file showing the expected columns; the rows are placeholders to overwrite. */
export const CATALOGUE_TEMPLATE = [
  'name;url;price;width;depth;height;kind',
  'Example sofa (replace this row);https://www.leroymerlin.pl/;0;220;95;80;sofa-3',
  'Example wardrobe (replace this row);https://www.leroymerlin.pl/;0;180;60;230;wardrobe',
  'Example dining table (replace this row);https://www.leroymerlin.pl/;0;160;90;75;dining-table',
  '',
].join('\n');
