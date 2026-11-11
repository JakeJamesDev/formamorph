import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AvatarChangeIcon } from './AvatarChangeIcon';
import { SetupTraitList } from './SetupTraitList';
import { StatRow } from './StatRow';
import { TraitsTab } from './TraitsTab';
import { groupPickState } from '@/lib/traitGates';
import type { PlayerStat, Trait, TraitGroup, TraitsPanelView } from '@/types';

afterEach(cleanup);

const slider: Trait = { id: 'elf', name: 'Elf', statChanges: [], playerToggle: true, morphPins: [{ name: 'Ear Shape', value: 1 }] };
const color: Trait = { id: 'pale', name: 'Pale', statChanges: [], playerToggle: true, colorPins: [{ channel: 'skin', color: '#eeeeee' }] };
const bodyOnly = {
  id: 'tall', name: 'Tall', statChanges: [], playerToggle: true, body: { pick: { kind: 'body', id: 'tall' } },
} as unknown as Trait;
const group: TraitGroup = { id: 'g', name: 'Origin', parentId: null };

const icon = () => screen.queryByTestId('avatar-change-icon');

describe('AvatarChangeIcon', () => {
  it('names the changes for an owner whose Avatar is in use', () => {
    render(<AvatarChangeIcon names={['Ear Shape', 'Skin Color']} inUse />);
    expect(icon()).toHaveAttribute('aria-label', "Changes the Avatar's appearance.\nEar Shape and Skin Color.");
  });

  it('draws nothing without an Avatar in use', () => {
    render(<AvatarChangeIcon names={['Ear Shape']} inUse={false} />);
    expect(icon()).toBeNull();
  });

  it('draws nothing without names', () => {
    render(<AvatarChangeIcon names={[]} inUse />);
    expect(icon()).toBeNull();
  });
});

describe('new-game trait selection', () => {
  const renderList = (avatarInUse: boolean, traits: Trait[]) => render(
    <SetupTraitList
      name="Origin" groups={[group]} traits={traits} picks={groupPickState(group, traits, [])} stats={[]}
      selectedTraits={[]} resolveText={(t) => t} resolveTraitText={(_t, text) => text} onTraitSelect={() => {}}
      avatarInUse={avatarInUse}
    />,
  );

  it('shows the icon on a slider pin when the persona has an Avatar', () => {
    renderList(true, [slider]);
    expect(icon()).toBeInTheDocument();
  });

  it('shows no icon when the persona has no Avatar', () => {
    renderList(false, [slider]);
    expect(icon()).toBeNull();
  });

  it('shows no icon on a Body pick alone', () => {
    renderList(true, [bodyOnly]);
    expect(icon()).toBeNull();
  });
});

describe('the Traits tab in play', () => {
  const view: TraitsPanelView = { query: '', keys: null, open: new Set(), openDisabled: new Set(), expanded: new Set() };
  const renderTab = (traits: Trait[], avatarInUse?: (ownerId: string | null) => boolean) => render(
    <TraitsTab
      traits={traits} groups={[]} stats={[]} isOff={() => false} readOnly={false} onToggleTrait={() => {}}
      resolveTraitText={(_t, text) => text} view={view} setView={() => {}} avatarInUse={avatarInUse}
    />,
  );

  it('shows the icon on a color pin and none on a Body pick', () => {
    renderTab([color, bodyOnly], () => true);
    expect(screen.getAllByTestId('avatar-change-icon')).toHaveLength(1);
    expect(icon()).toHaveAttribute('aria-label', expect.stringContaining('Skin Color'));
  });

  it('asks about the trait’s own owner', () => {
    const asked: (string | null)[] = [];
    renderTab([slider], (ownerId) => { asked.push(ownerId); return false; });
    expect(asked).toEqual([null]);
    expect(icon()).toBeNull();
  });

  it('shows no icon when the panel is not told an Avatar is in use', () => {
    renderTab([slider]);
    expect(icon()).toBeNull();
  });
});

describe('the Stats tab in play', () => {
  const stat = (extra: Partial<PlayerStat>) => ({ id: 'girth', name: 'Girth', min: 0, max: 10, value: 5, ...extra }) as PlayerStat;
  const renderRow = (s: PlayerStat, avatarInUse: boolean) => render(
    <StatRow
      stat={s} change={0} barDelta={0} draining={false} page={0} isViewingPast={false} snap fading={false}
      editable={false} reserveDescriptorLine={false} onCommitValue={() => {}} avatarInUse={avatarInUse}
    />,
  );

  it('shows the icon on a stat with a slider row', () => {
    renderRow(stat({ morphBindings: [{ name: 'Belly', by: 1 }] }), true);
    expect(icon()).toBeInTheDocument();
  });

  it('shows the icon on a stat with a color row', () => {
    renderRow(stat({ colorBindings: [{ channel: 'hair', color: '#ff0000' }] }), true);
    expect(icon()).toBeInTheDocument();
  });

  it('shows no icon without an Avatar, or on a stat with no rows', () => {
    renderRow(stat({ morphBindings: [{ name: 'Belly', by: 1 }] }), false);
    expect(icon()).toBeNull();
    cleanup();
    renderRow(stat({}), true);
    expect(icon()).toBeNull();
  });
});
