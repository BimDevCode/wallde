import { useMemo, useState } from 'react';
import {
  ActionIcon, Alert, Button, Chip, ColorInput, FileButton, Group, NumberInput, SimpleGrid, Stack, Text, TextInput, Tooltip, UnstyledButton,
} from '@mantine/core';
import {
  IconArmchair, IconCopy, IconDownload, IconRotate, IconRotateClockwise, IconTrash, IconUpload, IconX,
} from '@tabler/icons-react';
import { downloadText } from '../export/download';
import { LEVELS } from '../model/apartment.ts';
import { CATEGORIES, FURNITURE, furnitureDef, type Category } from '../model/furniture.ts';
import type { FurnitureItem } from '../model/types.ts';
import { shoppingCsv, shoppingList } from '../shop/catalogue';
import { CATALOGUE_TEMPLATE, parseCatalogue } from '../shop/productList.ts';
import { roomOf, useStore } from '../state/store';
import { Nudge } from './Nudge';
import { ProductFields } from './ProductFields';

const COLOURS = ['#f4f3ef', '#e9e6df', '#c9bca8', '#b08a5e', '#8a6a48', '#5b4636', '#8c9198', '#4a4f57', '#23262b', '#6f7f6a', '#7d94a8', '#b9674c'];
const cm = (m: number) => Math.round(m * 100);
const sizeLabel = (w: number, d: number, h: number) => `${cm(w)} × ${cm(d)} × ${cm(h)} cm`;

function Editor({ item }: { item: FurnitureItem }) {
  const { updateFurniture, removeFurniture, duplicateFurniture, pick } = useStore.getState();
  const def = furnitureDef(item.kind);
  const set = (patch: Partial<FurnitureItem>) => updateFurniture(item.id, patch);
  const turn = (by: number) => set({ rot: (((item.rot + by) % 360) + 360) % 360 });
  const dimension = (key: 'w' | 'd' | 'h', label: string) => (
    <NumberInput
      size="xs"
      label={label}
      suffix=" cm"
      min={1}
      max={600}
      value={cm(item[key])}
      onChange={(v) => typeof v === 'number' && v > 0 && set({ [key]: v / 100 })}
    />
  );

  return (
    <Stack gap={10}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <div className="section-title">Selected</div>
          <Text fw={600} size="sm" mt={2}>{item.name || def.name}</Text>
          <Text size="xs" c="dimmed">{roomOf(item)?.name ?? 'Outside a room'} · {LEVELS[item.level].name}</Text>
        </div>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Duplicate" withArrow><ActionIcon variant="default" aria-label="Duplicate" onClick={() => duplicateFurniture(item.id)}><IconCopy size={15} /></ActionIcon></Tooltip>
          <Tooltip label="Delete" withArrow><ActionIcon variant="default" color="red" aria-label="Delete" onClick={() => removeFurniture(item.id)}><IconTrash size={15} /></ActionIcon></Tooltip>
          <Tooltip label="Deselect" withArrow><ActionIcon variant="subtle" color="gray" aria-label="Deselect" onClick={() => pick(null)}><IconX size={15} /></ActionIcon></Tooltip>
        </Group>
      </Group>

      <TextInput size="xs" label="Label" placeholder={def.name} value={item.name ?? ''} onChange={(e) => set({ name: e.currentTarget.value || undefined })} />
      <SimpleGrid cols={3} spacing={6}>
        {dimension('w', 'Width')}
        {dimension('d', 'Depth')}
        {dimension('h', 'Height')}
      </SimpleGrid>
      <Group gap={6} wrap="nowrap">
        <Text size="sm" style={{ flex: 1 }}>Turn · {Math.round(item.rot)}°</Text>
        <Tooltip label="15° left" withArrow><ActionIcon variant="default" aria-label="Turn 15° left" onClick={() => turn(15)}><IconRotate size={15} /></ActionIcon></Tooltip>
        <Tooltip label="15° right" withArrow><ActionIcon variant="default" aria-label="Turn 15° right" onClick={() => turn(-15)}><IconRotateClockwise size={15} /></ActionIcon></Tooltip>
        <Button size="compact-sm" variant="default" onClick={() => turn(90)}>90°</Button>
      </Group>
      <Nudge x={item.x} z={item.z} onMove={(x, z) => set({ x, z })} />
      <ColorInput size="xs" label="Colour" value={item.color} onChange={(color) => set({ color })} swatches={COLOURS} swatchesPerRow={6} format="hex" popoverProps={{ withinPortal: true }} />
      <ProductFields product={item.product} search={def.search} onChange={(product) => set({ product })} />
    </Stack>
  );
}

export function FurnitureTab() {
  const furniture = useStore((s) => s.furniture);
  const lamps = useStore((s) => s.lamps);
  const assignments = useStore((s) => s.assignments);
  const products = useStore((s) => s.products);
  const picked = useStore((s) => s.picked);
  const placing = useStore((s) => s.placing);
  const mode = useStore((s) => s.mode);
  const { startPlacing, pick, removeFurniture, furnishSample, clearFurniture, setProducts } = useStore.getState();
  const [category, setCategory] = useState<Category>('living');
  const [importError, setImportError] = useState<string | null>(null);

  const selected = picked?.type === 'furniture' ? furniture.find((f) => f.id === picked.id) : undefined;
  const rows = useMemo(() => shoppingList({ furniture, lamps, assignments }), [furniture, lamps, assignments]);
  const priced = rows.filter((r) => r.price !== undefined);
  const total = priced.reduce((sum, r) => sum + (r.price ?? 0), 0);
  const placingKind = placing?.type === 'furniture' ? placing.kind : null;

  const importFile = async (file: File | null) => {
    if (!file) return;
    try {
      setProducts(parseCatalogue(await file.text()));
      setImportError(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Stack gap="lg">
      {placing && mode === 'orbit' && (
        <Alert variant="light" p="xs" icon={<IconArmchair size={16} />}>
          <Group justify="space-between" wrap="nowrap" gap={8}>
            <Text size="sm">Click a floor in the 3D view to put it down.</Text>
            <Button size="compact-xs" variant="default" onClick={() => startPlacing(null)}>Cancel</Button>
          </Group>
        </Alert>
      )}

      {selected && <Editor item={selected} />}

      <Stack gap={8}>
        <div className="section-title">Add furniture</div>
        <Chip.Group multiple={false} value={category} onChange={(v) => setCategory(v as Category)}>
          <Group gap={5}>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} value={c.id} size="xs" variant="outline">{c.name}</Chip>
            ))}
          </Group>
        </Chip.Group>
        <SimpleGrid cols={2} spacing={6} verticalSpacing={6}>
          {FURNITURE.filter((f) => f.category === category).map((f) => (
            <UnstyledButton
              key={f.kind}
              className={`catalogue-item${placingKind === f.kind ? ' active' : ''}`}
              onClick={() => startPlacing({ type: 'furniture', kind: f.kind })}
            >
              <span className="catalogue-chip" style={{ background: f.color }} />
              <span>
                <span className="catalogue-name">{f.name}</span>
                <span className="catalogue-size">{sizeLabel(...f.size)}</span>
              </span>
            </UnstyledButton>
          ))}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          {mode === 'walk'
            ? 'In walk mode a new piece lands a step and a half in front of you.'
            : 'Pick a piece, then click a floor. Drag to move it; R turns it, Delete removes it.'}
        </Text>
      </Stack>

      <Stack gap={8}>
        <div className="section-title">Your product list</div>
        {products.length > 0 ? (
          <Stack gap={2}>
            {products.map((p) => (
              <UnstyledButton key={p.id} className="room-row" onClick={() => startPlacing({ type: 'furniture', kind: p.kind ?? 'box', product: p })}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span className="area">{p.price !== undefined ? `${p.price.toFixed(2)} zł` : ''}</span>
              </UnstyledButton>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">
            Load a CSV or JSON list of products (name, link, price, width, depth and height in cm) and place them
            at their real size. Leroy Merlin offers no public catalogue to connect to directly, so the list is a file you supply.
          </Text>
        )}
        <Group gap={6} grow>
          <FileButton onChange={importFile} accept=".csv,.json,text/csv,application/json">
            {(props) => <Button {...props} size="compact-sm" variant="default" leftSection={<IconUpload size={14} />}>Load list</Button>}
          </FileButton>
          <Button size="compact-sm" variant="default" leftSection={<IconDownload size={14} />} onClick={() => downloadText(CATALOGUE_TEMPLATE, 'product-list-template.csv')}>
            Template
          </Button>
        </Group>
        {products.length > 0 && <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setProducts([])}>Remove the list</Button>}
        {importError && <Alert color="red" p="xs"><Text size="xs">{importError}</Text></Alert>}
      </Stack>

      <Stack gap={8}>
        <Group justify="space-between">
          <div className="section-title">In the flat · {furniture.length}</div>
          <Group gap={6}>
            <Button size="compact-xs" variant="default" onClick={furnishSample}>Sample layout</Button>
            <Button size="compact-xs" variant="default" disabled={!furniture.length} onClick={clearFurniture}>Clear</Button>
          </Group>
        </Group>
        {furniture.length === 0 && <Text size="xs" c="dimmed">Nothing placed yet. “Sample layout” furnishes every room as a starting point.</Text>}
        {[...LEVELS].reverse().map((level) => {
          const items = furniture.filter((f) => f.level === level.index);
          if (!items.length) return null;
          return (
            <Stack key={level.id} gap={0}>
              <Text size="xs" fw={600} c="dimmed" mt={4} mb={2}>{level.name}</Text>
              {items.map((f) => (
                <UnstyledButton key={f.id} className={`room-row${selected?.id === f.id ? ' current' : ''}`} onClick={() => pick({ type: 'furniture', id: f.id })}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || furnitureDef(f.kind).name}</span>
                  <span className="area">{roomOf(f)?.name ?? '—'}</span>
                  <ActionIcon
                    component="span"
                    size="sm"
                    variant="subtle"
                    color="gray"
                    aria-label="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFurniture(f.id);
                    }}
                  >
                    <IconTrash size={13} />
                  </ActionIcon>
                </UnstyledButton>
              ))}
            </Stack>
          );
        })}
      </Stack>

      <Stack gap={6}>
        <div className="section-title">Shopping list</div>
        <Text size="sm" c="dimmed">
          {rows.length} lines: furniture, lights and finishes by area.
          {priced.length > 0 ? ` ${priced.length} priced, ${total.toFixed(2)} zł so far.` : ' Add prices to items to total them.'}
        </Text>
        <Button size="compact-sm" variant="default" leftSection={<IconDownload size={14} />} onClick={() => downloadText(shoppingCsv(rows), 'botanika-5M2-shopping-list.csv')}>
          Download shopping list (CSV)
        </Button>
      </Stack>
    </Stack>
  );
}
