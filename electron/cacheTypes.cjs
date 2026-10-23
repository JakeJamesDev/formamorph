'use strict';

// Pure on purpose: the renderer imports this file too, so it uses no Node API and no require.

const CACHE_TYPES = ['f16', 'q8_0', 'q4_0'];

/** A stored cache type, or f16 when it is not one of the three the panel offers. */
function cacheType(value) {
  return CACHE_TYPES.includes(value) ? value : 'f16';
}

/** The V cache type the server may use: a quantized V cache needs Flash Attention, so it falls back to f16 without it. */
function effectiveVCacheType(value, flashAttention) {
  const type = cacheType(value);
  return type !== 'f16' && flashAttention === false ? 'f16' : type;
}

module.exports = { CACHE_TYPES, cacheType, effectiveVCacheType };
