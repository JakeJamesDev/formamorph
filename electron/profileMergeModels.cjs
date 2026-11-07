// The local models the profile merge moves: which folder the AppData profile keeps them in, and what each
// side holds. No electron dependency, so plain Node tests it.
const path = require('node:path');
const { listMovable } = require('./modelMove.cjs');
const { readFields } = require('./profileMergeModelFolder.cjs');
const { samePath } = require('./samePath.cjs');

/** The folder's models directory once the model-folder fill has run: its own choice, else the AppData choice, else the default. */
const plannedModelsDir = ({ chosen, sourceDir, defaultDir, fsApi }) =>
  chosen || readFields(sourceDir, fsApi).downloadDir || defaultDir;

/** The AppData profile's models folder: its own download folder choice, else `models` in the profile. */
function sourceModelsDir(sourceDir, fsApi) {
  return readFields(sourceDir, fsApi).downloadDir || path.join(sourceDir, 'models');
}

/**
 * What the merge sees: the AppData models folder's files and the folder's files. One folder on both sides
 * lists no source files, so nothing is offered.
 */
function modelSides({ sourceDir, targetModelsDir, fsApi }) {
  const dir = sourceModelsDir(sourceDir, fsApi);
  const same = samePath(dir, targetModelsDir);
  return { source: same ? [] : listMovable(dir), target: listMovable(targetModelsDir) };
}

module.exports = { sourceModelsDir, plannedModelsDir, modelSides };
