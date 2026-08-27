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

// Methods whose answer IS the engine state, so the mirror adopts it. Anything else answers with a value of
// its own (a device enumeration), which must never land in the state the renderer reads.
//
// Known here rather than tagged onto the child's reply because a call that dies with its child never gets a
// reply at all, and settlePending still has to answer it in the shape its caller asked for.
const STATE_METHODS = new Set(['start', 'stop', 'getState']);

/**
 * Fork the host under plain Node. Used by tests and probes, and by anything driving the engine outside
 * Electron. `ready` gates the first send, since a message posted before the child is up is dropped.
 */
function nodeChannel(modulePath = HOST) {
  const { fork } = require('node:child_process');
  const child = fork(modulePath, [], { stdio: 'inherit' });
  return {
    ready: new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
      child.once('exit', () => reject(new Error('The engine process exited before it started.')));
    }),
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
    // A utility process that can't launch its module exits without ever spawning, so `exit` has to settle
    // this too — otherwise the first call waits on a promise nothing will ever resolve.
    ready: new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('exit', () => reject(new Error('The engine process exited before it started.')));
    }),
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

  /** Answer everything still waiting on the child, so an IPC handler never hangs on a dead process. A
   *  caller that asked for something other than the state gets null rather than a state to misread. */
  function settlePending(state) {
    for (const waiter of pending.values()) waiter.resolve(waiter.wantsState ? { ...state } : null);
    pending.clear();
  }

  /** Drop the child on purpose. Process death is the one guaranteed way to release VRAM and native memory,
   *  which is the whole point of stopping. */
  function killChannel() {
    const dying = channel;
    if (!dying) return;
    channel = null; // before kill(), so the exit handler knows this one was asked for
    // Anything still in flight is answered 'stopped', not a crash — this teardown was asked for.
    settlePending(stoppedState());
    try { dying.kill(); } catch { /* already gone */ }
    // A kill part-way through a load would otherwise leave the mirror reading 'loading' with nothing behind it.
    if (mirror.status !== 'stopped') publish(stoppedState());
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
      if (!msg.ok) waiter.reject(new Error(msg.error));
      else if (waiter.wantsState) { mirror = msg.value; waiter.resolve(getState()); }
      else waiter.resolve(msg.value);
    });
    ch.onExit(({ code, signal }) => lose(ch, exitDetail(code, signal)));
    return ch;
  }

  function call(method, ...args) {
    const ch = channel ?? spawnChannel();
    const id = nextId++;
    const wantsState = STATE_METHODS.has(method);
    const reply = new Promise((resolve, reject) => pending.set(id, { resolve, reject, wantsState }));
    // Send once the child is up, but never let the answer wait on `ready` itself: a child that dies before it
    // spawns never settles it, and it's the exit handler that answers the call in that case.
    ch.ready
      .then(() => ch.send({ type: 'call', id, method, args }))
      .catch(() => lose(ch, '')); // unreachable child: answer this call rather than hang it
    return reply;
  }

  const start = (options) => call('start', options);

  /** Every GPU the backend can see, unfiltered. Spawns a child if none is running — so call it on a proxy
   *  of its own, whose child dies with the answer, rather than on the one serving a loaded model. */
  const listDevices = () => call('listDevices');

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
    listDevices,
    /** Pid of the engine child, for VRAM self-attribution. Null while no child is running. */
    enginePid: () => channel?.pid() ?? null,
    /** Kill the child without waiting on it — for app quit, where an awaited stop may not get to finish. */
    dispose: killChannel,
  };
}

module.exports = { ...createEngineProxy(), createEngineProxy, nodeChannel, electronChannel };
