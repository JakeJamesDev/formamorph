export const CACHE_TYPES: readonly string[];
export function cacheType(value: unknown): string;
export function effectiveVCacheType(value: unknown, flashAttention: boolean | undefined): string;
