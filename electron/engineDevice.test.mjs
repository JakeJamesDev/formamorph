import { describe, it, expect } from 'vitest';
import engineDevice from './engineDevice.cjs';

const { selectEngineDevice, ENGINE_DEVICE_AUTO } = engineDevice;

/** nvidia-smi rows carry more than a name; only the name is ever read, but pass the real shape. */
const nvidia = (...names) => names.map((name, index) => ({ index, name, totalMB: 16376, usedMB: 1200, freeMB: 15176 }));

// The reported machine: a discrete card beside the chipset's integrated GPU. Two visible Vulkan adapters is
// what makes llama.cpp aggregate their memory into a budget belonging to neither.
const DISCRETE = 'NVIDIA GeForce RTX 4080';
const IGPU = 'Intel(R) UHD Graphics 770';

describe('selectEngineDevice · Auto', () => {
  it('pins the card nvidia-smi reports, over the integrated GPU beside it', () => {
    const pick = selectEngineDevice({ deviceNames: [IGPU, DISCRETE], nvidiaGpus: nvidia(DISCRETE) });
    expect(pick).toEqual({ index: 1, origin: 'auto' });
  });

  it('matches an nvidia-smi name through the punctuation the two sources spell differently', () => {
    const pick = selectEngineDevice({
      deviceNames: [IGPU, 'NVIDIA GeForce RTX 4080 Laptop GPU'],
      nvidiaGpus: nvidia('NVIDIA GeForce RTX 4080 Laptop GPU'),
    });
    expect(pick.index).toBe(1);
  });

  it('takes the lowest index when two devices both match nvidia-smi', () => {
    const pick = selectEngineDevice({
      deviceNames: ['NVIDIA GeForce RTX 3090', 'NVIDIA GeForce RTX 3090'],
      nvidiaGpus: nvidia('NVIDIA GeForce RTX 3090', 'NVIDIA GeForce RTX 3090'),
    });
    expect(pick).toEqual({ index: 0, origin: 'auto' });
  });

  it('excludes the integrated GPU by name when there is no nvidia-smi to ask', () => {
    // An AMD or Intel discrete card: the fix cannot be NVIDIA-only.
    const pick = selectEngineDevice({ deviceNames: [IGPU, 'AMD Radeon RX 7900 XTX'], nvidiaGpus: [] });
    expect(pick).toEqual({ index: 1, origin: 'auto' });
  });

  it('reads an AMD APU’s "Radeon(TM) Graphics" as integrated', () => {
    const pick = selectEngineDevice({
      deviceNames: ['AMD Radeon(TM) Graphics', 'AMD Radeon RX 7800 XT'],
      nvidiaGpus: [],
    });
    expect(pick).toEqual({ index: 1, origin: 'auto' });
  });

  it('reads Intel Iris Xe as integrated', () => {
    const pick = selectEngineDevice({
      deviceNames: ['Intel(R) Iris(R) Xe Graphics', 'Intel(R) Arc(TM) A770 Graphics'],
      nvidiaGpus: [],
    });
    // Arc with a card model is a discrete card, not the integrated Arc of a recent mobile chip.
    expect(pick).toEqual({ index: 1, origin: 'auto' });
  });

  it('reads model-less Intel Arc as the integrated part it is', () => {
    const pick = selectEngineDevice({
      deviceNames: ['Intel(R) Arc(TM) Graphics', 'AMD Radeon RX 7900 XTX'],
      nvidiaGpus: [],
    });
    expect(pick).toEqual({ index: 1, origin: 'auto' });
  });

  it('leaves two indistinguishable discrete cards unfiltered rather than guessing', () => {
    const pick = selectEngineDevice({
      deviceNames: ['AMD Radeon RX 7900 XTX', 'AMD Radeon RX 6800'],
      nvidiaGpus: [],
    });
    expect(pick).toEqual({ index: null, origin: null });
  });

  it('leaves an all-integrated machine unfiltered rather than pinning nothing', () => {
    const pick = selectEngineDevice({ deviceNames: [IGPU, 'AMD Radeon(TM) Graphics'], nvidiaGpus: [] });
    expect(pick).toEqual({ index: null, origin: null });
  });

  it('leaves a single-device machine exactly as it is today', () => {
    const pick = selectEngineDevice({ deviceNames: [DISCRETE], nvidiaGpus: nvidia(DISCRETE) });
    expect(pick).toEqual({ index: null, origin: null });
  });

  it('reports no pick at all on a machine with no GPU', () => {
    expect(selectEngineDevice({ deviceNames: [], nvidiaGpus: [] })).toEqual({ index: null, origin: null });
  });

  it('survives being handed nothing', () => {
    expect(selectEngineDevice()).toEqual({ index: null, origin: null });
    expect(selectEngineDevice({ deviceNames: null, nvidiaGpus: null, setting: null }))
      .toEqual({ index: null, origin: null });
  });

  it('treats the auto sentinel as the same request as no setting', () => {
    const args = { deviceNames: [IGPU, DISCRETE], nvidiaGpus: nvidia(DISCRETE) };
    expect(selectEngineDevice({ ...args, setting: ENGINE_DEVICE_AUTO })).toEqual(selectEngineDevice(args));
  });
});

describe('selectEngineDevice · a chosen device', () => {
  it('pins the named device even when Auto would have picked the other one', () => {
    const pick = selectEngineDevice({ deviceNames: [IGPU, DISCRETE], nvidiaGpus: nvidia(DISCRETE), setting: IGPU });
    expect(pick).toEqual({ index: 0, origin: 'manual' });
  });

  it('honors a choice on a single-device machine', () => {
    const pick = selectEngineDevice({ deviceNames: [DISCRETE], nvidiaGpus: [], setting: DISCRETE });
    expect(pick).toEqual({ index: 0, origin: 'manual' });
  });

  it('resolves the name against the current enumeration, so a reordered index does not move the pin', () => {
    const pick = selectEngineDevice({ deviceNames: [DISCRETE, IGPU], nvidiaGpus: [], setting: IGPU });
    expect(pick.index).toBe(1);
  });

  it('falls back rather than pinning a device the picker would call missing', () => {
    // The setting is written from this same enumeration, and the picker matches it exactly. A looser match
    // here would pin a card the row was showing as "not found".
    const pick = selectEngineDevice({
      deviceNames: [IGPU, DISCRETE],
      nvidiaGpus: nvidia(DISCRETE),
      setting: 'Intel UHD Graphics 770', // the same card, spelled without the (R)
    });
    expect(pick.origin).toBe('fallback-auto');
  });

  it('falls back to Auto, and says so, when the chosen device is gone', () => {
    // An eGPU unplugged or a driver removed: a stale index would pin whatever now sits at that position.
    const pick = selectEngineDevice({
      deviceNames: [IGPU, DISCRETE],
      nvidiaGpus: nvidia(DISCRETE),
      setting: 'AMD Radeon RX 7900 XTX',
    });
    expect(pick).toEqual({ index: 1, origin: 'fallback-auto' });
  });

  it('reports the fallback even when Auto has no pick of its own either', () => {
    const pick = selectEngineDevice({ deviceNames: [], nvidiaGpus: [], setting: DISCRETE });
    expect(pick).toEqual({ index: null, origin: 'fallback-auto' });
  });
});
