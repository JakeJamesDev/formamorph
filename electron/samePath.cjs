// One folder test for the profile merge's paths. No electron dependency, so plain Node tests it.
const fs = require('node:fs');
const path = require('node:path');

const realOrResolved = (p) => {
  try { return fs.realpathSync.native(p); } catch { return path.resolve(p); }
};

/** One folder by real path (links followed); case-insensitive on Windows. */
function samePath(a, b, platform = process.platform) {
  const x = realOrResolved(a);
  const y = realOrResolved(b);
  return platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

module.exports = { samePath };
