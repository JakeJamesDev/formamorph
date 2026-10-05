import { describe, it, expect } from 'vitest';
import engineDevice from './engineDevice.cjs';

const { selectEngineDevice, resolveRawIndices, ENGINE_DEVICE_AUTO, ENGINE_DEVICE_ALL } = engineDevice;

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

describe('resolveRawIndices', () => {
  /** A probe over a raw Vulkan device list: answers the name at an index, rejects past the end, and records
   *  which indexes were asked for. */
  const rawList = (names) => {
    const asked = [];
    const probe = async (raw) => {
      asked.push(raw);
      if (raw >= names.length) throw new Error('Invalid Vulkan device index');
      return names[raw];
    };
    return { probe, asked };
  };

  it('maps each enumerated name to the raw index that binds it, past the wrappers ggml dropped', async () => {
    // The reported Windows machine: the D3D12 compatibility layer wraps both adapters, ggml dedupes the
    // wrappers away and moves the native entries to the end. Positions 0 and 1 in the enumeration are raw
    // indexes 2 and 3; pinning by position lands on a wrapper.
    const { probe } = rawList(['Microsoft Direct3D12 (NVIDIA GeForce RTX 4080)', 'Microsoft Direct3D12 (Intel(R) UHD Graphics 770)', DISCRETE, IGPU]);
    const map = await resolveRawIndices([DISCRETE, IGPU], probe);
    expect(map.get(DISCRETE)).toBe(2);
    expect(map.get(IGPU)).toBe(3);
  });

  it('stops probing once every name has a raw index', async () => {
    // Each probe is a process spinning up a Vulkan backend; the end of the raw list costs one more.
    const { probe, asked } = rawList([IGPU, DISCRETE, 'llvmpipe']);
    await resolveRawIndices([IGPU, DISCRETE], probe);
    expect(asked).toEqual([0, 1]);
  });

  it('stops at the end of the raw list and leaves a name it never saw unmapped', async () => {
    const { probe, asked } = rawList([IGPU]);
    const map = await resolveRawIndices([IGPU, DISCRETE], probe);
    expect(map.get(IGPU)).toBe(0);
    expect(map.has(DISCRETE)).toBe(false);
    expect(asked).toEqual([0, 1]);
  });

  it('keeps the first raw index when two drivers expose the same name', async () => {
    const { probe } = rawList([DISCRETE, DISCRETE]);
    const map = await resolveRawIndices([DISCRETE], probe);
    expect(map.get(DISCRETE)).toBe(0);
  });

  it('gives up after sixteen raw indexes even when the probe never rejects', async () => {
    const asked = [];
    const probe = async (raw) => { asked.push(raw); return 'something else'; };
    const map = await resolveRawIndices([DISCRETE], probe);
    expect(map.size).toBe(0);
    expect(asked.length).toBe(16);
  });
});
