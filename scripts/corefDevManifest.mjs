// Dev server: serves a local Character Mentions manifest and weights at /coref-dev/, until the public bucket exists.
// The folder is `COREF_DEV_DIR`, else `publish` in the coref work folder (testing/coref/README.md).
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/** The main checkout's root: a worktree's `.git` file points into the main checkout's `.git/worktrees/`. */
export function mainCheckoutRoot(root) {
  const dotGit = path.join(root, '.git')
  if (!existsSync(dotGit) || statSync(dotGit).isDirectory()) return root
  const gitdir = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]?.trim()
  return gitdir ? path.resolve(root, gitdir, '..', '..', '..') : root
}

export function corefDevManifest(root) {
  const data = process.env.FORMAMORPH_TRAINING_DATA || path.join(mainCheckoutRoot(root), '..', 'formamorph-training-data')
  const dir = process.env.COREF_DEV_DIR || path.join(process.env.COREF_WORK || path.join(data, 'coref', 'work'), 'publish')
  return {
    name: 'coref-dev-manifest',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/coref-dev', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0])
        const file = path.resolve(dir, `.${rel}`)
        if (!file.startsWith(path.resolve(dir) + path.sep) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Length', String(statSync(file).size))
        res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-store')
        createReadStream(file).pipe(res)
      })
    },
  }
}
