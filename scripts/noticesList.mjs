// Turns a set of package folders into the generated half of THIRD-PARTY-NOTICES.md (scripts/genNotices.mjs).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PACKAGES_SECTION, SUMMARY_SECTION } from '../src/lib/noticesFormat.ts'

const SUMMARY_HEADING = `## ${SUMMARY_SECTION}`
const LICENSE_FILE = /^(licen[cs]e|copying|copyright|notice|unlicense|ofl)/i
const SOURCE_FILE = /\.(c|m)?[jt]s$/i

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** The folder Node would load `name` from when `fromDir` asks for it, or null when it isn't installed. */
export function resolvePackage(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (dirname(dir) === dir) return null
  }
}

/** Each root folder and every installed package its `dependencies` reach. */
export function walkDependencies(rootDirs) {
  const seen = new Set()
  const stack = [...rootDirs]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (seen.has(dir)) continue
    seen.add(dir)
    for (const dep of Object.keys(readJson(join(dir, 'package.json')).dependencies ?? {})) {
      const found = resolvePackage(dep, dir)
      if (found) stack.push(found)
    }
  }
  return seen
}

/** What ships without an import in a build: the desktop app's production tree, the APK's native code, inlined packages. */
export function shippedOutsideGraph(root) {
  const map = readJson(join(root, 'legal/notices-map.json'))
  const installed = (name) => {
    const dir = resolvePackage(name, root)
    if (!dir) throw new Error(`legal/notices-map.json names ${name}, which isn't installed.`)
    return dir
  }
  const production = Object.keys(readJson(join(root, 'package.json')).dependencies ?? {})
  return [...walkDependencies([...production, ...map.withDependencies].map(installed)), ...map.packageOnly.map(installed)]
}

function repoOf(pkg) {
  const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  return /github\.com[/:]([^/]+\/[^/#]+?)(\.git)?([/#].*)?$/.exec(url ?? '')?.[1] ?? (/^[\w.-]+\/[\w.-]+$/.test(url ?? '') ? url : null)
}

/** The fence around one license text, longer than any fence inside it. */
export function fenced(text) {
  const runs = text.match(/^\s*`{3,}/gm)?.map((run) => run.trim().length) ?? []
  const fence = '`'.repeat(Math.max(2, ...runs) + 1)
  return `${fence}\n${text}\n${fence}`
}

const cleanText = (text) => text.replace(/^﻿/, '').replace(/\r\n/g, '\n').trimEnd()

/** A package's entry data. Its license text comes from the map first, then from the files it ships. */
export function readPackage(dir, overrides, textRoot) {
  const pkg = readJson(join(dir, 'package.json'))
  const override = overrides[pkg.name]
  const shipped = readdirSync(dir)
    .filter((file) => LICENSE_FILE.test(file) && !SOURCE_FILE.test(file) && statSync(join(dir, file)).isFile())
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8'))
  const texts = override?.textFile ? [readFileSync(join(textRoot, override.textFile), 'utf8')] : shipped
  const declared = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? pkg.licenses?.[0]?.type
  return {
    id: `${pkg.name}@${pkg.version}`,
    license: override?.license ?? declared ?? null,
    repo: repoOf(pkg),
    texts: texts.map(cleanText).filter(Boolean),
  }
}

/** What the map must supply before the file can be written. */
export function gapsIn(packages) {
  return packages.flatMap((pkg) => [
    ...(pkg.license && pkg.license !== 'UNKNOWN' && !/^SEE LICENSE/i.test(pkg.license) ? [] : [`${pkg.id} has no declared license`]),
    ...(pkg.texts.length > 0 ? [] : [`${pkg.id} has no license text`]),
  ])
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** The generated half: the summary table, then one entry per package. */
export function renderPackages(packages) {
  const sorted = [...packages].sort((a, b) => compare(a.id, b.id))
  const counts = new Map()
  for (const { license } of sorted) counts.set(license, (counts.get(license) ?? 0) + 1)
  const rows = [...counts].sort((a, b) => b[1] - a[1] || compare(a[0], b[0])).map(([license, count]) => `| ${count} | ${license} |`)
  const entries = sorted.map(({ id, license, repo, texts }) =>
    [`### ${id}`, `- License: **${license}**${repo ? ` · ${repo}` : ''}`, ...texts.map(fenced)].join('\n\n'))
  return [
    SUMMARY_HEADING,
    ['| Count | License |', '|---:|---|', ...rows].join('\n'),
    `Total components: **${sorted.length}**.`,
    `## ${PACKAGES_SECTION}`,
    ...entries,
  ].join('\n\n') + '\n'
}

/** The notices text with its generated half replaced. Everything above the summary stays as it is. */
export function spliceGenerated(notices, generated) {
  const at = notices.search(new RegExp(`^${SUMMARY_HEADING}\\s*$`, 'm'))
  if (at < 0) throw new Error(`The notices file has no "${SUMMARY_HEADING}" heading.`)
  const eol = notices.includes('\r\n') ? '\r\n' : '\n'
  return notices.slice(0, at) + generated.replace(/\n/g, eol)
}
