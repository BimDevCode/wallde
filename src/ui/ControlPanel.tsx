import { ActionIcon, ScrollArea, Tabs, Text, Title, Tooltip } from '@mantine/core';
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { PROJECT } from '../model/apartment.ts';
import { useStore } from '../state/store';
import { ExportTab } from './ExportTab';
import { FurnitureTab } from './FurnitureTab';
import { LightTab } from './LightTab';
import { MaterialsTab } from './MaterialsTab';
import { ViewTab } from './ViewTab';

export function ControlPanel() {
  const open = useStore((s) => s.panelOpen);
  const selected = useStore((s) => s.selected);
  const pickedType = useStore((s) => s.picked?.type ?? null);
  const placingType = useStore((s) => s.placing?.type ?? null);
  const patch = useStore((s) => s.patch);
  const [tab, setTab] = useState<string | null>('view');

  // Picking a surface in the view is a request to restyle it.
  useEffect(() => {
    if (selected) setTab('materials');
  }, [selected]);
  // Likewise a lamp or a piece of furniture opens the tab that edits it.
  useEffect(() => {
    const type = pickedType ?? placingType;
    if (type) setTab(type === 'lamp' ? 'light' : 'furnish');
  }, [pickedType, placingType]);

  return (
    <>
      {!open && (
        <Tooltip label="Show panel" position="right" withArrow>
          <ActionIcon className="panel-toggle" data-ui variant="default" size="lg" onClick={() => patch({ panelOpen: true })} aria-label="Show panel">
            <IconLayoutSidebarLeftExpand size={18} />
          </ActionIcon>
        </Tooltip>
      )}
      <aside className={`panel${open ? '' : ' closed'}`} data-ui aria-hidden={!open}>
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <Title order={1} size="h4" lh={1.2}>{PROJECT.name}</Title>
              <Text size="xs" c="dimmed" mt={2}>
                osiedle Niezapominajek · {PROJECT.totalArea.toFixed(2)} m² · 3 levels
              </Text>
            </div>
            <ActionIcon variant="subtle" color="gray" onClick={() => patch({ panelOpen: false })} aria-label="Hide panel">
              <IconLayoutSidebarLeftCollapse size={18} />
            </ActionIcon>
          </div>
        </div>
        <Tabs value={tab} onChange={setTab} className="panel-body" style={{ display: 'flex', flexDirection: 'column' }} keepMounted={false}>
          <Tabs.List grow>
            <Tabs.Tab value="view" px={6}>View</Tabs.Tab>
            <Tabs.Tab value="light" px={6}>Light</Tabs.Tab>
            <Tabs.Tab value="materials" px={6}>Finishes</Tabs.Tab>
            <Tabs.Tab value="furnish" px={6}>Furnish</Tabs.Tab>
            <Tabs.Tab value="export" px={6}>Export</Tabs.Tab>
          </Tabs.List>
          <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto" offsetScrollbars={false}>
            <div style={{ padding: 16 }}>
              <Tabs.Panel value="view"><ViewTab /></Tabs.Panel>
              <Tabs.Panel value="light"><LightTab /></Tabs.Panel>
              <Tabs.Panel value="materials"><MaterialsTab /></Tabs.Panel>
              <Tabs.Panel value="furnish"><FurnitureTab /></Tabs.Panel>
              <Tabs.Panel value="export"><ExportTab /></Tabs.Panel>
            </div>
          </ScrollArea>
        </Tabs>
      </aside>
    </>
  );
}
