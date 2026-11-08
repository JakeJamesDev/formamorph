// Main's backend choice: gathers the inputs engineBackend.cjs decides from.
const { backendForStart } = require('./engineBackend.cjs');
const { driverVersions } = require('./cudaInstall.cjs');

/**
 * `platform` is the OS, `install()` the CUDA install, `readCards()` the NVIDIA facts query, and
 * `vulkanDeviceNames()` the bundled build's device listing.
 */
function createBackendChoice({ platform, install, readCards, vulkanDeviceNames }) {
  /**
   * The backend the next start runs for `options` (the engine options, or pending ones from the panel), with
   * the CUDA build's server when that is CUDA. Off Windows there is no CUDA build (spec Q2).
   */
  return async function backendChoice({ engineBackend, gpuDevice }) {
    if (platform !== 'win32') return { backend: 'vulkan', reason: 'not-installed', cudaBinary: null };
    const cuda = install();
    const status = await cuda.status();
    const cards = status.nvidia ? await readCards() : [];
    return backendForStart({
      install: status,
      serverPath: () => cuda.serverPath(),
      failedLastTime: cuda.failedFor(driverVersions(cards)),
      cards,
      vulkanDeviceNames: await vulkanDeviceNames(),
      setting: engineBackend,
      gpuDevice,
    });
  };
}

module.exports = { createBackendChoice };
