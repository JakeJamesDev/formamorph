/**
 * DEV only: canned props for the panes the dev router opens on their own (see `DevPaneRoutes`). Each one is
 * long enough to overflow its pane at a desktop viewport, so the pane's scrolling is checkable.
 */
import type { ChipRow } from '@/lib/chipVocabulary';
import type { ChangelogDraft } from '@/lib/listingChangelog';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { PROMPT_TEXT_KEYS, type PromptValues } from '@/lib/promptPresets';
import { buildSharedPreset, serializeSharedJson } from '@/lib/promptPresetShare';
import type { Entity, FeedbackThread, FeedbackType, Stat, Trait } from '@/types';

const PARAGRAPH = 'The lantern road climbs past the old mill, where the river turns twice before it reaches the harbor. '
  + 'Travelers stop at the ford to water their horses, and the miller sells bread to anyone who asks.';

/** Prose of `count` paragraphs, as an author would write a long description. */
const prose = (count: number) => Array.from({ length: count }, () => PARAGRAPH).join('\n\n');

/** A sample title and category per branch, so a form opened on any branch reads like one of its own. */
const FEEDBACK_SAMPLES: Record<FeedbackType, Pick<FeedbackThread, 'title' | 'category'>> = {
  bug: { title: 'The map stops panning after a long session', category: 'visuals' },
  suggestion: { title: 'Let me pin a stat to the top of the panel', category: 'interface' },
  question: { title: 'Can a stat change when the player enters a location?', category: 'editor' },
};

export function devFeedbackThread(type: FeedbackType = 'bug'): FeedbackThread {
  const at = new Date().toISOString();
  return {
    id: 'dev-feedback-thread',
    type,
    ...FEEDBACK_SAMPLES[type],
    body: prose(6),
    status: 'open',
    reporter: { id: 'dev-user', username: 'Sample Player' },
    diagnostics: type === 'bug' ? { version: '3.1.2', platform: 'browser', system: 'Windows 11' } : {},
    locked: false,
    votes: 0,
    voted: false,
    createdAt: at,
    updatedAt: at,
    unread: false,
  };
}

export function devChangelogDraft(): ChangelogDraft {
  return { title: 'Update 2', body: prose(8), date: new Date().toISOString().slice(0, 10) };
}

/** Thirty rows under three folders, more than the picker shows at once. */
export function devPickerRows(): ChipRow[] {
  return ['Weather', 'Moods', 'Crowds'].flatMap((heading) => Array.from({ length: 10 }, (_, i) => {
    const id = `dev-${heading.toLowerCase()}-${i + 1}`;
    return {
      token: encodePlaceholderToken({ id, mode: 'world', placementId: id }),
      label: `${heading.slice(0, -1)} ${i + 1}`,
      heading,
      headingKind: 'folder' as const,
    };
  }));
}

/** A shared preset file whose Overview runs past the import preview's height. */
export function devPresetShareJson(appVersion: string): string {
  const overview = { author: 'Sample Author', description: prose(4), tags: ['fantasy', 'slow burn', 'travel'], models: ['Sample Model 24B'] };
  const values = Object.fromEntries(PROMPT_TEXT_KEYS.map((key) => [key, ''])) as PromptValues;
  return serializeSharedJson(buildSharedPreset({ name: 'Sample Preset', style: 'markdown', values, overview }, appVersion));
}

/** Stat code as the Custom Code Execution dialog shows it: one block per stat. */
export function devCustomCodeSample(): string {
  return Array.from({ length: 12 }, (_, i) => [
    `// Stat: Resolve ${i + 1}`,
    'const fatigue = stats.Fatigue ?? 0;',
    'const morale = stats.Morale ?? 50;',
    'return Math.max(0, Math.min(100, morale - fatigue / 2));',
  ].join('\n')).join('\n\n');
}

const galleryPicture = (hue: number, label: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120"><rect width="90" height="120" fill="hsl(${hue} 45% 45%)"/>`
  + `<text x="45" y="68" font-size="30" text-anchor="middle" fill="white">${label}</text></svg>`,
)}`;

/** An entity whose gallery shows every Visibility rule shape: a rule on the primary image, a stat rule, a Not
 *  trait rule, and a plain image. */
export function devGalleryEntity(id: string): Entity {
  const health: Stat = { id: 'dev-health', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 100, regen: 0, descriptors: [] };
  const healed: Trait = { id: 'dev-healed', name: 'Healed', statChanges: [] };
  return {
    id,
    name: 'Wren',
    stats: [health],
    traits: [healed],
    images: [
      { data: galleryPicture(210, '1'), requires: [{ all: [{ kind: 'stat', id: health.id, operator: '>=', value: 50, unit: 'percent' }] }] },
      { data: galleryPicture(20, '2'), requires: [{ all: [{ kind: 'stat', id: health.id, operator: '<', value: 20, unit: 'percent' }, { kind: 'trait', id: healed.id, not: true }] }] },
      { data: galleryPicture(120, '3') },
    ],
  };
}
