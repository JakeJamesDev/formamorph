import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type * as ThreeNS from 'three';
import ModelViewer from './ModelViewer';

/**
 * The viewer needs a real WebGL context, which jsdom has none of, so `WebGLRenderer` and `OrbitControls` are
 * replaced with inert stand-ins and the loaders hand back a scene built here. Everything under test — the
 * light rig, the animation wiring, and the teardown — is the component's own code running for real.
 *
 * The stand-ins live in `vi.hoisted` because `vi.mock` factories are lifted above ordinary declarations.
 * They count their own calls rather than using `vi.fn()`: hoisted code runs before the `vitest` import
 * binding initializes, so touching `vi` in there throws.
 */
const mocks = vi.hoisted(() => {
  class MockRenderer {
    domElement = document.createElement('canvas');
    calls = { render: 0, dispose: 0, forceContextLoss: 0 };
    setSize() {}
    setClearColor() {}
    render() { this.calls.render++; }
    dispose() { this.calls.dispose++; }
    forceContextLoss() { this.calls.forceContextLoss++; }
    constructor() { state.renderer = this; }
  }

  class MockControls {
    enableDamping = false;
    dampingFactor = 0;
    enableZoom = false;
    // The component only ever copies a center into this; nothing reads it back.
    target = { copy() {} };
    calls = { update: 0, dispose: 0 };
    update() { this.calls.update++; }
    dispose() { this.calls.dispose++; }
    constructor() { state.controls = this; }
  }

  const state: {
    renderer: MockRenderer | null;
    controls: MockControls | null;
    /** What the mocked GLTFLoader hands to the component's onLoad. Set per test. */
    loadResult: { scene: unknown; animations: unknown[] } | null;
  } = { renderer: null, controls: null, loadResult: null };

  return { state, MockRenderer, MockControls };
});

vi.mock('three', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('three');
  return { ...actual, WebGLRenderer: mocks.MockRenderer };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({ OrbitControls: mocks.MockControls }));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(_url: string, onLoad: (result: unknown) => void) { onLoad(mocks.state.loadResult); }
  },
}));
vi.mock('three/examples/jsm/loaders/FBXLoader.js', () => ({ FBXLoader: class { load() {} } }));
vi.mock('three/examples/jsm/loaders/OBJLoader.js', () => ({ OBJLoader: class { load() {} } }));

/** The same (mocked) `three` namespace the component resolves. Imported dynamically so the static import
 *  graph doesn't race the `vi.mock('three')` factory. */
let THREE: typeof ThreeNS;
beforeAll(async () => { THREE = await import('three'); });

/** A one-track clip that moves `nodeName` — enough for the mixer to bind against. */
const clip = (name: string, nodeName: string) =>
  new THREE.AnimationClip(name, 1, [
    new THREE.VectorKeyframeTrack(`${nodeName}.position`, [0, 1], [0, 0, 0, 0, 1, 0]),
  ]);

/** A mesh named `Spinner`, optionally carrying animation clips, as the loaders would return it. */
const gltf = (animations: ThreeNS.AnimationClip[] = []) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = 'Spinner';
  return { scene: mesh, animations };
};

/** The loaded mesh, typed back from the loosely-typed hoisted state. */
const loadedMesh = () => mocks.state.loadResult!.scene as ThreeNS.Mesh;

const MODEL = { name: 'spinner.glb', data: 'data:model/gltf-binary;base64,AAAA' };

/** Renders the viewer and lets its `fetch(...).then(...)` chain settle before returning. */
const mount = async (modelType = 'glb') => {
  const view = render(<ModelViewer model={MODEL} modelType={modelType} />);
  // The component decodes the data URL through fetch/blob promises before it ever calls the loader.
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return view;
};

/** The scene the component built, reached by walking up from the object it added. */
const scene = () => {
  let node: ThreeNS.Object3D | null = loadedMesh();
  while (node && !(node as ThreeNS.Scene).isScene) node = node.parent;
  return node as ThreeNS.Scene;
};

/** The rAF callback the component registered, so frames can be driven deterministically. */
let frame: FrameRequestCallback | undefined;

beforeEach(() => {
  frame = undefined;
  mocks.state.loadResult = gltf();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) }));
  URL.createObjectURL = vi.fn(() => 'blob:model');
  URL.revokeObjectURL = vi.fn();
  // Capture rather than schedule: the loop reschedules itself, so running it live would never stop.
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame ??= cb; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('ModelViewer lighting', () => {
  it('lights the scene at physically-correct intensities', async () => {
    await mount();

    const ambient = scene().children
      .find((c) => (c as ThreeNS.AmbientLight).isAmbientLight) as ThreeNS.AmbientLight;
    // The legacy 0.5 renders a lit model near-black under three r155+'s physically-correct lighting.
    expect(ambient.intensity).toBeCloseTo(Math.PI * 0.3);
  });

  it('adds a key light and a weaker fill from the opposite side', async () => {
    await mount();
    const directional = scene().children
      .filter((c) => (c as ThreeNS.DirectionalLight).isDirectionalLight) as ThreeNS.DirectionalLight[];

    expect(directional).toHaveLength(2);
    const [key, fill] = directional;
    expect(key.intensity).toBeCloseTo(Math.PI);
    expect(fill.intensity).toBeCloseTo(Math.PI / 3);
    // A fill matching the key would cancel the shading that shows the model's shape.
    expect(fill.intensity).toBeLessThan(key.intensity);
    // Opposite hemispheres: without this the far side falls to flat ambient when the camera orbits behind.
    expect(key.position.dot(fill.position)).toBeLessThan(0);
  });
});

describe('ModelViewer animation', () => {
  it('plays every clip the file carries', async () => {
    mocks.state.loadResult = gltf([clip('spin', 'Spinner'), clip('bob', 'Spinner')]);
    const clipAction = vi.spyOn(THREE.AnimationMixer.prototype, 'clipAction');

    await mount();

    // One clip per animated object in a glTF export, so playing only the first leaves the rest frozen.
    expect(clipAction.mock.calls.map(([c]) => (c as ThreeNS.AnimationClip).name)).toEqual(['spin', 'bob']);
    // Bound is not playing: a clipAction that is never played leaves the model on its first frame.
    expect(clipAction.mock.results.every((r) => (r.value as ThreeNS.AnimationAction).isRunning())).toBe(true);
  });

  it('advances the mixer on each frame', async () => {
    mocks.state.loadResult = gltf([clip('spin', 'Spinner')]);
    const update = vi.spyOn(THREE.AnimationMixer.prototype, 'update');

    await mount();
    update.mockClear();
    await act(async () => { frame?.(0); });

    // Without this the clip is bound but never ticks, and the model sits frozen on its first frame.
    expect(update).toHaveBeenCalledTimes(1);
    expect(typeof update.mock.calls[0][0]).toBe('number');
  });

  it('drives no mixer for a model with no clips', async () => {
    mocks.state.loadResult = gltf([]);
    const update = vi.spyOn(THREE.AnimationMixer.prototype, 'update');

    await mount();
    await act(async () => { frame?.(0); });

    expect(update).not.toHaveBeenCalled();
  });
});

describe('ModelViewer teardown', () => {
  it('releases the model geometry, materials and WebGL context on unmount', async () => {
    const mesh = loadedMesh();
    const geometry = vi.spyOn(mesh.geometry, 'dispose');
    const material = vi.spyOn(mesh.material as ThreeNS.Material, 'dispose');

    const { unmount } = await mount();
    const renderer = mocks.state.renderer!;
    const controls = mocks.state.controls!;
    unmount();

    expect(geometry).toHaveBeenCalled();
    expect(material).toHaveBeenCalled();
    expect(renderer.calls.dispose).toBe(1);
    // Without this, repeated opens accumulate contexts until the browser evicts the oldest and drawing breaks.
    expect(renderer.calls.forceContextLoss).toBe(1);
    expect(controls.calls.dispose).toBe(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:model');
  });

  it('stops the mixer and the render loop on unmount', async () => {
    mocks.state.loadResult = gltf([clip('spin', 'Spinner')]);
    const stop = vi.spyOn(THREE.AnimationMixer.prototype, 'stopAllAction');

    const { unmount } = await mount();
    unmount();

    expect(stop).toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
