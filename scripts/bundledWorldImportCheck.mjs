// Fails a production build that bundles a whole bundled world: only `?raw` imports, which ship-bundled-worlds strips, may ship.
const WHOLE_WORLD = /[\\/]defaultworlds[\\/]([^\\/?]+\.json)$/;

/** The bundled world files a chunk holds whole, by file name. */
export function wholeWorldModules(moduleIds) {
  return moduleIds.map((id) => WHOLE_WORLD.exec(id)?.[1]).filter(Boolean);
}

/** @returns {import('vite').Plugin} */
export function bundledWorldImportCheck() {
  return {
    name: 'bundled-world-import-check',
    apply: 'build',
    generateBundle(_options, bundle) {
      const problems = Object.values(bundle)
        .filter((out) => out.type === 'chunk')
        .flatMap((chunk) => wholeWorldModules(Object.keys(chunk.modules)).map((world) => `${world} in ${chunk.fileName}`));
      if (problems.length) this.error(`Whole bundled worlds in the build (import them with ?raw, or behind import.meta.env.DEV): ${problems.join('; ')}`);
    },
  };
}
