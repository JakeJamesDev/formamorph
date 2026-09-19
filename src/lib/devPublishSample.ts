/**
 * DEV-only stand-ins for what the publish modal would otherwise be opened on from a library card or the
 * Prompts screen. Dynamically imported by `#dev?view=mainMenu&modal=publish[&tab=prompt]`, so the publish
 * dialog — and the contest opt-in inside it — is reachable on a profile with nothing published and no
 * contest really running.
 */
import type { PublishPayload } from '@/lib/publishPayload';
import { promptPublishPayload } from '@/lib/publishPayload';
import { buildSharedPreset } from '@/lib/promptPresetShare';
import type { PromptValues } from '@/lib/promptPresets';

/** Canned payloads by kind: the fields the dialog actually reads, and nothing it doesn't. */
export const DEV_PUBLISH_SAMPLES = {
  world: (): PublishPayload => ({
    kind: 'world',
    name: 'The Long Thaw',
    description: 'A valley coming out of a winter that lasted a generation.',
    contentData: { worldOverview: { name: 'The Long Thaw', tags: ['Fantasy'] } },
    tags: ['Fantasy'],
  }),
  prompt: (): PublishPayload => promptPublishPayload(buildSharedPreset({
    name: 'Terse Narrator',
    style: 'markdown',
    values: { systemPrompt: 'Narrate in short, plain sentences.' } as PromptValues,
    overview: { author: 'Dev', description: 'Short narration for small models.', tags: ['terse'], models: ['Cydonia-24B'] },
  }, 'dev')),
};

/** The canned payload for `tab`, or the world one when the tab names no sample. */
export function devPublishPayload(tab?: string): PublishPayload {
  return (tab === 'prompt' ? DEV_PUBLISH_SAMPLES.prompt : DEV_PUBLISH_SAMPLES.world)();
}
