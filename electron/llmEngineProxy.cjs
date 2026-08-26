// Main-process face of the local LLM engine, which lives in a child process (llmEngineHost.cjs). Exposes the
// same API llmEngine.cjs does — async start/stop, sync getState, onStatus — so the main process's call sites
// are unchanged by the move.
//
// getState is served from a mirror kept current by every status push and every reply, which is what lets it
// stay synchronous across a process boundary. Only `stoppedState` is borrowed from the engine module, so the
// idle shape has one definition; the engine itself never runs here.
const path = require('node:path');
const { stoppedState } = require('./llmEngine.cjs');

const HOST = path.join(__dirname, 'llmEngineHost.cjs');

/**
 * Fork the host under plain Node. Used by tests and probes, and by anything driving the engine outside
 * Electron. `ready` gates the first send, since a message posted before the child is up is dropped.
 */
function nodeChannel(modulePath = HOST) {
  const { fork } = require('node:child_process');
  const child = fork(modulePath, [], { stdio: 'inherit' });
  return {
    ready: new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }),
    pid: () => child.pid ?? null,
    send: (msg) => child.send(msg),
    onMessage: (cb) => child.on('message', cb),
    onExit: (cb) => child.on('exit', (code, signal) => cb({ code, signal })),
    kill: () => { child.kill(); },
  };
}

/** Fork the host as an Electron utility process — the shipped path. `electron` is required lazily so this
 *  module loads under plain Node. */
function electronChannel(modulePath = HOST) {
  const { utilityProcess } = require('electron');
  const child = utilityProcess.fork(modulePath, [], { serviceName: 'Formamorph Engine' });
  return {
    ready: new Promise((resolve) => child.once('spawn', resolve)),
    pid: () => child.pid ?? null,
    send: (msg) => child.postMessage(msg),
    onMessage: (cb) => child.on('message', cb),
    onExit: (cb) => child.on('exit', (code) => cb({ code, signal: null })),
    kill: () => { child.kill(); },
  };
}

/** Create a proxy over its own engine child. `spawn` returns the channel to fork it with. */
function createEngineProxy({ spawn = electronChannel } = {}) {
  let channel = null;
  let mirror = stoppedState();
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();

  const getState = () => ({ ...mirror });

  function publish(state) {
    mirror = state;
    for (const cb of [...listeners]) {
      try { cb(getState()); } catch { /* a bad listener must not break the proxy */ }
    }
  }

  const errorState = (message) => ({ ...stoppedState(), status: 'error', error: message });

  /** Answer everything still waiting on the child, so an IPC handler never hangs on a dead process. */
  function settlePending(state) {
    for (const waiter of pending.values()) waiter.resolve({ ...state });
    pending.clear();
  }

  /** Drop the child on purpose. Process death is the one guaranteed way to release VRAM and native memory,
   *  which is the whole point of stopping. */
  function killChannel() {
    const dying = channel;
    if (!dying) return;
    channel = null; // before kill(), so the exit handler knows this one was asked for
    settlePending(errorState('The engine process stopped unexpectedly.'));
    try { dying.kill(); } catch { /* already gone */ }
  }

  /** The child went away unasked (crashed, or became unreachable). Report it and let the next start spawn a
   *  fresh one — no respawn loop. */
  function lose(dead, detail) {
    if (channel !== dead) return; // we killed it; the caller already has its answer
    channel = null;
    try { dead.kill(); } catch { /* already gone */ }
    const state = errorState(`The engine process stopped unexpectedly${detail}.`);
    settlePending(state);
    publish(state);
  }

  const exitDetail = (code, signal) => (signal ? ` (signal ${signal})` : code != null ? ` (exit code ${code})` : '');

  function spawnChannel() {
    const ch = spawn();
    channel = ch;
    ch.onMessage((msg) => {
      if (!msg) return;
      if (msg.type === 'status') return publish(msg.state);
      if (msg.type !== 'reply') return;
      const waiter = pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      // The engine pushed this state before replying, so subscribers have already seen it — adopt it into
      // the mirror without notifying again.
      if (msg.ok) { mirror = msg.state; waiter.resolve(getState()); }
      else waiter.reject(new Error(msg.error));
    });
    ch.onExit(({ code, signal }) => lose(ch, exitDetail(code, signal)));
    return ch;
  }

  async function call(method, ...args) {
    const ch = channel ?? spawnChannel();
    const id = nextId++;
    const reply = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    try {
      await ch.ready;
      ch.send({ type: 'call', id, method, args });
    } catch {
      lose(ch, ''); // unreachable child: settles this call with the error state rather than hanging it
    }
    return reply;
  }

  const start = (options) => call('start', options);

  async function stop() {
    // Nothing to tear down, but keep the in-process engine's status sequence: its stop always reported
    // 'stopped', whether or not anything was loaded.
    if (!channel) { publish(stoppedState()); return getState(); }
    const state = await call('stop');
    killChannel();
    return state;
  }

  function onStatus(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  return {
    start,
    stop,
    getState,
    onStatus,
    /** Pid of the engine child, for VRAM self-attribution. Null while no child is running. */
    enginePid: () => channel?.pid() ?? null,
    /** Kill the child without waiting on it — for app quit, where an awaited stop may not get to finish. */
    dispose: killChannel,
  };
}

module.exports = { ...createEngineProxy(), createEngineProxy, nodeChannel, electronChannel };
