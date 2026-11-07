// The model-folder choice (model-locations.json) in the AppData profile and the folder's profile. The merge
// fills each field the folder lacks from the AppData file. No electron dependency, so plain Node tests it.
const path = require('node:path');

const LOCATIONS_FILE = 'model-locations.json';

const FIELDS = ['downloadDir', 'externalDir', 'searchSubfolders'];

const isSet = (field, value) => (field === 'searchSubfolders' ? typeof value === 'boolean' : typeof value === 'string' && value !== '');

/** The fields a profile's file sets. A missing or unreadable file sets none. */
function readFields(dir, fsApi) {
  try {
    const saved = JSON.parse(fsApi.readFileSync(path.join(dir, LOCATIONS_FILE), 'utf8'));
    return Object.fromEntries(FIELDS.filter((field) => isSet(field, saved?.[field])).map((field) => [field, saved[field]]));
  } catch {
    return {};
  }
}

/**
 * Copy one field from the AppData profile into the folder's file when the folder lacks it. Returns the
 * folder's fields afterward, so the caller can refresh what main holds in memory.
 */
function fillField({ sourceDir, targetDir, field, fsApi }) {
  if (!FIELDS.includes(field)) throw new Error(`Unknown model-folder field: ${field}`);
  const mine = readFields(targetDir, fsApi);
  if (field in mine) return mine;
  const theirs = readFields(sourceDir, fsApi);
  if (!(field in theirs)) return mine;
  const merged = { ...mine, [field]: theirs[field] };
  fsApi.mkdirSync(targetDir, { recursive: true });
  fsApi.writeFileSync(path.join(targetDir, LOCATIONS_FILE), JSON.stringify(merged));
  return merged;
}

module.exports = { LOCATIONS_FILE, FIELDS, readFields, fillField };
