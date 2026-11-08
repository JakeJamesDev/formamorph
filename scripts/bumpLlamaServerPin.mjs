// Moves the llama.cpp pin: writes the tag plus the name and SHA-256 digest of the two CUDA assets.
// Run by hand: npm run llama-server:bump -- <tag>
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bumpPin } from './fetchLlamaServer.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  if (!tag) {
    console.error('Usage: npm run llama-server:bump -- <tag>');
    process.exit(2);
  }
  try {
    const assets = await bumpPin(tag);
    console.log(`Pinned llama.cpp ${tag}:\n${assets.map((a) => `  ${a.name} ${a.digest}`).join('\n')}\nRe-record scripts/fixtures/llamaServerAssets.*.json for the new tag.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
