#!/usr/bin/env node
// Regenerates the package list and summary in THIRD-PARTY-NOTICES.md from what the production builds bundle.
// Usage: npm run gen-notices
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gapsIn, readPackage, renderPackages, shippedOutsideGraph, spliceGenerated } from './noticesList.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NOTICES = join(ROOT, 'THIRD-PARTY-NOTICES.md')

/** The package folders one production build's module graph reaches. */
function bundledBy(config, workDir) {
  const report = join(workDir, `${config}.json`)
  const result = spawnSync(`npx vite build --config ${config} --outDir "${join(workDir, config)}" --emptyOutDir --logLevel warn`, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORMAMORPH_NOTICES_PACKAGES: report },
  })
  if (result.status !== 0) throw new Error(`The build for ${config} exited ${result.status}.`)
  return JSON.parse(readFileSync(report, 'utf8'))
}

const { overrides } = JSON.parse(readFileSync(join(ROOT, 'legal/notices-map.json'), 'utf8'))
const workDir = mkdtempSync(join(tmpdir(), 'formamorph-notices-'))
try {
  const dirs = new Set([...bundledBy('vite.config.js', workDir), ...bundledBy('vite.site.config.js', workDir), ...shippedOutsideGraph(ROOT)].map((dir) => resolve(dir)))
  const packages = [...dirs].map((dir) => readPackage(dir, overrides, join(ROOT, 'legal')))
  const unique = [...new Map(packages.map((pkg) => [pkg.id, pkg])).values()]
  const gaps = gapsIn(unique)
  if (gaps.length > 0) throw new Error(`Add these to legal/notices-map.json:\n${gaps.join('\n')}`)
  writeFileSync(NOTICES, spliceGenerated(readFileSync(NOTICES, 'utf8'), renderPackages(unique)))
  console.log(`THIRD-PARTY-NOTICES.md lists ${unique.length} packages.`)
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
