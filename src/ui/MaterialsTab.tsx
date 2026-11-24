import { useMemo, useState } from 'react';
import {
  Button, ColorInput, FileButton, Group, SegmentedControl, Select, SimpleGrid, Slider, Stack, Switch, Text, UnstyledButton,
} from '@mantine/core';
import { IconRestore, IconSearch, IconUpload } from '@tabler/icons-react';
import { ROOMS, groupOf } from '../model/apartment.ts';
import type { SurfaceKind } from '../model/build.ts';
import { PRESETS, presetById, presetThumbnail, type MaterialPreset } from '../materials/library';
import { FINISH_SEARCH, leroySearchUrl } from '../shop/leroy.ts';
import { SURFACES, SURFACE_AREA, SURFACE_BY_KEY, keysInScope, useStore, type Scope } from '../state/store';

const PAINT_COLOURS = [
  '#ffffff', '#f3f0e9', '#e6dfd0', '#d8c9b4', '#c9d2c4', '#9fb3a0', '#c8d6de', '#8fa3b3',
  '#e3c1ad', '#b9674c', '#7b4b3a', '#4a4f57', '#23262b',
];

function scopesFor(kind: SurfaceKind): { value: Scope; label: string }[] {
  if (kind === 'wall') {
    return [
      { value: 'surface', label: 'This wall' },
      { value: 'room', label: 'Room' },
      { value: 'level', label: 'Storey' },
      { value: 'all', label: 'All' },
    ];
  }
  if (kind === 'floor' || kind === 'ceiling') {
    return [
      { value: 'surface', label: 'This room' },
      { value: 'level', label: 'Storey' },
      { value: 'all', label: 'Whole flat' },
    ];
  }
  return [
    { value: 'surface', label: 'This one' },
    { value: 'all', label: 'All alike' },
  ];
}

const PICKABLE_ROOMS = ROOMS.filter((r) => r.floor !== false);

/** Lets you choose a surface from lists when clicking it in the view is awkward. */
function SurfacePicker({ onPick }: { onPick: (kind: SurfaceKind) => void }) {
  const select = useStore((s) => s.select);
  const [roomId, setRoomId] = useState<string | null>('salon');
  const room = PICKABLE_ROOMS.find((r) => r.id === roomId);
  const first = (kind: SurfaceKind) =>
    SURFACES.find((s) => s.kind === kind && room && (s.roomId === room.id || s.group === groupOf(room)));
  return (
    <Stack gap={8}>
      <Text size="sm" c="dimmed">
        Click a floor, wall or ceiling in the 3D view to restyle it — or pick one here.
      </Text>
      <Select
        size="sm"
        value={roomId}
        onChange={setRoomId}
        data={PICKABLE_ROOMS.map((r) => ({ value: r.id, label: r.name }))}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
      />
      <Group gap={6} grow>
        {(['floor', 'wall', 'ceiling'] as const).map((kind) => {
          const target = first(kind);
          return (
            <Button key={kind} size="compact-sm" variant="default" disabled={!target} onClick={() => { if (target) { onPick(kind); select(target.key); } }}>
              {kind === 'wall' ? 'Walls' : kind === 'floor' ? 'Floor' : 'Ceiling'}
            </Button>
          );
        })}
      </Group>
    </Stack>
  );
}

function Swatch({ preset, active, onPick }: { preset: MaterialPreset; active: boolean; onPick: () => void }) {
  const thumb = useMemo(() => presetThumbnail(preset.id), [preset.id]);
  return (
    <UnstyledButton className={`swatch${active ? ' active' : ''}`} onClick={onPick} aria-pressed={active}>
      <div
        className="swatch-chip"
        style={thumb ? { backgroundImage: `url(${thumb})` } : { background: preset.color }}
      />
      <div className="swatch-name">{preset.name}</div>
    </UnstyledButton>
  );
}

export function MaterialsTab() {
  const selected = useStore((s) => s.selected);
  const assignment = useStore((s) => (s.selected ? s.assignments[s.selected] : undefined));
  const customPresets = useStore((s) => s.customPresets);
  const { assign, select, resetMaterials, addCustomPreset } = useStore.getState();
  const [scope, setScope] = useState<Scope>('surface');
  const [showAll, setShowAll] = useState(false);

  const surface = selected ? SURFACE_BY_KEY.get(selected) : undefined;
  if (!surface || !assignment || !selected) {
    return (
      <Stack gap="lg">
        <SurfacePicker onPick={(kind) => setScope(kind === 'wall' ? 'room' : 'surface')} />
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconRestore size={14} />} onClick={resetMaterials}>
          Reset all finishes
        </Button>
      </Stack>
    );
  }

  const scopes = scopesFor(surface.kind);
  const activeScope = scopes.some((s) => s.value === scope) ? scope : 'surface';
  const keys = keysInScope(selected, activeScope);
  const area = keys.reduce((sum, key) => sum + (SURFACE_AREA.get(key) ?? 0), 0);
  const floorLike = surface.kind === 'floor' || surface.kind === 'tread';
  const preset = presetById(assignment.preset);
  const offered = [...PRESETS, ...customPresets].filter(
    (p) => showAll || p.use === 'both' || p.use === (floorLike ? 'floor' : 'wall') || p.id === preset.id || p.imageUrl,
  );

  const upload = (file: File | null) => {
    if (!file) return;
    const id = `custom-${Date.now()}`;
    addCustomPreset({
      id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 22), use: 'both', color: '#888888',
      roughness: 0.6, imageUrl: URL.createObjectURL(file), size: [1, 1],
    });
    assign(keys, { preset: id });
  };

  return (
    <Stack gap="lg">
      <Stack gap={8}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div>
            <div className="section-title">Selected</div>
            <Text fw={600} size="sm" mt={2}>{surface.label}</Text>
          </div>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => select(null)}>Clear</Button>
        </Group>
        <SegmentedControl fullWidth size="xs" value={activeScope} onChange={(v) => setScope(v as Scope)} data={scopes} />
        <Text size="xs" c="dimmed">
          {keys.length === 1 ? 'Changes apply to this surface only.' : `Changes apply to ${keys.length} surfaces.`}
        </Text>
      </Stack>

      <Stack gap={8}>
        <Group justify="space-between">
          <div className="section-title">Material</div>
          <Switch size="xs" label="Show all" checked={showAll} onChange={(e) => setShowAll(e.currentTarget.checked)} />
        </Group>
        <SimpleGrid cols={3} spacing={6} verticalSpacing={6}>
          {offered.map((p) => (
            <Swatch key={p.id} preset={p} active={p.id === preset.id} onPick={() => assign(keys, { preset: p.id })} />
          ))}
        </SimpleGrid>
        <FileButton onChange={upload} accept="image/png,image/jpeg,image/webp">
          {(props) => (
            <Button {...props} size="compact-sm" variant="default" leftSection={<IconUpload size={14} />}>
              Use your own texture image
            </Button>
          )}
        </FileButton>
      </Stack>

      <Stack gap={10}>
        <div className="section-title">Adjust</div>
        <ColorInput
          size="sm"
          label={preset.texture || preset.imageUrl ? 'Tint' : 'Colour'}
          value={assignment.tint ?? (preset.texture || preset.imageUrl ? '#ffffff' : preset.color)}
          onChange={(tint) => assign(keys, { tint })}
          swatches={PAINT_COLOURS}
          swatchesPerRow={7}
          format="hex"
          popoverProps={{ withinPortal: true }}
        />
        {(preset.texture || preset.imageUrl) && (
          <>
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm">Pattern size</Text>
                <Text size="sm" c="dimmed">×{(assignment.scale ?? 1).toFixed(2)}</Text>
              </Group>
              <Slider
                min={0.25}
                max={3}
                step={0.05}
                value={assignment.scale ?? 1}
                onChange={(scale) => assign(keys, { scale })}
                label={null}
              />
            </div>
            <Switch
              label="Turn pattern 90°"
              checked={!!assignment.rot}
              onChange={(e) => assign(keys, { rot: e.currentTarget.checked })}
            />
          </>
        )}
      </Stack>

      <Stack gap={8}>
        <div className="section-title">Buying it</div>
        <Text size="sm" c="dimmed">
          This selection covers about <b>{area.toFixed(1)} m²</b>. Allow 5–10 % extra for cuts.
        </Text>
        {FINISH_SEARCH[preset.id] && (
          <Button
            component="a"
            href={leroySearchUrl(FINISH_SEARCH[preset.id])}
            target="_blank"
            rel="noopener noreferrer"
            size="compact-sm"
            variant="default"
            leftSection={<IconSearch size={14} />}
          >
            Find “{FINISH_SEARCH[preset.id]}” on Leroy Merlin
          </Button>
        )}
      </Stack>

      <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconRestore size={14} />} onClick={resetMaterials}>
        Reset all finishes
      </Button>
    </Stack>
  );
}
