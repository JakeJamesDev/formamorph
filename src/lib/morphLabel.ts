/** The player-facing label for a model material, mesh or slider name ("N00_001_Tops_01_CLOTH" → "N00 001 Tops 01 CLOTH"). */
export const cleanLabel = (s: string): string =>
  s.replace(/\([^)]*\)/g, '').replace(/[._]+/g, ' ').trim().replace(/^\w/, (c) => c.toUpperCase());
