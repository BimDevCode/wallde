/**
 * Writes the apartment as an IFC file without opening the app:
 *   npm run export:ifc                      → exports/botanika-5M2.ifc (the bare flat)
 *   npm run export:ifc -- --furnished       → the same with the sample furniture and lights
 *   npm run export:ifc -- out.ifc           → custom path
 * Furniture you arrange yourself lives in the browser; export that from the app's Export tab.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildIfc, IFC_FILE_NAME } from '../src/export/ifc.ts';
import { sampleFurniture, sampleLamps } from '../src/model/furniture.ts';

const args = process.argv.slice(2);
const furnished = args.includes('--furnished');
const target = resolve(args.find((a) => !a.startsWith('--')) ?? `exports/${IFC_FILE_NAME}`);
const text = buildIfc(furnished ? { furniture: sampleFurniture(), lamps: sampleLamps() } : {});
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, text, 'utf8');
console.log(`Wrote ${target} (${(text.length / 1024).toFixed(1)} kB, ${text.split('\n').length} lines)`);
