/**
 * Sanity check for the exported IFC: parses it with web-ifc (the engine behind
 * most browser IFC viewers), counts the building elements and tessellates every
 * solid to make sure the geometry is actually buildable.
 *   npm run validate:ifc [file.ifc]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as WebIFC from 'web-ifc';

const file = resolve(process.argv[2] ?? 'exports/botanika-5M2.ifc');
const api = new WebIFC.IfcAPI();
await api.Init();
const model = api.OpenModel(new Uint8Array(readFileSync(file)));

const types = [
  'IFCBUILDINGSTOREY', 'IFCWALLSTANDARDCASE', 'IFCOPENINGELEMENT', 'IFCDOOR', 'IFCWINDOW',
  'IFCSLAB', 'IFCSTAIR', 'IFCRAILING', 'IFCSPACE',
];
console.log(`Schema: ${api.GetModelSchema(model)}`);
for (const t of types) console.log(`${t.padEnd(22)} ${api.GetLineIDsWithType(model, WebIFC[t]).size()}`);

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
let meshes = 0, triangles = 0, empty = 0;
api.StreamAllMeshes(model, (mesh) => {
  meshes += 1;
  let own = 0;
  const placed = mesh.geometries;
  for (let i = 0; i < placed.size(); i++) {
    const pg = placed.get(i);
    const geom = api.GetGeometry(model, pg.geometryExpressID);
    const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
    const index = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
    own += index.length / 3;
    const m = pg.flatTransformation;
    for (let v = 0; v < verts.length; v += 6) {
      const x = verts[v], y = verts[v + 1], z = verts[v + 2];
      const p = [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ];
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    }
    geom.delete();
  }
  // An element may carry an extra empty buffer (web-ifc does this for voided walls); only a
  // wholly empty element means its solid could not be built.
  if (own === 0) empty += 1;
  triangles += own;
});
const f = (a) => a.map((n) => n.toFixed(2)).join(', ');
console.log(`Elements with geometry: ${meshes}, triangles: ${triangles}, empty elements: ${empty}`);
// web-ifc reports Y-up: (x, z_ifc, -y_ifc)
console.log(`Bounding box min [${f(min)}] max [${f(max)}] (web-ifc axes, Y up)`);
api.CloseModel(model);
if (empty > 0 || meshes === 0) { console.error('Geometry problems found'); process.exit(1); }
console.log('OK');
