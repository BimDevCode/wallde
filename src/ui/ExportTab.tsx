import { useState } from 'react';
import { Alert, Button, List, Stack, Text } from '@mantine/core';
import { IconBuildingSkyscraper, IconCube, IconInfoCircle } from '@tabler/icons-react';
import { downloadGlb, downloadIfc } from '../export/download';
import { LEVELS, PROJECT, ROOMS, STAIRS, WALLS } from '../model/apartment.ts';
import { useStore } from '../state/store';

const doors = WALLS.flatMap((w) => w.openings ?? []);

export function ExportTab() {
  const furnitureCount = useStore((s) => s.furniture.length);
  const lampCount = useStore((s) => s.lamps.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const glb = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadGlb();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="lg">
      <Stack gap={8}>
        <div className="section-title">Revit</div>
        <Button leftSection={<IconBuildingSkyscraper size={16} />} onClick={downloadIfc}>
          Download IFC for Revit
        </Button>
        <Text size="sm" c="dimmed">
          An IFC2x3 building model: {WALLS.length} walls with {doors.length} door and window openings, floor slabs,
          both stair flights, balustrades and {ROOMS.filter((r) => r.floor !== false).length} rooms across {LEVELS.length} levels.
          {furnitureCount + lampCount > 0 &&
            ` Your ${furnitureCount} furniture pieces and ${lampCount} lights go along as plain blocks of the right size.`}
        </Text>
        <List size="sm" spacing={4} type="ordered" c="gray.4">
          <List.Item>In Revit choose <b>File ▸ Open ▸ IFC</b> and pick the downloaded file.</List.Item>
          <List.Item>Revit creates the levels Parter, 1 piętro and 2 piętro and rebuilds the walls, slabs, doors and windows on them.</List.Item>
          <List.Item>To keep it as a reference inside an existing project use <b>Insert ▸ Link IFC</b> instead.</List.Item>
        </List>
        <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />} p="xs">
          <Text size="xs">
            Geometry and room data transfer; the finishes and lights chosen here do not — IFC carries the building, not
            the render look. Dimensions were scaled from the brochure plan, so check them against a survey before
            relying on them.
          </Text>
        </Alert>
      </Stack>

      <Stack gap={8}>
        <div className="section-title">3D scene</div>
        <Button variant="default" leftSection={<IconCube size={16} />} onClick={glb} loading={busy}>
          Download GLB with materials
        </Button>
        <Text size="sm" c="dimmed">
          The scene exactly as styled here, textures included, for Blender, Twinmotion, Unreal or a web viewer.
        </Text>
        {error && <Alert color="red" p="xs">{error}</Alert>}
      </Stack>

      <Stack gap={4}>
        <div className="section-title">Model</div>
        <Text size="sm" c="dimmed">
          {PROJECT.estate} · {PROJECT.totalArea.toFixed(2)} m² · {LEVELS.length} levels · {STAIRS.length} stair flights
        </Text>
      </Stack>
    </Stack>
  );
}
