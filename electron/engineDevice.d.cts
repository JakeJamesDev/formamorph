export const ENGINE_DEVICE_AUTO: 'auto';
export const ENGINE_DEVICE_ALL: 'all';
export const LOW_VRAM_LIMIT_MB: number;
export function namesMatch(a: unknown, b: unknown): boolean;
export function isIntegrated(name: unknown): boolean;
export function selectEngineDevice(facts?: {
  deviceNames?: string[] | null;
  nvidiaGpus?: { name: string; totalMB?: number | null }[] | null;
  setting?: string | null;
}): { index: number | null; origin: 'auto' | 'manual' | 'fallback-auto' | null };
export function engineVramClass(facts?: {
  devices?: { name: string; totalMB: number | null }[] | null;
  listed?: boolean;
  nvidiaGpus?: { name: string; totalMB?: number | null }[] | null;
  setting?: string | null;
}): 'low' | 'ok' | 'unknown';
