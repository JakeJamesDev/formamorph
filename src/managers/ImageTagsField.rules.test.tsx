import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';
import { LOCATION_RULE_HOST, type RuleHost } from '@/components/editor/ImageRuleCog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/owners';
import { startingGateStats } from '@/lib/gateStats';
import type { Entity, GalleryImage, Stat, Trait, TraitRequirementRow } from '@/types';

vi.mock('../lib/UtilityComponents', () => ({
  ImageUpload: ({ value, id }: { value?: string | null; id: string }) => <div data-testid="slot" data-value={value ?? ''} data-slot-id={id} />,
}));
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div>generate</div> }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => <div /> }));
vi.mock('@/lib/useRemoteImage', () => ({ RemoteImg: ({ src }: { src?: string }) => <img src={src} alt="" /> }));
vi.mock('@/lib/useDownscalePrompt', () => ({ useDownscalePrompt: () => ({ promptImagesBatch: vi.fn(), dialog: null }) }));

const A = 'data:image/webp;base64,AAAA';
const B = 'data:image/webp;base64,BBBB';
const C = 'data:image/webp;base64,CCCC';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, starting: 10, regen: 0, descriptors: [], ...extra });
const healed: Trait = { id: 'healed', name: 'Healed', statChanges: [] };
const wren: Entity = { id: 'wren', name: 'Wren', traits: [healed], stats: [stat('health', 'Health')] };
const WREN_HOST = { kind: 'entity', id: 'wren' } as const;

const lowHealth: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'percent' }] }];
const notHealed: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'healed', not: true }] }];

/** The gallery over Wren in a world of her own, as the World Editor's entity panel mounts it. */
function Harness({ initial, inDialog = false, ruleCog, host = WREN_HOST }: {
  initial: GalleryImage[]; inDialog?: boolean; ruleCog?: boolean; host?: RuleHost;
}) {
  const [images, setImages] = useState(initial);
  // A location's rules read the played persona, and an item's offer the player for what a persona holds, so there Wren is one.
  const cast = host.kind === 'entity' ? [wren] : [{ ...wren, persona: true }];
  const world = { traits: [], traitGroups: [], entities: cast };
  const store = {
    ...world, placeholders: [], stats: [],
    gateInput: editorGateInput(world, startingGateStats({ stats: [], statGroups: [], entities: cast })),
    pinWorld: null,
  } as unknown as TraitStore;
  const gallery = (
    <ImageTagsField
      label="Image"
      images={images}
      onImagesChange={setImages}
      slots={4}
      imageId="x"
      cap={IMAGE_CAPS.entity}
      kind="character"
      onTagsChange={vi.fn()}
      ruleHost={host}
      ruleCog={ruleCog}
    />
  );
  return (
    <TooltipProvider>
      <TraitStoreContext.Provider value={store}>
        {inDialog ? <Dialog open><DialogContent><DialogTitle>Wren</DialogTitle>{gallery}</DialogContent></Dialog> : gallery}
        <output data-testid="images">{JSON.stringify(images)}</output>
      </TraitStoreContext.Provider>
    </TooltipProvider>
  );
}

const stored = (): GalleryImage[] => JSON.parse(screen.getByTestId('images').textContent!);
const tile = (name: string | RegExp) => screen.getByRole('button', { name });
/** The tile's wrapper, which holds its badge. */
const tileBox = (name: string | RegExp) => tile(name).parentElement!;
/** The framed slot's box: the gallery renders every slot and hides all but the framed one. */
const framedSlot = () => [...document.querySelectorAll<HTMLElement>('[data-slot-frame]')]
  .find((frame) => !frame.parentElement!.classList.contains('hidden'))!;
/** The framed slot's rule button; its name carries the rule. */
const frameRule = () => within(framedSlot()).getByRole('button', { name: /^Visibility Rule/ });
/** Frames the tile, then returns the rule button over the frame. */
const ruleOf = (name: string | RegExp) => { fireEvent.click(tile(name)); return frameRule(); };

describe('Gallery Visibility rules on a location', () => {
  it('names the persona as the owner of a Condition with no owner on a target the world does not hold, once', async () => {
    render(<Harness initial={[{ data: A }, { data: B }]} host={LOCATION_RULE_HOST} />);
    fireEvent.click(ruleOf('Image 2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a requirement…' }));
    // The rule's first page, Persona, adds with no owner; Wren's page would name her (Q44).
    fireEvent.click(within(await screen.findByRole('group', { name: 'Persona Traits' })).getByRole('option', { name: /^Healed/ }));

    expect(screen.queryByRole('button', { name: 'Back to targets' })).toBeNull();
    expect(stored()[1].requires).toEqual([{ all: [{ kind: 'trait', id: 'healed' }] }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Owner: The player' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['The player', 'Wren']);
  });

  it("reads a Condition with no owner as the persona's on the rule button, and gives no cover warning", () => {
    render(<Harness initial={[{ data: A, requires: lowHealth }, { data: B }]} host={LOCATION_RULE_HOST} />);
    expect(frameRule()).toHaveAccessibleName("Visibility Rule: Shown while the player's Health is below 20%");
    expect(document.querySelector('[data-image-rule-cover-warning]')).toBeNull();
  });
});

describe('Gallery Visibility rules on an item', () => {
  const LAMP_HOST: RuleHost = { kind: 'item', id: 'lamp' };

  it("names the item's owner as the owner of a Condition with no owner, and offers the player and each entity by name", async () => {
    render(<Harness initial={[{ data: A }, { data: B }]} host={LAMP_HOST} />);
    fireEvent.click(ruleOf('Image 2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a requirement…' }));
    // The rule's first page, Item Owner, adds with no owner.
    fireEvent.click(within(await screen.findByRole('group', { name: 'Item Owner Traits' })).getByRole('option', { name: /^Healed/ }));

    expect(screen.queryByRole('button', { name: 'Back to targets' })).toBeNull();
    expect(stored()[1].requires).toEqual([{ all: [{ kind: 'trait', id: 'healed' }] }]);
    fireEvent.click(await screen.findByRole('button', { name: "Owner: The item's owner" }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(["The item's owner", 'The player', 'Wren']);
  });

  it('names the framed image’s rule on its rule button', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: notHealed }]} host={LAMP_HOST} />);
    fireEvent.click(tile(/^Image 2/));
    expect(frameRule()).toHaveAccessibleName("Visibility Rule: Shown while the item's owner doesn't have Healed");
  });
});

describe('Gallery Visibility rules', () => {
  it('opens the rows editor from the frame’s rule button and stores the rule on that image only', async () => {
    render(<Harness initial={[{ data: A }, { data: B }, { data: C }]} />);
    fireEvent.click(ruleOf('Image 2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a requirement…' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Health/ }));

    expect(stored()).toEqual([
      { data: A },
      { data: B, requires: [{ all: [{ kind: 'stat', id: 'health', operator: '>=', value: 50, unit: 'raw' }] }] },
      { data: C },
    ]);
  });

  it('drops the field when the last row is removed', async () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    fireEvent.click(ruleOf(/^Image 2/));
    fireEvent.click(await screen.findByRole('button', { name: /^Delete row: / }));

    expect(stored()).toEqual([{ data: A }, { data: B }]);
    expect(stored()[1]).not.toHaveProperty('requires');
  });

  it('badges a conditioned thumbnail and not a plain one', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    expect(tileBox('Primary image').querySelector('[data-image-rule-badge]')).toBeNull();
    expect(tileBox(/^Image 2/).querySelector('[data-image-rule-badge]')).not.toBeNull();
    expect(tile('Image 2, has a Visibility rule')).toBeInTheDocument();
  });

  it('names a stat Condition on the framed image’s rule button', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    expect(frameRule()).toHaveAccessibleName('Visibility Rule: Always shows');
    fireEvent.click(tile(/^Image 2/));
    expect(frameRule()).toHaveAccessibleName("Visibility Rule: Shown while Wren's Health is below 20%");
  });

  it('draws no rule button over the open slot, and none on the strip’s tiles', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    fireEvent.click(screen.getByLabelText('Add an Image'));
    expect(within(framedSlot()).queryByRole('button', { name: /^Visibility Rule/ })).toBeNull();
    expect(within(tileBox(/^Image 2/)).queryByRole('button', { name: /^Visibility Rule/ })).toBeNull();
  });

  it('hides the frame’s rule button when the host edits the rule, and keeps the badge and the cover warning', () => {
    render(<Harness initial={[{ data: A, requires: lowHealth }, { data: B, requires: lowHealth }]} ruleCog={false} />);
    fireEvent.click(tile(/^Image 2/));

    expect(screen.queryByRole('button', { name: /^Visibility Rule/ })).toBeNull();
    expect(tileBox(/^Image 2/).querySelector('[data-image-rule-badge]')).not.toBeNull();
    expect(document.querySelector('[data-image-rule-cover-warning]')).not.toBeNull();
  });

  it('reads a trait Condition, and Not', () => {
    render(<Harness initial={[{ data: A }, { data: B, requires: notHealed }]} />);
    fireEvent.click(tile(/^Image 2/));
    expect(frameRule()).toHaveAccessibleName("Visibility Rule: Shown while Wren doesn't have Healed");
  });

  it('warns only while the primary image carries a rule', () => {
    const { unmount } = render(<Harness initial={[{ data: A }, { data: B, requires: lowHealth }]} />);
    expect(document.querySelector('[data-image-rule-cover-warning]')).toBeNull();
    unmount();

    render(<Harness initial={[{ data: A, requires: lowHealth }, { data: B }]} />);
    expect(document.querySelector('[data-image-rule-cover-warning]')).toHaveTextContent('Outside a game, the primary image shows even when its rule hides it');
  });

  it('keeps the entity editor dialog open while the popover is used', async () => {
    render(<Harness initial={[{ data: A }, { data: B }]} inDialog />);
    fireEvent.click(ruleOf('Image 2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a requirement…' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Health/ }));

    expect(screen.getByRole('dialog', { name: 'Wren' })).toBeInTheDocument();
    expect(stored()[1].requires).toHaveLength(1);
  });

  it('draws no rule button for a gallery with no rule host', () => {
    render(
      <TooltipProvider>
        <ImageTagsField label="Background Image" images={[{ data: A }, { data: B }]} onImagesChange={vi.fn()} slots={4}
          imageId="y" cap={IMAGE_CAPS.entity} kind="location" onTagsChange={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.queryByRole('button', { name: /^Visibility Rule/ })).toBeNull();
  });

  it('draws no rule button where nothing can supply a rule’s targets', () => {
    render(
      <TooltipProvider>
        <ImageTagsField label="Image" images={[{ data: A }, { data: B }]} onImagesChange={vi.fn()} slots={4}
          imageId="z" cap={IMAGE_CAPS.entity} kind="character" onTagsChange={vi.fn()} ruleHost={WREN_HOST} />
      </TooltipProvider>,
    );
    expect(screen.queryByRole('button', { name: /^Visibility Rule/ })).toBeNull();
  });
});
