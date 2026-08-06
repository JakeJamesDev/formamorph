import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityVisual, hasEntityVisual } from './EntityVisual';
import type { Entity } from '@/types';

// The real viewer needs a WebGL context jsdom has none of; what matters here is which visual gets mounted.
vi.mock('@/views/ModelViewer', () => ({
  default: ({ model }: { model: { name?: string } }) => (
    <div data-testid="model-viewer">{model.name}</div>
  ),
}));

const MODEL = { name: 'statue.glb', type: 'model/gltf-binary', data: 'data:model/gltf-binary;base64,AAAA' };
const IMAGE = 'data:image/webp;base64,AAAA';

const entity = (extra: Partial<Entity>): Entity =>
  ({ id: 'e1', name: 'Sedge', ...extra }) as Entity;

describe('hasEntityVisual', () => {
  it('accepts an image or a model and rejects an entity with neither', () => {
    expect(hasEntityVisual(entity({ images: [IMAGE] }))).toBe(true);
    expect(hasEntityVisual(entity({ model: MODEL }))).toBe(true);
    expect(hasEntityVisual(entity({}))).toBe(false);
    expect(hasEntityVisual(undefined)).toBe(false);
  });

  it('rejects a model asset carrying no data, which nothing could load', () => {
    expect(hasEntityVisual(entity({ model: { name: 'statue.glb' } as Entity['model'] }))).toBe(false);
  });
});

describe('EntityVisual', () => {
  it('shows the image with a button to the model when the entity has both', async () => {
    render(<EntityVisual entity={entity({ images: [IMAGE], model: MODEL })} />);

    expect(screen.getByAltText('Sedge')).toBeInTheDocument();
    // Inline would cover the image; the model waits behind the button until asked for.
    expect(screen.queryByTestId('model-viewer')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'View 3D model' }));
    expect(await screen.findByTestId('model-viewer')).toHaveTextContent('statue.glb');
  });

  it('offers no model button for an image-only entity', () => {
    render(<EntityVisual entity={entity({ images: [IMAGE] })} />);
    expect(screen.getByAltText('Sedge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View 3D model' })).not.toBeInTheDocument();
  });

  it('renders the model in place of the image when that is all the entity has', () => {
    render(<EntityVisual entity={entity({ model: MODEL })} />);

    expect(screen.getByTestId('model-viewer')).toBeInTheDocument();
    // Nothing for a corner button to sit on, so the model is orbited where it stands.
    expect(screen.queryByRole('button', { name: 'View 3D model' })).not.toBeInTheDocument();
  });

  it('renders nothing for an entity with no visual at all', () => {
    const { container } = render(<EntityVisual entity={entity({})} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EntityVisual — display by default', () => {
  const both = () => entity({ images: [IMAGE], model: MODEL });

  it('opens on the model, offering the image behind the corner button, once model is preferred', () => {
    render(<EntityVisual entity={both()} preference="model" onPreferenceChange={() => {}} />);

    expect(screen.getByTestId('model-viewer')).toBeInTheDocument();
    expect(screen.queryByAltText('Sedge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View image' })).toBeInTheDocument();
  });

  it('makes the model the default from the model dialog', async () => {
    const onChange = vi.fn();
    render(<EntityVisual entity={both()} onPreferenceChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'View 3D model' }));
    const toggle = await screen.findByRole('button', { name: /Display by Default/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith('model');
  });

  it('sends the player back to the image from the zoom viewer, the reverse control', async () => {
    const onChange = vi.fn();
    render(<EntityVisual entity={both()} preference="model" onPreferenceChange={onChange} />);

    // The model dialog is unreachable while the model is the default — the zoom viewer is what undoes it,
    // which is why the corner button has to keep the image within reach.
    await userEvent.click(screen.getByRole('button', { name: 'View image' }));
    await userEvent.click(await screen.findByRole('button', { name: /Display by Default/ }));
    expect(onChange).toHaveBeenCalledWith('image');
  });

  it('clears an image preference rather than re-setting it', async () => {
    const onChange = vi.fn();
    render(<EntityVisual entity={both()} preference="image" onPreferenceChange={onChange} />);

    await userEvent.click(screen.getByAltText('Sedge'));
    const toggle = await screen.findByRole('button', { name: /Display by Default/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('offers no preference control when there is no save to write it to', async () => {
    render(<EntityVisual entity={both()} />);
    await userEvent.click(screen.getByRole('button', { name: 'View 3D model' }));

    expect(await screen.findByTestId('model-viewer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Display by Default/ })).not.toBeInTheDocument();
  });

  it('ignores a preference for an entity that has only one of the two', () => {
    render(<EntityVisual entity={entity({ images: [IMAGE] })} preference="model" onPreferenceChange={() => {}} />);
    // Nothing to switch to — a stale preference must not blank the picture.
    expect(screen.getByAltText('Sedge')).toBeInTheDocument();
  });
});

describe('EntityVisual — gallery', () => {
  const IMAGE_B = 'data:image/webp;base64,BBBB';
  const two = () => entity({ images: [IMAGE, IMAGE_B] });

  it('pages with the chevrons and counts the position', async () => {
    const onImageStep = vi.fn();
    render(<EntityVisual entity={two()} imageIndex={0} onImageStep={onImageStep} />);

    expect(screen.getByText('1/2')).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Next image'));
    expect(onImageStep).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByLabelText('Previous image'));
    expect(onImageStep).toHaveBeenCalledWith(-1);
  });

  it('shows the picture at the given index', () => {
    const { container } = render(<EntityVisual entity={two()} imageIndex={1} onImageStep={() => {}} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(IMAGE_B);
  });

  it('clamps an index left over from a longer gallery instead of showing nothing', () => {
    const { container } = render(<EntityVisual entity={two()} imageIndex={9} onImageStep={() => {}} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(IMAGE_B);
    expect(screen.getByText('2/2')).toBeTruthy();
  });

  it('stays plain for a single-picture entity — nothing to page', () => {
    render(<EntityVisual entity={entity({ images: [IMAGE] })} imageIndex={0} onImageStep={() => {}} />);
    expect(screen.queryByLabelText('Next image')).toBeNull();
    expect(screen.queryByText('1/1')).toBeNull();
  });

  it('stays plain without a host to page it (the editor preview)', () => {
    render(<EntityVisual entity={two()} />);
    expect(screen.queryByLabelText('Next image')).toBeNull();
    expect(screen.queryByText('1/2')).toBeNull();
  });
});
