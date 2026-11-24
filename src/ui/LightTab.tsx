import {
  ActionIcon, Alert, Button, ColorSwatch, Group, SegmentedControl, SimpleGrid, Slider, Stack, Switch, Text, Tooltip, UnstyledButton,
} from '@mantine/core';
import { IconBulb, IconMoon, IconSun, IconSunrise, IconSunset, IconTrash, IconX } from '@tabler/icons-react';
import { LEVELS } from '../model/apartment.ts';
import { LAMPS, lampDef } from '../model/furniture.ts';
import type { Lamp, LampKind } from '../model/types.ts';
import { formatHour } from '../scene/sun';
import { COOL, MAX_LAMPS, NEUTRAL, WARM, roomOf, useStore } from '../state/store';
import { Nudge } from './Nudge';
import { ProductFields } from './ProductFields';

const TONES = [
  { color: WARM, label: 'Warm 2700 K' },
  { color: NEUTRAL, label: 'Neutral 4000 K' },
  { color: COOL, label: 'Daylight 6500 K' },
  { color: '#ff9d6b', label: 'Amber' },
  { color: '#b8a2ff', label: 'Violet' },
];

const SCENES = [
  { label: 'Morning', icon: IconSunrise, hour: 8, lamps: 'day' },
  { label: 'Day', icon: IconSun, hour: 13.5, lamps: 'day' },
  { label: 'Sunset', icon: IconSunset, hour: 17.25, lamps: 'all' },
  { label: 'Night', icon: IconMoon, hour: 21.5, lamps: 'all' },
] as const;

const shortName = (kind: LampKind) => lampDef(kind).name.replace(' light', '');

function Tones({ lamp }: { lamp: Lamp }) {
  const updateLamp = useStore((s) => s.updateLamp);
  return (
    <Group gap={5} wrap="nowrap">
      {TONES.map((t) => (
        <Tooltip key={t.color} label={t.label} withArrow openDelay={300}>
          <ColorSwatch
            component="button"
            size={16}
            color={t.color}
            aria-label={t.label}
            onClick={() => updateLamp(lamp.id, { color: t.color, on: true })}
            style={{
              cursor: 'pointer',
              outline: lamp.color === t.color ? '2px solid var(--mantine-color-amber-5)' : 'none',
              outlineOffset: 1,
            }}
          />
        </Tooltip>
      ))}
    </Group>
  );
}

/** Everything adjustable about the selected lamp. */
function LampEditor({ lamp }: { lamp: Lamp }) {
  const { updateLamp, removeLamp, pick } = useStore.getState();
  const def = lampDef(lamp.kind);
  const set = (patch: Partial<Lamp>) => updateLamp(lamp.id, patch);
  return (
    <Stack gap={10}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <div className="section-title">Selected light</div>
          <Text fw={600} size="sm" mt={2}>{def.name}</Text>
          <Text size="xs" c="dimmed">{roomOf(lamp)?.name ?? 'Outside a room'} · {LEVELS[lamp.level].name}</Text>
        </div>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Delete" withArrow><ActionIcon variant="default" aria-label="Delete light" onClick={() => removeLamp(lamp.id)}><IconTrash size={15} /></ActionIcon></Tooltip>
          <Tooltip label="Deselect" withArrow><ActionIcon variant="subtle" color="gray" aria-label="Deselect" onClick={() => pick(null)}><IconX size={15} /></ActionIcon></Tooltip>
        </Group>
      </Group>
      <SegmentedControl
        fullWidth
        size="xs"
        value={lamp.kind}
        onChange={(v) => {
          const next = lampDef(v as LampKind);
          set({ kind: next.kind, drop: next.drop, angle: next.angle, intensity: next.intensity });
        }}
        data={LAMPS.map((l) => ({ value: l.kind, label: shortName(l.kind) }))}
      />
      <Group justify="space-between">
        <Switch size="sm" label="On" checked={lamp.on} onChange={(e) => set({ on: e.currentTarget.checked })} />
        <Tones lamp={lamp} />
      </Group>
      <div>
        <Text size="sm" mb={4}>Brightness</Text>
        <Slider min={0} max={40} step={0.5} value={lamp.intensity} onChange={(intensity) => set({ intensity })} label={(v) => `${v} cd`} />
      </div>
      {lamp.kind === 'pendant' && (
        <div>
          <Text size="sm" mb={4}>Hangs {Math.round((lamp.drop ?? 0.9) * 100)} cm below the ceiling</Text>
          <Slider min={0.2} max={1.8} step={0.05} value={lamp.drop ?? 0.9} onChange={(drop) => set({ drop })} label={null} />
        </div>
      )}
      {lamp.kind === 'spot' && (
        <div>
          <Text size="sm" mb={4}>Beam {Math.round(lamp.angle ?? 70)}°</Text>
          <Slider min={20} max={120} step={5} value={lamp.angle ?? 70} onChange={(angle) => set({ angle })} label={null} />
        </div>
      )}
      <Nudge x={lamp.x} z={lamp.z} onMove={(x, z) => set({ x, z })} />
      <ProductFields product={lamp.product} search={def.search} onChange={(product) => set({ product })} />
    </Stack>
  );
}

export function LightTab() {
  const sun = useStore((s) => s.sun);
  const ambient = useStore((s) => s.ambient);
  const exposure = useStore((s) => s.exposure);
  const lamps = useStore((s) => s.lamps);
  const picked = useStore((s) => s.picked);
  const placing = useStore((s) => s.placing);
  const mode = useStore((s) => s.mode);
  const { setSun, setAllLamps, setScene, patch, updateLamp, pick, startPlacing, resetLamps } = useStore.getState();
  const selected = picked?.type === 'lamp' ? lamps.find((l) => l.id === picked.id) : undefined;
  const full = lamps.length >= MAX_LAMPS;

  return (
    <Stack gap="lg">
      {placing?.type === 'lamp' && mode === 'orbit' && (
        <Alert variant="light" p="xs" icon={<IconBulb size={16} />}>
          <Group justify="space-between" wrap="nowrap" gap={8}>
            <Text size="sm">Click a floor: the light goes above that spot.</Text>
            <Button size="compact-xs" variant="default" onClick={() => startPlacing(null)}>Cancel</Button>
          </Group>
        </Alert>
      )}

      {selected && <LampEditor lamp={selected} />}

      <Stack gap={8}>
        <div className="section-title">Add a light</div>
        <SimpleGrid cols={2} spacing={6} verticalSpacing={6}>
          {LAMPS.map((l) => (
            <Button
              key={l.kind}
              size="compact-sm"
              variant={placing?.type === 'lamp' && placing.kind === l.kind ? 'light' : 'default'}
              disabled={full}
              onClick={() => startPlacing({ type: 'lamp', kind: l.kind })}
            >
              {l.name}
            </Button>
          ))}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          {full
            ? `That is the limit of ${MAX_LAMPS} lights; remove one to add another.`
            : mode === 'walk'
              ? 'In walk mode a new light appears just ahead of you.'
              : 'Pick a type, then click a floor. Drag a fitting to move it.'}
        </Text>
      </Stack>

      <Stack gap={8}>
        <div className="section-title">Scenes</div>
        <SimpleGrid cols={2} spacing={6} verticalSpacing={6}>
          {SCENES.map(({ label, icon: Icon, hour, lamps: which }) => (
            <Button key={label} size="compact-sm" variant="default" leftSection={<Icon size={14} />} onClick={() => setScene(hour, which)}>
              {label}
            </Button>
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap={10}>
        <Group justify="space-between">
          <div className="section-title">Sun</div>
          <Switch size="sm" checked={sun.on} onChange={(e) => setSun({ on: e.currentTarget.checked })} aria-label="Sun" />
        </Group>
        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm">Time of day</Text>
            <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHour(sun.hour)}</Text>
          </Group>
          <Slider
            min={5}
            max={22}
            step={0.25}
            value={sun.hour}
            onChange={(hour) => setSun({ hour })}
            label={formatHour}
            marks={[{ value: 6 }, { value: 12 }, { value: 18 }]}
            disabled={!sun.on}
          />
        </div>
        <div>
          <Text size="sm" mb={4}>Sun strength</Text>
          <Slider min={0} max={8} step={0.1} value={sun.intensity} onChange={(intensity) => setSun({ intensity })} disabled={!sun.on} />
        </div>
        <div>
          <Text size="sm" mb={4}>Ambient fill</Text>
          <Slider min={0} max={1.5} step={0.05} value={ambient} onChange={(v) => patch({ ambient: v })} />
        </div>
        <div>
          <Text size="sm" mb={4}>Exposure</Text>
          <Slider min={0.3} max={2.5} step={0.05} value={exposure} onChange={(v) => patch({ exposure: v })} />
        </div>
      </Stack>

      <Stack gap={10}>
        <Group justify="space-between">
          <div className="section-title">Lights · {lamps.length}</div>
          <Group gap={6}>
            <Button size="compact-xs" variant="default" onClick={() => setAllLamps(true)}>All on</Button>
            <Button size="compact-xs" variant="default" onClick={() => setAllLamps(false)}>All off</Button>
          </Group>
        </Group>
        {[...LEVELS].reverse().map((level) => {
          const onLevel = lamps.filter((l) => l.level === level.index);
          if (!onLevel.length) return null;
          return (
            <Stack key={level.id} gap={10}>
              <Text size="xs" fw={600} c="dimmed">{level.name}</Text>
              {onLevel.map((l) => (
                <Stack key={l.id} gap={5}>
                  <Group justify="space-between" wrap="nowrap" gap={8}>
                    <Switch size="sm" checked={l.on} onChange={(e) => updateLamp(l.id, { on: e.currentTarget.checked })} aria-label={`${lampDef(l.kind).name} on`} />
                    <UnstyledButton
                      onClick={() => pick({ type: 'lamp', id: l.id })}
                      style={{ flex: 1, minWidth: 0, fontSize: 13, color: selected?.id === l.id ? 'var(--mantine-color-amber-4)' : undefined }}
                    >
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {roomOf(l)?.name ?? 'Outside'} · {shortName(l.kind).toLowerCase()}
                      </span>
                    </UnstyledButton>
                    <Tones lamp={l} />
                  </Group>
                  <Slider size="sm" min={0} max={40} step={0.5} value={l.intensity} onChange={(intensity) => updateLamp(l.id, { intensity })} disabled={!l.on} label={(v) => `${v} cd`} />
                </Stack>
              ))}
            </Stack>
          );
        })}
        <Button size="compact-xs" variant="subtle" color="gray" onClick={resetLamps}>
          Back to the original fittings
        </Button>
      </Stack>
    </Stack>
  );
}
