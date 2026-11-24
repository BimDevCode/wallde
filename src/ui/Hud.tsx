import { Kbd } from '@mantine/core';
import { roomById } from '../model/apartment.ts';
import { furnitureDef, lampDef } from '../model/furniture.ts';
import { useStore } from '../state/store';

/** Room label, key hints and the aiming dot over the 3D view. */
export function Hud() {
  const mode = useStore((s) => s.mode);
  const locked = useStore((s) => s.locked);
  const roomId = useStore((s) => s.player.roomId);
  const room = mode === 'walk' && roomId ? roomById(roomId) : undefined;
  const placing = useStore((s) => s.placing);
  const placingName = placing
    ? placing.type === 'lamp' ? lampDef(placing.kind).name : placing.product?.name ?? furnitureDef(placing.kind).name
    : null;

  return (
    <>
      {mode === 'walk' && <div className="crosshair" />}
      <div className="hud">
        {mode === 'walk' && room && (
          <div className="hud-room">
            {room.name}
            {room.area ? <span>{room.area.toFixed(2)} m²</span> : null}
          </div>
        )}
        <div className="hud-hint">
          {placingName && mode === 'orbit' ? (
            <>
              <span>Click a floor to place: <b>{placingName}</b></span>
              <span><Kbd size="xs">Esc</Kbd> cancel</span>
            </>
          ) : mode === 'orbit' ? (
            <>
              <span>Drag to orbit</span>
              <span>Right-drag to pan</span>
              <span>Scroll to zoom</span>
              <span>Click a surface to restyle it</span>
              <span>Drag furniture and lights to move them</span>
              <span>Double-click a floor to walk there</span>
            </>
          ) : locked ? (
            <>
              <span><Kbd size="xs">W</Kbd> <Kbd size="xs">A</Kbd> <Kbd size="xs">S</Kbd> <Kbd size="xs">D</Kbd> move</span>
              <span><Kbd size="xs">Shift</Kbd> run</span>
              <span>Click selects a surface</span>
              <span><Kbd size="xs">Q</Kbd> <Kbd size="xs">E</Kbd> material</span>
              <span><Kbd size="xs">L</Kbd> light</span>
              <span><Kbd size="xs">Esc</Kbd> free mouse</span>
            </>
          ) : (
            <>
              <span>Click the view to look around with the mouse</span>
              <span><Kbd size="xs">W</Kbd> <Kbd size="xs">A</Kbd> <Kbd size="xs">S</Kbd> <Kbd size="xs">D</Kbd> or arrows to move</span>
              <span>Drag also turns the view</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
