// Which llama-server build an engine start runs: the bundled Vulkan build, or the downloaded CUDA build.
// Pure policy beside engineDevice.cjs; main feeds it and passes the CUDA binary to the engine when it says CUDA.
const { evaluateCudaSupport } = require('./cudaSupport.cjs');
const { namesMatch, isIntegrated, ENGINE_DEVICE_AUTO, ENGINE_DEVICE_ALL } = require('./engineDevice.cjs');

const ENGINE_BACKENDS = ['auto', 'vulkan', 'cuda'];

/** Unknown values read as Auto. */
const engineBackend = (value) => (ENGINE_BACKENDS.includes(value) ? value : 'auto');

/** The engine options with a caller's Backend and Device settings laid over them; other fields stay as they are. */
const withDeviceSettings = (options, settings) => ({
  ...options,
  ...(typeof settings?.engineBackend === 'string' ? { engineBackend: engineBackend(settings.engineBackend) } : {}),
  ...(typeof settings?.gpuDevice === 'string' ? { gpuDevice: settings.gpuDevice } : {}),
});

const vulkan = (reason) => ({ backend: 'vulkan', reason });
const CUDA = { backend: 'cuda', reason: null };

/** An NVIDIA card beside a non-NVIDIA GPU that isn't integrated (spec Q14). */
function mixedGpus(vulkanDeviceNames, cards) {
  return vulkanDeviceNames.some((name) => !cards.some((card) => namesMatch(name, card?.name)) && !isIntegrated(name));
}

const isPin = (gpuDevice) => gpuDevice !== ENGINE_DEVICE_AUTO && gpuDevice !== ENGINE_DEVICE_ALL;
const cardNamed = (gpuDevice, cards) => (Array.isArray(cards) ? cards.find((card) => namesMatch(gpuDevice, card?.name)) : undefined);

/** A pin on a listed Vulkan device that is no NVIDIA card, so only the Vulkan build can run it. */
const vulkanOnlyPin = (gpuDevice, vulkanDeviceNames, cards) =>
  isPin(gpuDevice) && vulkanDeviceNames.includes(gpuDevice) && !cardNamed(gpuDevice, cards);

/**
 * The backend for one start. `installState` and `replacing` come from the CUDA install status, `cards` from
 * the NVIDIA facts query (null when it failed), `vulkanDeviceNames` from the bundled build's listing, and
 * `gpuDevice` is the device setting.
 *
 * Returns `{ backend: 'cuda' | 'vulkan', reason }`; `reason` says why CUDA isn't used: `setting`,
 * `not-installed`, `updating`, `device-pin`, `failed-last-time`, `mixed-gpus`, or a support verdict reason. An explicit
 * CUDA setting skips the device-pin check, the failure record, the support rule and the mixed-GPU check; those
 * steer only Auto.
 * `failedLastTime` is true while the CUDA failure record matches this tag and driver.
 */
function chooseEngineBackend({ setting, installState, replacing = false, failedLastTime = false, cards, vulkanDeviceNames = [], gpuDevice = ENGINE_DEVICE_AUTO } = {}) {
  const wanted = engineBackend(setting);
  if (wanted === 'vulkan') return vulkan('setting');
  if (installState !== 'installed') {
    return vulkan(installState === 'stale' || (installState === 'downloading' && replacing) ? 'updating' : 'not-installed');
  }
  if (wanted === 'cuda') return CUDA;
  if (vulkanOnlyPin(gpuDevice, vulkanDeviceNames, cards)) return vulkan('device-pin');
  if (failedLastTime) return vulkan('failed-last-time');

  // A device pin on an NVIDIA card asks for that card alone, so only that card has to pass.
  const pinned = isPin(gpuDevice) ? cardNamed(gpuDevice, cards) : null;
  if (pinned) {
    const verdict = evaluateCudaSupport([pinned]);
    return verdict.supported ? CUDA : vulkan(verdict.reason);
  }
  const verdict = evaluateCudaSupport(cards);
  if (!verdict.supported) return vulkan(verdict.reason);
  if (mixedGpus(vulkanDeviceNames, cards)) return vulkan('mixed-gpus');
  return CUDA;
}

/**
 * The backend choice for one start plus the CUDA server to run, from the CUDA install (`install` is its
 * status, `serverPath` its installed binary, `failedLastTime` its failure record's match). CUDA without a
 * binary on disk reads as not installed.
 */
function backendForStart({ install, serverPath, failedLastTime = false, cards, vulkanDeviceNames, setting, gpuDevice }) {
  const choice = chooseEngineBackend({
    setting, installState: install?.state, replacing: install?.replacing === true, failedLastTime, cards, vulkanDeviceNames, gpuDevice,
  });
  const cudaBinary = choice.backend === 'cuda' ? serverPath() : null;
  if (choice.backend === 'cuda' && !cudaBinary) return { backend: 'vulkan', reason: 'not-installed', cudaBinary: null };
  return { ...choice, cudaBinary };
}

module.exports = { chooseEngineBackend, backendForStart, engineBackend, withDeviceSettings, ENGINE_BACKENDS };
