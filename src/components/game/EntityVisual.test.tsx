import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityVisual } from './EntityVisual';
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

const AVATAR = <div data-testid="avatar-viewer" />;

describe('EntityVisual', () => {
  it('shows the model with a button to the image when the entity has both', async () => {
    render(<EntityVisual entity={entity({ images: [{ data: IMAGE }], model: MODEL })} />);

    expect(screen.getByTestId('model-viewer')).toHaveTextContent('statue.glb');
    expect(screen.queryByAltText('Sedge')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'View Image' }));
    expect(await screen.findAllByAltText('Sedge')).not.toHaveLength(0);
  });

  it('offers no corner button for an image-only entity', () => {
    render(<EntityVisual entity={entity({ images: [{ data: IMAGE }] })} />);
    expect(screen.getByAltText('Sedge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^View / })).not.toBeInTheDocument();
  });

  it('renders the model in place of the image when that is all the entity has', () => {
    render(<EntityVisual entity={entity({ model: MODEL })} />);

    expect(screen.getByTestId('model-viewer')).toBeInTheDocument();
    // Nothing else to open, so the model is orbited where it stands.
    expect(screen.queryByRole('button', { name: /^View / })).not.toBeInTheDocument();
  });

  it('renders nothing for an entity with no visual at all', () => {
    const { container } = render(<EntityVisual entity={entity({})} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EntityVisual — Avatar', () => {
  const all = () => entity({ images: [{ data: IMAGE }], model: MODEL });

  it('opens on the Avatar before the model and the image, with a button for each of those', () => {
    render(<EntityVisual entity={all()} avatar={AVATAR} />);

    expect(screen.getByTestId('avatar-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('model-viewer')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Sedge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View 3D Model' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Image' })).toBeInTheDocument();
  });

  it('shows the Avatar alone when that is all the entity has', () => {
    render(<EntityVisual entity={entity({})} avatar={AVATAR} onPreferenceChange={() => {}} />);
    expect(screen.getByTestId('avatar-viewer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^View / })).not.toBeInTheDocument();
  });

  it('lets a stored preference open on the image instead, with the Avatar behind its button', async () => {
    const onChange = vi.fn();
    render(<EntityVisual entity={all()} avatar={AVATAR} preference="image" onPreferenceChange={onChange} />);

    expect(screen.getByAltText('Sedge')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-viewer')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'View Avatar' }));
    expect(await screen.findByTestId('avatar-viewer')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Display by Default/ }));
    expect(onChange).toHaveBeenCalledWith('avatar');
  });

  it('falls back to the default order when the preferred visual is gone', () => {
    render(<EntityVisual entity={entity({ images: [{ data: IMAGE }] })} avatar={AVATAR} preference="model" onPreferenceChange={() => {}} />);
    expect(screen.getByTestId('avatar-viewer')).toBeInTheDocument();
  });
});

describe('EntityVisual — display by default', () => {
  const both = () => entity({ images: [{ data: IMAGE }], model: MODEL });

  it('opens on the image, offering the model behind the corner button, once image is preferred', () => {
    render(<EntityVisual entity={both()} preference="image" onPreferenceChange={() => {}} />);

    expect(screen.getByAltText('Sedge')).toBeInTheDocument();
    expect(screen.queryByTestId('model-viewer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View 3D Model' })).toBeInTheDocument();
  });

  it('makes the image the default from the zoom viewer', async () => {
    const onChange = vi.fn();
    render(<EntityVisual entity={both()} onPreferenceChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'View Image' }));
    const toggle = await screen.findByRole('button', { name: /Display by Default/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith('image');
  });

  it('sends the player back to the model from the model dialog, the reverse control', async () => {
    const onChange = vi.fn();
    render(<EntityVisual entity={both()} preference="image" onPreferenceChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'View 3D Model' }));
    await userEvent.click(await screen.findByRole('button', { name: /Display by Default/ }));
    expect(onChange).toHaveBeenCalledWith('model');
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
    await userEvent.click(screen.getByRole('button', { name: 'View Image' }));

    expect(await screen.findAllByAltText('Sedge')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Display by Default/ })).not.toBeInTheDocument();
  });

  it('ignores a preference for an entity that has only one of the two', () => {
    render(<EntityVisual entity={entity({ images: [{ data: IMAGE }] })} preference="model" onPreferenceChange={() => {}} />);
    // Nothing to switch to: a stale preference must not blank the picture.
    expect(screen.getByAltText('Sedge')).toBeInTheDocument();
  });
});

describe('EntityVisual — gallery', () => {
  const IMAGE_B = 'data:image/webp;base64,BBBB';
  const two = () => entity({ images: [{ data: IMAGE }, { data: IMAGE_B }] });

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
    render(<EntityVisual entity={entity({ images: [{ data: IMAGE }] })} imageIndex={0} onImageStep={() => {}} />);
    expect(screen.queryByLabelText('Next image')).toBeNull();
    expect(screen.queryByText('1/1')).toBeNull();
  });

  it('stays plain without a host to page it (the editor preview)', () => {
    render(<EntityVisual entity={two()} />);
    expect(screen.queryByLabelText('Next image')).toBeNull();
    expect(screen.queryByText('1/2')).toBeNull();
  });
});
