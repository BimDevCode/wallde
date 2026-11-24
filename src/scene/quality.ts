/**
 * Render budgets. Lamp lights are the costliest thing in the scene — every lit
 * pixel pays for every light — so each preset caps how many shine at once.
 */
export type QualityId = 'fast' | 'balanced' | 'high';

export interface Quality {
  label: string;
  /** How many point lights and downlights can be lit at the same time. */
  points: number;
  spots: number;
  /** Upper limit on resolution scale (1 = one render pixel per CSS pixel). */
  dprCap: number;
  /** Ambient-occlusion sampling when it is switched on. */
  ao: 'performance' | 'low' | 'medium';
  sunShadow: number;
  lampShadow: number;
}

export const QUALITY: Record<QualityId, Quality> = {
  fast: { label: 'Fast', points: 2, spots: 1, dprCap: 1, ao: 'performance', sunShadow: 2048, lampShadow: 512 },
  balanced: { label: 'Balanced', points: 4, spots: 2, dprCap: 1.5, ao: 'performance', sunShadow: 4096, lampShadow: 1024 },
  high: { label: 'High', points: 8, spots: 4, dprCap: 2, ao: 'medium', sunShadow: 4096, lampShadow: 1024 },
};

/** Opaque geometry is also tagged with this layer so the depth pre-pass can draw just that. */
export const SOLID_LAYER = 1;

export const DPR_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2];
