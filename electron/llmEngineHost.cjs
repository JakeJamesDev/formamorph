// Child-process host for the local LLM engine. Everything the engine does — backend init, model load, token
// decoding, the localhost OpenAI server — runs here rather than on the Electron main process's event loop,
// which is also the app's window message pump. Only control traffic (start/stop/status, and the device
// enumeration behind the GPU picker) crosses to the parent; the renderer keeps talking to the engine over
// localhost HTTP.
//
// Runs under Electron's utilityProcess.fork and Node's child_process.fork alike, so probes and tests drive
// the real code path headlessly. llmEngineProxy.cjs is the parent half of this protocol.
const engine = require('./llmEngine.cjs');

/** The link to whichever parent forked us: Electron's utility-process port, else Node's fork IPC channel. */
function parentLink() {
  const port = process.parentPort;
  if (port) return { send: (m) => port.postMessage(m), onMessage: (cb) => port.on('message', (e) => cb(e.data)) };
  return { send: (m) => process.send(m), onMessage: (cb) => process.on('message', cb) };
}

// The parent addresses the engine by method name, so spell out which names are reachable.
const METHODS = { start: engine.start, stop: engine.stop, getState: engine.getState, listDevices: engine.listDevices };

const link = parentLink();

// Status pushes are fire-and-forget; a state-returning reply carries the full state too, so the parent's
// mirror stays current even if a push and a reply cross.
engine.onStatus((state) => link.send({ type: 'status', state }));

link.onMessage(async (msg) => {
  if (!msg || msg.type !== 'call') return;
  const { id, method, args } = msg;
  const fn = METHODS[method];
  if (!fn) return link.send({ type: 'reply', id, ok: false, error: `Unknown engine method '${method}'.` });
  try {
    link.send({ type: 'reply', id, ok: true, value: await fn(...(args || [])) });
  } catch (e) {
    link.send({ type: 'reply', id, ok: false, error: String((e && e.message) || e) });
  }
});
