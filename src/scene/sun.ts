import * as THREE from 'three';

export interface SunState {
  /** Unit vector from the scene towards the sun. */
  direction: THREE.Vector3;
  /** Radians above the horizon; negative at night. */
  elevation: number;
  /** 0 at night, 1 in full daylight. */
  daylight: number;
  color: THREE.Color;
}

const NOON = new THREE.Color('#fff3e0');
const DUSK = new THREE.Color('#ff9548');

/**
 * A simple equinox-style sun path: rises due east at 6:00, peaks in the south at
 * noon, sets due west at 18:00. Good enough to study how light moves through the
 * flat during the day; it is not a solar calculator for a real date and place.
 */
export function sunAt(hour: number): SunState {
  const f = (hour - 6) / 12;
  const elevation = Math.sin(Math.PI * f) * THREE.MathUtils.degToRad(56);
  const azimuth = Math.PI / 2 + Math.PI * f;
  const direction = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  );
  const daylight = THREE.MathUtils.clamp(Math.sin(elevation) * 4 + 0.15, 0, 1);
  const warmth = THREE.MathUtils.clamp(1 - Math.sin(elevation) * 2.4, 0, 1);
  return { direction, elevation, daylight, color: NOON.clone().lerp(DUSK, warmth) };
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
