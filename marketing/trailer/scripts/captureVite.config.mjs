// The app's Vite config, also serving node_modules' real path, so QuickJS's wasm loads when it is a link (a worktree).
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import app from '../../../vite.config.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export default mergeConfig(app, { server: { fs: { allow: [repoRoot, realpathSync(path.join(repoRoot, 'node_modules'))] } } });
