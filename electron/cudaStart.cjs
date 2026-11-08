// Engine starts that keep the CUDA failure record (spec Q19): main's starts and the CUDA row's Retry.
const { driverVersions } = require('./cudaInstall.cjs');

/**
 * `engine` is the engine (or its proxy), `install` the CUDA install, `startOptions(modelPath)` main's load
 * options with the backend choice, `nextBackend()` the backend the next start runs, and `readCards()` the
 * NVIDIA facts query.
 */
function createCudaStarts({ engine, install, startOptions, nextBackend, readCards }) {
  /** Start `modelPath`; a start that fell back from CUDA leaves the failure record. */
  async function start(modelPath) {
    const state = await engine.start(await startOptions(modelPath));
    if (state.cudaFallback) await install.noteStart(state, driverVersions(await readCards()));
    return state;
  }

  /** The row's Retry: forget the failure, and restart a model running on Vulkan when the next start is CUDA. */
  async function retry() {
    const status = await install.retry();
    const { status: running, gpuBackend, modelPath } = engine.getState();
    if (running === 'ready' && gpuBackend === 'vulkan' && modelPath && (await nextBackend()) === 'cuda') {
      await engine.stop();
      await start(modelPath);
    }
    return status;
  }

  return { start, retry };
}

module.exports = { createCudaStarts };
