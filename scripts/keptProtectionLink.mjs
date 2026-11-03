// Stryker's build step, run in <main checkout>/.stryker-tmp/<module>/<sandbox>: Stryker's own search skips a worktree's junction.
import { symlinkSync } from 'node:fs';
import path from 'node:path';

symlinkSync(path.resolve('../../../node_modules'), 'node_modules', 'junction');
