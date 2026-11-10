import { describe, it, expect } from 'vitest';
import engineDevice from './engineDevice.cjs';

const { selectEngineDevice, engineVramClass, ENGINE_DEVICE_AUTO, ENGINE_DEVICE_ALL, LOW_VRAM_LIMIT_MB } = engineDevice;

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

  it('leaves a dual-NVIDIA rig unfiltered, so multi-GPU splitting keeps working', () => {
    // Two real cards is a configuration llama.cpp handles by design (Max layers auto-splits across them);
    // pinning one would silently halve that machine's VRAM.
    const pick = selectEngineDevice({
      deviceNames: ['NVIDIA GeForce RTX 3090', 'NVIDIA GeForce RTX 3090'],
      nvidiaGpus: nvidia('NVIDIA GeForce RTX 3090', 'NVIDIA GeForce RTX 3090'),
    });
    expect(pick).toEqual({ index: null, origin: null });
  });

  it('leaves an NVIDIA card beside a discrete AMD card unfiltered rather than favoring the NVIDIA', () => {
    const pick = selectEngineDevice({
      deviceNames: ['NVIDIA GeForce RTX 4080', 'AMD Radeon RX 7900 XTX'],
      nvidiaGpus: nvidia('NVIDIA GeForce RTX 4080'),
    });
    expect(pick).toEqual({ index: null, origin: null });
  });

  it('still pins the NVIDIA card when everything beside it is integrated', () => {
    const pick = selectEngineDevice({
      deviceNames: [IGPU, 'AMD Radeon(TM) Graphics', DISCRETE],
      nvidiaGpus: nvidia(DISCRETE),
    });
    expect(pick).toEqual({ index: 2, origin: 'auto' });
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

describe('selectEngineDevice · All GPUs', () => {
  it('leaves the backend unfiltered on request, even where Auto would pin', () => {
    // The escape hatch for a machine Auto pins: multi-GPU splitting across everything visible.
    const pick = selectEngineDevice({ deviceNames: [IGPU, DISCRETE], nvidiaGpus: nvidia(DISCRETE), setting: ENGINE_DEVICE_ALL });
    expect(pick).toEqual({ index: null, origin: null });
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

describe('engineVramClass', () => {
  /** A listing row as llama-server reports it. */
  const dev = (name, totalMB) => ({ name, totalMB });
  /** An nvidia-smi row with its own total. */
  const smi = (name, totalMB) => ({ name, totalMB, usedMB: 0, freeMB: totalMB });
  const classOf = (facts) => engineVramClass({ listed: true, nvidiaGpus: [], ...facts });

  it('reads one discrete card at the limit as low and one above it as ok', () => {
    expect(LOW_VRAM_LIMIT_MB).toBe(8500);
    expect(classOf({ devices: [dev('AMD Radeon RX 7600', 8500)] })).toBe('low');
    expect(classOf({ devices: [dev('AMD Radeon RX 7600', 8501)] })).toBe('ok');
    expect(classOf({ devices: [dev('AMD Radeon RX 6600', 8176)] })).toBe('low');
    expect(classOf({ devices: [dev('AMD Radeon RX 7900 XTX', 24560)] })).toBe('ok');
  });

  it('reads an integrated GPU alone as low, however large its reported total', () => {
    // A Strix Halo APU reported 87,722 MiB; an integrated total is never trusted.
    expect(classOf({ devices: [dev('AMD Radeon(TM) 8060S Graphics', 87722)] })).toBe('low');
    expect(classOf({ devices: [dev(IGPU, 16000)] })).toBe('low');
  });

  it('reads a listing that succeeded with no GPU as low', () => {
    expect(classOf({ devices: [] })).toBe('low');
  });

  it('reads a failed listing as unknown, apart from an empty one', () => {
    expect(engineVramClass({ devices: [], listed: false, nvidiaGpus: [] })).toBe('unknown');
    expect(engineVramClass({ devices: [dev(DISCRETE, 16000)], listed: false, nvidiaGpus: [] })).toBe('unknown');
    expect(engineVramClass()).toBe('unknown');
  });

  it('judges the large discrete card beside an integrated GPU, not the integrated one', () => {
    expect(classOf({ devices: [dev(IGPU, 2048), dev('AMD Radeon RX 7900 XTX', 24560)] })).toBe('ok');
    expect(classOf({ devices: [dev(IGPU, 2048), dev('AMD Radeon RX 6600', 8176)] })).toBe('low');
  });

  it('ignores the integrated GPU on All GPUs too', () => {
    const devices = [dev(IGPU, 30000), dev('AMD Radeon RX 6600', 8176)];
    expect(classOf({ devices, setting: ENGINE_DEVICE_ALL })).toBe('low');
  });

  it('adds the totals of two discrete cards with no pin before the limit applies', () => {
    expect(classOf({ devices: [dev('AMD Radeon RX 6600', 4500), dev('AMD Radeon RX 6500 XT', 4100)] })).toBe('ok');
    expect(classOf({ devices: [dev('AMD Radeon RX 6600', 4400), dev('AMD Radeon RX 6500 XT', 4100)] })).toBe('low');
  });

  it('judges only the pinned card when the setting names one', () => {
    const devices = [dev('AMD Radeon RX 6600', 8176), dev('AMD Radeon RX 7900 XTX', 24560)];
    expect(classOf({ devices, setting: 'AMD Radeon RX 6600' })).toBe('low');
    expect(classOf({ devices, setting: 'AMD Radeon RX 7900 XTX' })).toBe('ok');
  });

  it('reads a manual pin on the integrated GPU beside a large card as low', () => {
    const devices = [dev(IGPU, 2048), dev('AMD Radeon RX 7900 XTX', 24560)];
    expect(classOf({ devices, setting: IGPU })).toBe('low');
  });

  it('takes the nvidia-smi total for a matching card, so the NVIDIA boundary stays at 8,500 and 8,501 MB', () => {
    // Vulkan reports less than nvidia-smi for the same card; the matching row's total wins.
    const name = 'NVIDIA GeForce RTX 4060';
    expect(classOf({ devices: [dev(name, 8400)], nvidiaGpus: [smi(name, 8500)] })).toBe('low');
    expect(classOf({ devices: [dev(name, 8400)], nvidiaGpus: [smi(name, 8501)] })).toBe('ok');
  });

  it('gives each of two same-named NVIDIA cards its own nvidia-smi row', () => {
    const name = 'NVIDIA GeForce RTX 3060';
    const devices = [dev(name, 100), dev(name, 100)];
    expect(classOf({ devices, nvidiaGpus: [smi(name, 4000), smi(name, 4501)] })).toBe('ok');
    expect(classOf({ devices, nvidiaGpus: [smi(name, 4000), smi(name, 4500)] })).toBe('low');
  });

  it('gives a card the nvidia-smi row of its exact name before a longer one that contains it', () => {
    const devices = [dev('NVIDIA GeForce RTX 4060', 100)];
    const gpus = [smi('NVIDIA GeForce RTX 4060 Ti', 16380), smi('NVIDIA GeForce RTX 4060', 8188)];
    expect(classOf({ devices, nvidiaGpus: gpus, setting: 'NVIDIA GeForce RTX 4060' })).toBe('low');
  });

  it('reads a discrete card with no known total as unknown', () => {
    expect(classOf({ devices: [dev('AMD Radeon RX 7600', null)] })).toBe('unknown');
  });
});
