import { useEffect, useState } from 'react';
import { SegmentedControl, Text } from '@mantine/core';
import { BOUNDS, LEVELS, ROOMS, STAIRS, WALLS } from '../model/apartment.ts';
import { footprint } from '../model/furniture.ts';
import { useStore } from '../state/store';

const PAD = 0.5;
const VIEW = `${BOUNDS.x0 - PAD} ${BOUNDS.z0 - PAD} ${BOUNDS.x1 - BOUNDS.x0 + 2 * PAD} ${BOUNDS.z1 - BOUNDS.z0 + 2 * PAD}`;

/** A north-up plan of one storey, drawn from the same data as the 3D model. */
export function Minimap() {
  const mode = useStore((s) => s.mode);
  const top = useStore((s) => s.visibleLevel);
  const player = useStore((s) => s.player);
  const goToRoom = useStore((s) => s.goToRoom);
  const furniture = useStore((s) => s.furniture);
  const lamps = useStore((s) => s.lamps);
  const pickedId = useStore((s) => s.picked?.id ?? null);
  const [level, setLevel] = useState(Math.min(top, 2));

  // Follow the walker between storeys, and the overview's storey switch.
  useEffect(() => {
    setLevel(mode === 'walk' ? player.level : Math.min(top, 2));
  }, [mode, player.level, top]);

  const current = mode === 'walk' && player.level === level ? player.roomId : null;
  const hx = -Math.sin(player.yaw), hz = -Math.cos(player.yaw);

  return (
    <div className="minimap" data-ui>
      <SegmentedControl
        fullWidth
        size="xs"
        mb={8}
        value={String(level)}
        onChange={(v) => setLevel(Number(v))}
        data={LEVELS.map((l) => ({ value: String(l.index), label: l.index === 0 ? 'P' : String(l.index) }))}
        aria-label="Storey shown on the plan"
      />
      <svg viewBox={VIEW} role="img" aria-label={`Plan of ${LEVELS[level].name}`}>
        {ROOMS.filter((r) => r.level === level).map((r) => (
          <polygon
            key={r.id}
            className={`room${r.outdoor ? ' outdoor' : ''}${current === r.id ? ' current' : ''}`}
            points={r.polygon.map((p) => p.join(',')).join(' ')}
            onClick={() => r.floor !== false && goToRoom(r.id)}
          >
            <title>{r.area ? `${r.name} · ${r.area.toFixed(2)} m²` : r.name}</title>
          </polygon>
        ))}
        {STAIRS.filter((s) => s.level === level).flatMap((s) => {
          const tread = (s.zTop - s.zBottom) / (s.risers - 1);
          return Array.from({ length: s.risers }, (_, k) => (
            <line key={`${s.id}-${k}`} className="stair" x1={s.x0} x2={s.x1} y1={s.zBottom + k * tread} y2={s.zBottom + k * tread} />
          ));
        })}
        {WALLS.filter((w) => w.level === level).map((w) => (
          <rect key={w.id} className="wall" x={w.rect[0]} y={w.rect[1]} width={w.rect[2] - w.rect[0]} height={w.rect[3] - w.rect[1]} />
        ))}
        {WALLS.filter((w) => w.level === level).flatMap((w) =>
          (w.openings ?? []).map((o) => {
            const alongX = w.rect[2] - w.rect[0] >= w.rect[3] - w.rect[1];
            const glazed = o.kind === 'window' || o.kind === 'balconyDoor';
            return alongX ? (
              <rect key={o.id} x={o.from} y={w.rect[1]} width={o.to - o.from} height={w.rect[3] - w.rect[1]} fill={glazed ? '#7fb6d6' : '#181a1e'} />
            ) : (
              <rect key={o.id} x={w.rect[0]} y={o.from} width={w.rect[2] - w.rect[0]} height={o.to - o.from} fill={glazed ? '#7fb6d6' : '#181a1e'} />
            );
          }),
        )}
        {furniture.filter((f) => f.level === level).map((f) => (
          <polygon key={f.id} className={`furniture${pickedId === f.id ? ' picked' : ''}`} points={footprint(f).map((p) => p.join(',')).join(' ')} />
        ))}
        {lamps.filter((l) => l.level === level).map((l) => (
          <circle key={l.id} className="lamp" cx={l.x} cy={l.z} r={pickedId === l.id ? 0.2 : 0.11} fill={l.on ? '#f5ae35' : 'none'} />
        ))}
        {mode === 'walk' && player.level === level && (
          <g>
            <line x1={player.x} y1={player.z} x2={player.x + hx * 0.9} y2={player.z + hz * 0.9} stroke="#f5ae35" strokeWidth={0.12} strokeLinecap="round" />
            <circle cx={player.x} cy={player.z} r={0.3} fill="#f5ae35" stroke="#15171a" strokeWidth={0.08} />
          </g>
        )}
      </svg>
      <Text size="xs" c="dimmed" ta="center" mt={6}>
        {LEVELS[level].name} · north ↑
      </Text>
    </div>
  );
}
