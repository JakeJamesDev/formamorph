// Browser build: the WebGPU runtime's .wasm is over Cloudflare Pages' 25 MiB file cap, so it loads from R2.
import { readFileSync } from 'fs'
import path from 'path'

export const ORT_ASSET_BASE = 'https://assets.formamorph.ai/ort'
// Matches the import before and after the `onnxruntime-web-dist` alias resolves it.
const RUNTIME = /(?:^onnxruntime-web-dist|[\\/]onnxruntime-web[\\/]dist)[\\/](ort-wasm-simd-threaded\.jsep\.(?:wasm|mjs))\?url$/
const PREFIX = '\0remote-ort:'

/** The R2 URL of one runtime file for the installed onnxruntime-web; upload `<base>/<version>/` before a release. */
export function remoteOrtUrl(ortDist, file) {
  const { version } = JSON.parse(readFileSync(path.join(ortDist, '..', 'package.json'), 'utf-8'))
  return `${ORT_ASSET_BASE}/${version}/${file}`
}

export function remoteOrtRuntime(ortDist, enabled) {
  return {
    name: 'remote-ort-runtime',
    enforce: 'pre',
    apply: 'build',
    resolveId(id) {
      const m = enabled && RUNTIME.exec(id)
      return m ? PREFIX + m[1] : null
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null
      return `export default ${JSON.stringify(remoteOrtUrl(ortDist, id.slice(PREFIX.length)))}`
    },
    // The runtime's own `new URL(…wasm, import.meta.url)` fallback still emits the file; wasmPaths overrides it.
    generateBundle(_, bundle) {
      if (!enabled) return
      for (const name of Object.keys(bundle)) {
        if (/ort-wasm-simd-threaded\.jsep-[^/]*\.wasm$/.test(name)) delete bundle[name]
      }
    },
  }
}
