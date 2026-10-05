/**
 * DEV only: canned props for the panes the dev router opens on their own (see `DevPaneRoutes`). Each one is
 * long enough to overflow its pane at a desktop viewport, so the pane's scrolling is checkable.
 */
import type { ChipRow } from '@/lib/chipVocabulary';
import type { ChangelogDraft } from '@/lib/listingChangelog';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { PROMPT_TEXT_KEYS, type PromptValues } from '@/lib/promptPresets';
import { buildSharedPreset, serializeSharedJson } from '@/lib/promptPresetShare';
import type { FeedbackThread } from '@/types';

const PARAGRAPH = 'The lantern road climbs past the old mill, where the river turns twice before it reaches the harbor. '
  + 'Travelers stop at the ford to water their horses, and the miller sells bread to anyone who asks.';

/** Prose of `count` paragraphs, as an author would write a long description. */
const prose = (count: number) => Array.from({ length: count }, () => PARAGRAPH).join('\n\n');

export function devFeedbackThread(): FeedbackThread {
  const at = new Date().toISOString();
  return {
    id: 'dev-feedback-thread',
    type: 'bug',
    title: 'The map stops panning after a long session',
    category: 'visuals',
    body: prose(6),
    status: 'open',
    reporter: { id: 'dev-user', username: 'Sample Player' },
    diagnostics: { version: '3.1.2', platform: 'browser', system: 'Windows 11' },
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
