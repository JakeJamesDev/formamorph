// Every build ships the third-party notices: web, desktop and the APK all package dist/.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const NOTICES = 'THIRD-PARTY-NOTICES.md'

/** @returns {import('vite').Plugin} */
export function shipNotices(root) {
  return {
    name: 'ship-notices',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: NOTICES, source: readFileSync(join(root, NOTICES), 'utf8') })
    },
  }
}
