import { ActionIcon, Group, Text } from '@mantine/core';
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp } from '@tabler/icons-react';

/** Moves something across the plan in 5 cm steps; directions match the minimap (north up). */
export function Nudge({ x, z, onMove }: { x: number; z: number; onMove: (x: number, z: number) => void }) {
  const step = 0.05;
  const go = (dx: number, dz: number) => onMove(Math.round((x + dx) / step) * step, Math.round((z + dz) / step) * step);
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="sm" style={{ flex: 1 }}>Move 5 cm</Text>
      <ActionIcon variant="default" size="md" aria-label="Move west" onClick={() => go(-step, 0)}><IconArrowLeft size={15} /></ActionIcon>
      <ActionIcon variant="default" size="md" aria-label="Move north" onClick={() => go(0, -step)}><IconArrowUp size={15} /></ActionIcon>
      <ActionIcon variant="default" size="md" aria-label="Move south" onClick={() => go(0, step)}><IconArrowDown size={15} /></ActionIcon>
      <ActionIcon variant="default" size="md" aria-label="Move east" onClick={() => go(step, 0)}><IconArrowRight size={15} /></ActionIcon>
    </Group>
  );
}
