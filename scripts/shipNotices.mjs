// Every build ships the third-party notices: web, desktop and the APK all package dist/, and the site its own output.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACKAGES_SECTION, hasLicenseText, parseNotices } from '../src/lib/noticesFormat.ts'
import { shippedOutsideGraph } from './noticesList.mjs'

const NOTICES = 'THIRD-PARTY-NOTICES.md'
export const REGENERATE = 'npm run gen-notices'

/** The package a module id resolves into, or null for our own sources. */
export function packageRootOf(id) {
  const path = id.replace(/^\0/, '').split('?')[0].replace(/\\/g, '/')
  const at = path.lastIndexOf('/node_modules/')
  if (at < 0) return null
  const start = at + '/node_modules/'.length
  const parts = path.slice(start).split('/')
  const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
  return path.slice(0, start) + name
}

/** The package folders the module ids reach. */
export const packageRoots = (moduleIds) => [...new Set([...moduleIds].map(packageRootOf).filter(Boolean))]

/** `name@version` for each package folder, once each. */
export function packageIds(roots) {
  return [...new Set(roots.map((root) => {
    const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    return `${name}@${version}`
  }))]
}

/** Each way the notices text falls short of the shipped packages. */
export function noticesDrift(packages, notices) {
  const entries = parseNotices(notices)
  const listed = new Set(entries.filter((entry) => entry.section === PACKAGES_SECTION).map((entry) => entry.name))
  const problems = packages.filter((pkg) => !listed.has(pkg)).sort().map((pkg) => `${pkg} has no entry`)
  for (const { name, section, text } of entries) {
    if (section === PACKAGES_SECTION ? !hasLicenseText(text) : !text) problems.push(`${name} has no license text`)
    if (/\bUNKNOWN\b/.test(text.split('\n')[0])) problems.push(`${name} reads UNKNOWN`)
  }
  return problems
}

/**
 * Emits the notices file and fails the build on drift. `api.workerPlugin()` goes in `worker.plugins`.
 * @returns {import('vite').Plugin & { api: { workerPlugin: () => import('vite').Plugin } }}
 */
export function shipNotices(root) {
  const moduleIds = new Set()
  const collect = (context) => {
    for (const id of context.getModuleIds()) moduleIds.add(id)
  }
  return {
    name: 'ship-notices',
    // Dev serves the file the build emits, so the Licenses tab reads it on both.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || new URL(req.url, 'http://localhost').pathname !== `/${NOTICES}`) return next()
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        res.end(readFileSync(join(root, NOTICES)))
      })
    },
    api: {
      workerPlugin: () => ({
        name: 'ship-notices-worker',
        generateBundle() {
          collect(this)
        },
      }),
    },
    generateBundle() {
      collect(this)
      const notices = readFileSync(join(root, NOTICES), 'utf8')
      // Set by scripts/genNotices.mjs, which needs the list before the file can pass.
      const report = process.env.FORMAMORPH_NOTICES_PACKAGES
      if (report) {
        writeFileSync(report, JSON.stringify(packageRoots(moduleIds)))
      } else {
        const problems = noticesDrift(packageIds([...packageRoots(moduleIds), ...shippedOutsideGraph(root)]), notices)
        if (problems.length > 0) this.error(`${NOTICES} is out of date. Run ${REGENERATE}.\n${problems.join('\n')}`)
      }
      this.emitFile({ type: 'asset', fileName: NOTICES, source: notices })
    },
  }
}
