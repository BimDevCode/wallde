import { ActionIcon, Kbd, SegmentedControl, Stack, Switch, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconWalk } from '@tabler/icons-react';
import { LEVELS, ROOMS } from '../model/apartment.ts';
import { QUALITY, type QualityId } from '../scene/quality';
import { roomAnchor, useStore } from '../state/store';

const LISTED = ROOMS.filter((r) => r.floor !== false);

export function ViewTab() {
  const mode = useStore((s) => s.mode);
  const top = useStore((s) => s.visibleLevel);
  const current = useStore((s) => (s.mode === 'walk' ? s.player.roomId : null));
  const ao = useStore((s) => s.ao);
  const shadows = useStore((s) => s.shadows);
  const context = useStore((s) => s.context);
  const quality = useStore((s) => s.quality);
  const autoResolution = useStore((s) => s.autoResolution);
  const dpr = useStore((s) => s.dpr);
  const fps = useStore((s) => s.fps);
  const { setMode, setVisibleLevel, goToRoom, walkTo, patch, setQuality } = useStore.getState();

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <div className="section-title">Camera</div>
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(v) => setMode(v as 'orbit' | 'walk')}
          data={[
            { value: 'orbit', label: 'Overview' },
            { value: 'walk', label: 'Walk through' },
          ]}
        />
      </Stack>

      {mode === 'orbit' && (
        <Stack gap={6}>
          <div className="section-title">Show up to</div>
          <SegmentedControl
            fullWidth
            size="xs"
            value={String(top)}
            onChange={(v) => setVisibleLevel(Number(v))}
            data={[...LEVELS.map((l) => ({ value: String(l.index), label: l.name })), { value: '3', label: 'Roof' }]}
          />
          <Text size="xs" c="dimmed">
            Storeys above the chosen one are lifted off so you can look into the rooms.
          </Text>
        </Stack>
      )}

      <Stack gap={6}>
        <div className="section-title">Rooms</div>
        {[...LEVELS].reverse().map((level) => (
          <Stack key={level.id} gap={0}>
            <Text size="xs" fw={600} c="dimmed" mt={4} mb={2}>
              {level.name}
            </Text>
            {LISTED.filter((r) => r.level === level.index).map((room) => (
              <UnstyledButton
                key={room.id}
                className={`room-row${current === room.id ? ' current' : ''}`}
                onClick={() => goToRoom(room.id)}
              >
                {room.name}
                <span className="area">{room.area ? `${room.area.toFixed(2)} m²` : '—'}</span>
                {mode === 'orbit' && (
                  <Tooltip label="Walk here" withArrow openDelay={300}>
                    <ActionIcon
                      component="span"
                      size="sm"
                      variant="subtle"
                      color="gray"
                      aria-label={`Walk in ${room.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        walkTo(...roomAnchor(room), room.level);
                      }}
                    >
                      <IconWalk size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </UnstyledButton>
            ))}
          </Stack>
        ))}
      </Stack>

      <Stack gap={10}>
        <div className="section-title">Rendering</div>
        <SegmentedControl
          fullWidth
          size="xs"
          value={quality}
          onChange={(v) => setQuality(v as QualityId)}
          data={(Object.keys(QUALITY) as QualityId[]).map((id) => ({ value: id, label: QUALITY[id].label }))}
          aria-label="Render quality"
        />
        <Text size="xs" c="dimmed">
          Up to {QUALITY[quality].points + QUALITY[quality].spots} lamps light the room at once (the nearest ones);
          drawing at ×{dpr.toFixed(2)} resolution{fps !== null ? `, ${fps} frames a second when last moving` : ''}.
        </Text>
        <Switch
          label="Lower resolution when it gets slow"
          checked={autoResolution}
          onChange={(e) => patch({ autoResolution: e.currentTarget.checked })}
        />
        <Switch
          label="Screen-space ambient occlusion"
          description="Finer contact shadows, at several times the cost. Off, corners are shaded by baked strips."
          checked={ao}
          onChange={(e) => patch({ ao: e.currentTarget.checked })}
        />
        <Switch label="Shadows" checked={shadows} onChange={(e) => patch({ shadows: e.currentTarget.checked })} />
        <Switch
          label="Neighbouring units (grey volumes)"
          checked={context}
          onChange={(e) => patch({ context: e.currentTarget.checked })}
        />
      </Stack>

      <Stack gap={6}>
        <div className="section-title">Walk controls</div>
        <Text size="xs" c="dimmed" lh={1.9}>
          <Kbd size="xs">W</Kbd> <Kbd size="xs">A</Kbd> <Kbd size="xs">S</Kbd> <Kbd size="xs">D</Kbd> move ·{' '}
          <Kbd size="xs">Shift</Kbd> run · mouse to look
          <br />
          Click a surface to select it · <Kbd size="xs">Q</Kbd> <Kbd size="xs">E</Kbd> change its material
          <br />
          <Kbd size="xs">L</Kbd> room light · <Kbd size="xs">Esc</Kbd> free the mouse
        </Text>
      </Stack>
    </Stack>
  );
}
