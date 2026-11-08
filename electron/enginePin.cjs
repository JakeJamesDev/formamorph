// The llama.cpp pin as the main process reads it: tag, CUDA asset names, digests and plain download URLs.
// The app never asks the GitHub API; it downloads from the release-download URL of each asset.
const fs = require('node:fs');
const path = require('node:path');

const RELEASE_BASE = 'https://github.com/ggml-org/llama.cpp/releases/download';

/** Packaged builds ship the pin in resources/llama-server; a dev run reads the fetch script's pin. */
const PIN_PATHS = [
  path.join(__dirname, '..', '..', 'llama-server', 'llamaServerPin.json'),
  path.join(__dirname, '..', 'scripts', 'llamaServerPin.json'),
];

/** @returns {{ tag: string, cuda: { assets: { name: string, digest: string, url: string }[] } }} */
function readEnginePin(paths = PIN_PATHS) {
  const file = paths.find((p) => fs.existsSync(p));
  if (!file) throw new Error('The llama.cpp pin file is missing from this build.');
  const pin = JSON.parse(fs.readFileSync(file, 'utf8'));
  const assets = (pin.cuda?.assets ?? []).map((a) => ({
    name: a.name,
    digest: a.digest,
    url: `${RELEASE_BASE}/${pin.tag}/${a.name}`,
  }));
  return { tag: pin.tag, cuda: { assets } };
}

module.exports = { readEnginePin, PIN_PATHS };
