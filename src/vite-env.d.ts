/// <reference types="vite/client" />

// Injected by Vite (see vite.config.js `define`) from package.json's version.
declare const __APP_VERSION__: string;

// Injected by Vite (see vite.config.js `define`) from the FORMAMORPH_BUILD env: build-type class
// ('portable' | 'installed' | 'web'), empty for a local/dev build.
declare const __BUILD_TARGET__: string;

/**
 * The community server's address, in each build mode.
 *
 * Declared because `vite/client` types every `VITE_` name as `any` through an index signature, and the
 * one module that reads these annotates a `string` — an annotation that would launder anything. The
 * rest of the `VITE_DEFAULT_*` settings still come through the index signature; they are read as text
 * and parsed at their own call sites.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL_DEV: string;
  readonly VITE_API_URL_PROD: string;
}
