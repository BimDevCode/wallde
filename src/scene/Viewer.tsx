import { Canvas } from '@react-three/fiber';
import { useStore } from '../state/store';
import { Effects } from './Effects';
import { ApartmentModel, Ground, SelectionOutline } from './ApartmentModel';
import { Furnishings, Ghost } from './Furnishings';
import { Lamps } from './Lamps';
import { Lighting } from './Lighting';
import { sceneRegistry } from './registry';
import { OrbitRig } from './OrbitRig';
import { AdaptiveResolution, RenderOnDemand } from './Performance';
import { WalkRig } from './WalkRig';

export function Viewer() {
  const mode = useStore((s) => s.mode);
  const dpr = useStore((s) => s.dpr);
  return (
    <Canvas
      shadows="percentage"
      dpr={dpr}
      // Walking needs a steady stream of frames; the overview only redraws when something changes.
      frameloop={mode === 'walk' ? 'always' : 'demand'}
      camera={{ fov: 40, near: 0.1, far: 600, position: [17.5, 15.5, 25] }}
      // Anti-aliasing is done by the effect chain's own multisampled buffer, not the canvas.
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        const s = useStore.getState();
        if (s.mode !== 'orbit' || s.placing) return;
        s.select(null);
        s.pick(null);
      }}
    >
      <RenderOnDemand />
      <AdaptiveResolution />
      <Lighting />
      {/* Everything that is part of the flat sits in one group, which is what the GLB export saves. */}
      <group name="Botanika 5M2" ref={(group) => { sceneRegistry.root = group; }}>
        <ApartmentModel />
        <Furnishings />
        <Lamps />
      </group>
      <SelectionOutline />
      <Ghost />
      <Ground />
      {mode === 'orbit' ? <OrbitRig /> : <WalkRig />}
      <Effects />
    </Canvas>
  );
}
