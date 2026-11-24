import { Component, useEffect, type ReactNode } from 'react';
import { Button, Stack, Text, Title } from '@mantine/core';
import { Viewer } from './scene/Viewer';
import { useStore } from './state/store';
import { ControlPanel } from './ui/ControlPanel';
import { Hud } from './ui/Hud';
import { Minimap } from './ui/Minimap';

/** Keeps a rendering error from leaving a silent blank page. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Stack align="center" justify="center" h="100%" gap="sm" p="xl">
        <Title order={2} size="h4">The 3D view stopped working</Title>
        <Text size="sm" c="dimmed" maw={460} ta="center">{this.state.error.message}</Text>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </Stack>
    );
  }
}

/** Keys that work anywhere outside a text field: Esc cancels, Delete removes, R turns. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey) return;
      const s = useStore.getState();
      if (e.key === 'Escape') {
        if (s.placing) s.startPlacing(null);
        else if (s.picked) s.pick(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.picked) {
        e.preventDefault();
        s.removePicked();
      } else if (e.code === 'KeyR' && s.picked?.type === 'furniture') {
        const item = s.furniture.find((f) => f.id === s.picked!.id);
        if (item) s.updateFurniture(item.id, { rot: (item.rot + (e.shiftKey ? 15 : 90)) % 360 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const mode = useStore((s) => s.mode);
  const placing = useStore((s) => s.placing !== null);
  useShortcuts();
  return (
    <ErrorBoundary>
      <div className="app">
        <div className={`viewport${mode === 'walk' ? ' walking' : ''}${placing && mode === 'orbit' ? ' placing' : ''}`}>
          <Viewer />
        </div>
        <ControlPanel />
        <Minimap />
        <Hud />
      </div>
    </ErrorBoundary>
  );
}
