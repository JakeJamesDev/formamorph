import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

/** jsdom has no WebGL, so the renderer and controls are inert. The loader records what the viewer asks for. */
const mocks = vi.hoisted(() => {
  const loaded: string[] = [];
  class MockRenderer {
    domElement = document.createElement('canvas');
    setSize() {}
    setClearColor() {}
    setPixelRatio() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }
  class MockControls {
    target = { set() {} };
    update() {}
    dispose() {}
  }
  class MockGltfLoader {
    register() {}
    load(url: string) { loaded.push(url); }
  }
  return { loaded, MockRenderer, MockControls, MockGltfLoader };
});

vi.mock('three', async () => ({ ...await vi.importActual<Record<string, unknown>>('three'), WebGLRenderer: mocks.MockRenderer }));
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({ OrbitControls: mocks.MockControls }));
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({ GLTFLoader: mocks.MockGltfLoader }));
vi.mock('three/examples/jsm/loaders/FBXLoader.js', () => ({ FBXLoader: class { load() {} } }));

/** Mounts the viewer with no model URL, on a build of `avatarSet`. Vitest serves the build's define as a global. */
const mountOn = async (avatarSet: string) => {
  vi.stubGlobal('__AVATAR_SET__', avatarSet);
  vi.resetModules();
  const { default: VRMViewer } = await import('./VRMViewer');
  return render(<VRMViewer />);
};

afterEach(() => {
  mocks.loaded.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the viewer with no model URL', () => {
  it('requests no model on a build with no bundled Avatar', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, unmount } = await mountOn('none');
    expect(mocks.loaded).toEqual([]);
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(container.querySelector('.animate-spin')).toBeNull();
    unmount();
    expect(error).not.toHaveBeenCalled();
  });

  it.each(['', 'nsfw'])('loads the bundled default on a build with FORMAMORPH_AVATARS "%s"', async (avatarSet) => {
    const { container, unmount } = await mountOn(avatarSet);
    expect(mocks.loaded).toEqual(['./default-avatar.vrm']);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    unmount();
  });
});
