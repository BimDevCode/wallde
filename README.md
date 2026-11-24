# Botanika 5M2 — 3D apartment

An interactive 3D model of apartment 5M2 (Botanika, osiedle Niezapominajek), traced from the developer's
plan: three levels, 109.94 m². Walk through it, change the lighting, restyle every surface, and export
the building to Revit.

## Run it

Needs Node 22.18 or newer. With nvm: `nvm use` (the repo pins 22 in `.nvmrc`).

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run export:ifc` | Write `exports/botanika-5M2.ifc` without opening the app (`-- --furnished` adds the sample furniture) |
| `npm run validate:ifc` | Parse that file with web-ifc and tessellate every element |

## Using the app

- **Overview** — drag to orbit, right-drag to pan, scroll to zoom. *Show up to* lifts off the storeys
  above the one you pick. Double-click a floor to drop into walk mode there.
- **Walk through** — click the view to capture the mouse, then `W A S D` to move, `Shift` to run,
  `Esc` to release. Stairs, doors, walls and balcony rails behave as you would expect. If the browser
  refuses mouse capture, drag to look instead.
- **Light** — time of day moves the sun. Add ceiling lights, pendants, downlights and floor lamps, drag
  them into place, and set each one's brightness, colour, hanging height or beam angle.
- **Furnish** — about 30 resizable pieces (sofas, tables, kitchen units, beds, wardrobes, bathroom
  fittings). Pick one and click a floor; drag to move, `R` to turn, `Delete` to remove. *Sample layout*
  furnishes every room as a starting point. Furniture is solid when you walk.
- **Finishes** — click any floor, wall or ceiling, then choose a material, tint it, resize or turn the
  pattern, or upload your own texture image. A wall can be styled alone, with its room, its storey, or
  the whole flat. In walk mode `Q`/`E` step through materials and `L` switches the room light.
- **Export** — IFC for Revit, GLB for everything else.

Finishes, lights and furniture are remembered in the browser between visits.

## Rendering speed

**View ▸ Rendering** has three presets. *Balanced* is the default; pick *Fast* on a slower machine and
*High* for stills.

| | Lamps lit at once | Resolution up to | Screen-space ambient occlusion |
| --- | --- | --- | --- |
| Fast | 3 | ×1 | off |
| Balanced | 6 | ×1.5 | off |
| High | 12 | ×2 | on |

What keeps it fast:

- **A fixed pool of lights.** Every lit pixel pays for every light, so the scene holds a small set of
  real lights and lends them to the lamps nearest to you (the room you are in first). Lamps beyond that
  still glow but do not light their surroundings. Only the leading light of each kind casts shadows.
- **Baked corner shading.** Soft dark strips along wall, floor and ceiling junctions and under furniture
  stand in for ambient occlusion at almost no cost. Switching on screen-space ambient occlusion replaces
  them with the real thing, at several times the frame time.
- **Resolution that adapts.** If the frame rate stays low while you move, the resolution drops a step;
  it climbs back when there is headroom. Switch this off to pin the resolution.
- **Drawing on demand.** The overview only redraws when something changes, so an idle window uses no
  GPU. Walk mode draws continuously.
- **Shadow maps on demand**, redrawn only when a light or an object moves.
- **A depth pre-pass** on graphics cards that need it (not Apple's, which sort this out themselves), so
  surfaces hidden behind walls are never shaded.

## Shopping and Leroy Merlin

Leroy Merlin publishes no catalogue API, its website turns away automated requests, and its 3D models
are only distributed inside the CAD Decor design programs — so the app cannot pull their catalogue in
directly. What it does instead:

- **Find on Leroy Merlin** — every piece of furniture, light and finish has a button that opens
  leroymerlin.pl's own search for that kind of product in a new tab.
- **Product link** — paste the name, link and price of the product you chose onto the item, and set
  the item's width, depth and height to match it.
- **Your product list** — load a CSV or JSON file of products (name, link, price, width, depth,
  height in cm) and place them at their real size. *Template* downloads a starter file. This is also
  where a retailer's product feed would plug in, should you get access to one.
- **Shopping list** — a CSV of everything placed, plus each finish with the area it covers in m².

A product-list file looks like this (`;` or `,` both work, Polish column names too):

```
name;url;price;width;depth;height;kind
Sofa Oslo;https://www.leroymerlin.pl/...;1299;220;95;80;sofa-3
```

`kind` picks the 3D stand-in (see `src/model/furniture.ts` for the names); leave it out and the app
guesses from the product name, falling back to a plain block.

## Into Revit

1. In the app: **Export ▸ Download IFC for Revit** (or run `npm run export:ifc`).
2. In Revit: **File ▸ Open ▸ IFC**, pick `botanika-5M2.ifc`. To reference it from an existing project
   use **Insert ▸ Link IFC** instead.

The file is IFC2x3 and contains the three levels, 46 walls (as `IfcWallStandardCase` with axis lines and
layer sets), 14 door and window openings with their doors and windows, the floor slabs and roof, both
stair flights, balcony balustrades, and 13 rooms as `IfcSpace` with names and areas. Furniture and
lights you placed go along as plain blocks of the right size in the right place
(`IfcFurnishingElement`), not as detailed models.

It carries the building, not the look: materials, textures and lights chosen in the app are not part of
IFC. The file validates with IfcOpenShell (schema and rules) and web-ifc; it has not been opened in Revit
itself, which only runs on Windows.

## Accuracy

The plan was a brochure image, so dimensions were measured off it using its 0–5 m scale bar. Room areas
computed from the traced outlines, less the installation shafts, are within about 3 % of the brochure
table (the brochure's hall, corridor and vestibule figures also count the stairs, so those are not
comparable one to one). Three things are assumed rather than read from the plan — change them in
`src/model/apartment.ts`:

- Storey height: 2.90 m floor to floor, 2.65 m clear (`F2F`, `SLAB`).
- Window sills at 0.85 m, window and balcony-door heads at 2.35 m, internal doors 2.05 m.
- The ground-floor vestibule sits in front of the stair tower, because the plan draws the lower flight
  filling the tower. A short wall closing the low space under the upper flight is also added.

The grey blocks around the flat stand in for neighbouring units; they are context only.

## How it is put together

| Path | Role |
| --- | --- |
| `src/model/apartment.ts` | The plan as data: walls, openings, rooms, stairs, slabs — all in metres |
| `src/model/build.ts` | Turns that data into meshes, one surface per room face so each can be restyled |
| `src/model/walk.ts` | Collision boxes and walkable heights for first-person movement |
| `src/model/furniture.ts` | Furniture and lamp catalogue: parametric models and the sample layout |
| `src/shop/` | Leroy Merlin search links, product-list import, shopping list |
| `src/export/ifc.ts` | IFC2x3 writer (plain text, no dependencies) |
| `src/materials/` | Procedural textures drawn on canvases, and the material library |
| `src/scene/` | The three.js scene: model, sun and lamps, orbit and walk cameras, render pipeline and presets |
| `src/ui/` | The control panel, minimap and on-screen hints |
| `src/state/store.ts` | App state |

Built with Vite 8, React 19, TypeScript 7, three.js r187 with React Three Fiber 9 and drei 10,
Mantine 9 for the interface, and Zustand for state.
