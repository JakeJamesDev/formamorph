// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { SURFACE_LABELS } from '@/lib/promptGroups';
import { normalizeEndpointUrl } from '@/lib/endpointUrl';
import { DEFAULT_ENDPOINT, DEFAULT_MODEL_NAME } from '@/contexts/settingsDefaults';
import type { ReasoningCapability } from '@/lib/reasoningEffort';
import { reasoningIdentityAnswer } from '@/lib/reasoningIdentity';
import { REASONING_NOTES } from './settingsCopy';

/**
 * Which strength a prompt's Options tab offers. The record on the routed target decides it: a target that
 * caps thinking by tokens gets the Reasoning Budget slider, and every other target gets the Native Reasoning
 * strength dropdown. What a player sees is the field's own label, so that is what these read.
 */

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

/** The cache the context reads its record from, keyed exactly as it keys the active endpoint and model. */
const seedCapability = (record: ReasoningCapability) =>
  localStorage.setItem(
    'FORMAMORPH_reasoningSupport',
    JSON.stringify({ [`${normalizeEndpointUrl(DEFAULT_ENDPOINT)}|${DEFAULT_MODEL_NAME}`]: record }),
  );

const levels = ['none', 'low', 'medium', 'high'] as const;
/** A reasoning model on LM Studio: its native list answered the reasons and budget questions. */
const takesBudget: ReasoningCapability = {
  reasons: true, levels: [...levels], budget: true, dialect: 'lmstudio', offAllowed: null, tools: null,
  sources: { reasons: 'native', levels: 'probe', budget: 'native' },
};
/** A plain OpenAI-compatible endpoint: the probe narrowed the levels and nothing answered the budget. */
const effortOnly: ReasoningCapability = {
  reasons: null, levels: [...levels], budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: { levels: 'probe' },
};
/** A model whose endpoint refuses to switch reasoning off, such as Kimi k3. */
const alwaysReasons: ReasoningCapability = {
  reasons: true, levels: ['low', 'high', 'max'], budget: null, dialect: 'moonshot-k3', offAllowed: null, tools: null,
  sources: { reasons: 'native', levels: 'native', dialect: 'native' },
};

/** Settings → Prompts → Narration → Options, which is where a prompt's own strength lives. */
const openNarrationOptions = () => {
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" initialPromptTab="narration" />
      </SettingsProvider>
    </ThemeProvider>,
  );
  fireEvent.click(screen.getAllByRole('button', { name: SURFACE_LABELS.options }).at(-1)!);
};

/** Every control is read-only under a built-in prompt preset, so a test about one clicks the copy out first. */
const makeEditable = () => fireEvent.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));

describe('the prompt Options strength follows the capability record', () => {
  beforeEach(() => localStorage.clear());

  it('offers the level dropdown and the budget slider together on a target that caps thinking by tokens', () => {
    seedCapability(takesBudget);
    openNarrationOptions();
    expect(screen.getByText('Native Reasoning')).toBeTruthy();
    expect(screen.getByText('Reasoning Budget')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Reasoning Budget' })).toBeTruthy();
    // One switch governs both: there is a single checkbox in the field.
    expect(screen.getAllByRole('checkbox', { name: 'Native Reasoning' })).toHaveLength(1);
  });

  it('offers the strength dropdown on a target whose budget question is unanswered', () => {
    seedCapability(effortOnly);
    openNarrationOptions();
    expect(screen.getByText('Native Reasoning')).toBeTruthy();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
  });

  // The record says the endpoint takes a budget, but OpenAI's dialect names no field to put one in, so
  // there is nothing for the slider to send.
  it('hides the slider on a dialect with no budget field, whatever the record answered', () => {
    seedCapability({ ...takesBudget, dialect: 'openai' });
    openNarrationOptions();
    expect(screen.getByText('Native Reasoning')).toBeTruthy();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
  });
});

describe('a model that always reasons', () => {
  beforeEach(() => localStorage.clear());

  // Statistics prompts ship switched off. On an endpoint that refuses off, the switch still reads checked:
  // the model reasons whatever the setting says, and the request carries no field at all.
  it('shows the prompt switch checked and locked, with the note saying why', () => {
    seedCapability(alwaysReasons);
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.getAttribute('data-state')).toBe('checked');
    expect(box.disabled).toBe(true);
    expect(screen.getByText(REASONING_NOTES.always)).toBeTruthy();
  });

  it('leaves the strength dropdown live, so how hard the model thinks is still a choice', () => {
    seedCapability(alwaysReasons);
    openNarrationOptions();
    makeEditable();
    const strength = screen.getAllByRole('combobox').find((c) => c.textContent?.includes('Global'));
    expect(strength).toBeTruthy();
    expect((strength as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the switch clickable on an ordinary record', () => {
    seedCapability(effortOnly);
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.disabled).toBe(false);
    expect(screen.queryByText(REASONING_NOTES.always)).toBeNull();
  });
});

/**
 * On OpenRouter the same gateway serves models with different controls, and the record decides which. These
 * cases seed the record one OpenRouter models-list entry would leave behind.
 */
describe('an OpenRouter model', () => {
  beforeEach(() => localStorage.clear());

  const openRouter = (over: Partial<ReasoningCapability>): ReasoningCapability => ({
    reasons: true, levels: [...levels], budget: false, dialect: 'openrouter', offAllowed: true, tools: null,
    sources: { reasons: 'native', levels: 'native', budget: 'native', dialect: 'native', offAllowed: 'native' },
    ...over,
  });

  // supports_max_tokens true: the model takes a token budget, so the slider is worth showing.
  it('shows the budget slider where the model takes a token budget', () => {
    seedCapability(openRouter({ budget: true }));
    openNarrationOptions();
    expect(screen.getByRole('slider', { name: 'Reasoning Budget' })).toBeTruthy();
  });

  it('hides the budget slider where the model takes none', () => {
    seedCapability(openRouter({}));
    openNarrationOptions();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
  });

  // An entry naming no efforts leaves the levels empty, which is an answer: there is no strength to pick.
  // The model still reasons, so the switch and the slider stay.
  it('hides the strength dropdown where the model exposes no effort, keeping the switch and the slider', () => {
    seedCapability(openRouter({ levels: [], budget: true }));
    openNarrationOptions();
    expect(screen.getAllByRole('checkbox', { name: 'Native Reasoning' })).toHaveLength(1);
    expect(screen.getByRole('slider', { name: 'Reasoning Budget' })).toBeTruthy();
    expect(screen.queryAllByRole('combobox').filter((c) => c.textContent?.includes('Global'))).toHaveLength(0);
  });

  // OpenRouter's ladders have gaps: this one names Max, High and Low and skips Medium.
  it('lists the efforts the model named, and no others', () => {
    seedCapability(openRouter({ levels: ['max', 'high', 'low'] }));
    openNarrationOptions();
    makeEditable();
    const strength = screen.getAllByRole('combobox').find((c) => c.textContent?.includes('Global'))!;
    // Radix opens a Select from the keyboard; a click needs pointer capture, which jsdom has not got.
    fireEvent.keyDown(strength, { key: 'Enter' });
    const offered = screen.getAllByRole('option').map((o) => o.textContent);
    expect(offered).toEqual(['Global', 'Model Default', 'Low', 'High', 'Max']);
  });

  // mandatory true: the model rejects a switched-off request, so its switch reads checked and locked.
  it('locks the switch on a mandatory model', () => {
    seedCapability(openRouter({ offAllowed: false, levels: ['high', 'low'] }));
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.getAttribute('data-state')).toBe('checked');
    expect(box.disabled).toBe(true);
    expect(screen.getByText(REASONING_NOTES.always)).toBeTruthy();
  });

  it('leaves the switch clickable on a model the list calls optional', () => {
    seedCapability(openRouter({ offAllowed: true }));
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.disabled).toBe(false);
  });
});

/**
 * A vLLM server, the hosted Default included, publishes nothing about its own reasoning: whether it separates
 * reasoning at all depends on a parser its operator chose to start. Both controls therefore wait for one
 * reply to show a separate reasoning field, which is what the record's budget answer carries.
 */
describe('a vLLM server before and after a reply proves it separates its reasoning', () => {
  beforeEach(() => localStorage.clear());

  /** What the model list alone leaves behind: the dialect, and no answer to anything else. */
  const unproven: ReasoningCapability = {
    reasons: null, levels: null, budget: null, dialect: 'vllm', offAllowed: null, tools: null, sources: { dialect: 'native' },
  };
  /** What one reply carrying a reasoning field adds: the budget answered, and the safe levels to pick from. */
  const proven: ReasoningCapability = {
    reasons: true, levels: [...levels], budget: true, dialect: 'vllm', offAllowed: null, tools: null,
    sources: { dialect: 'native', reasons: 'observed', levels: 'observed', budget: 'observed' },
  };

  const strengthDropdown = () => screen.queryAllByRole('combobox').filter((c) => c.textContent?.includes('Global'));

  it('shows neither the slider nor the strength dropdown while nothing has proved it', () => {
    seedCapability(unproven);
    openNarrationOptions();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
    expect(strengthDropdown()).toHaveLength(0);
  });

  it('shows both once a reply carried a reasoning field', () => {
    seedCapability(proven);
    openNarrationOptions();
    expect(screen.getByRole('slider', { name: 'Reasoning Budget' })).toBeTruthy();
    expect(strengthDropdown()).toHaveLength(1);
  });
});

/**
 * The records the endpoint identity source writes for Anthropic and Google. Each generation gets a different
 * pair of controls, and the record alone decides which, so these cases seed one record per generation and
 * read the prompt's Options tab.
 */
describe('an Anthropic or Google model, named from the endpoint host', () => {
  beforeEach(() => localStorage.clear());

  /** What `reasoningIdentityAnswer` proves, as `identitySource` stamps it onto the record. */
  const identified = (over: Partial<ReasoningCapability>): ReasoningCapability => ({
    reasons: true, levels: [], budget: false, dialect: 'anthropic-adaptive', offAllowed: null, tools: null,
    sources: { reasons: 'identity', budget: 'identity', dialect: 'identity', levels: 'identity' },
    ...over,
  });

  /** The strength dropdown, which is the only combobox carrying a level word in this field. */
  const strengthDropdown = () =>
    screen.queryAllByRole('combobox').find((c) => /Global|Model Default|Low|Medium|High/.test(c.textContent ?? ''));

  // The endpoint documents `reasoning_effort` as ignored, so offering a strength would promise nothing.
  it('shows the budget slider and no strength dropdown on a Claude model that takes a budget', () => {
    seedCapability(identified({ dialect: 'anthropic-budget', budget: true }));
    openNarrationOptions();
    expect(screen.getByRole('slider', { name: 'Reasoning Budget' })).toBeTruthy();
    expect(strengthDropdown()).toBeUndefined();
  });

  // Claude 4.7 and later reject a manual budget, so the switch is the whole control.
  it('shows neither control beside the switch on a Claude model that decides its own depth', () => {
    seedCapability(identified({ dialect: 'anthropic-adaptive' }));
    openNarrationOptions();
    expect(screen.getAllByRole('checkbox', { name: 'Native Reasoning' })).toHaveLength(1);
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
    expect(strengthDropdown()).toBeUndefined();
  });

  it('shows both controls on a Gemini 2.5 model, which spells strength as a budget', () => {
    seedCapability(identified({
      dialect: 'google-2.5', budget: true, levels: ['minimal', 'low', 'medium', 'high'],
    }));
    openNarrationOptions();
    expect(screen.getByRole('slider', { name: 'Reasoning Budget' })).toBeTruthy();
    expect(strengthDropdown()).toBeTruthy();
  });

  it('shows the strength dropdown and no slider on a Gemini 3 model, which takes a level', () => {
    seedCapability(identified({ dialect: 'google-3', levels: ['low', 'medium', 'high'] }));
    openNarrationOptions();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
    expect(strengthDropdown()).toBeTruthy();
  });

  // Gemini 3 cannot stop thinking, so the switch says so rather than sending a field the model refuses.
  it('locks the switch on a Gemini 3 model, with the note saying why', () => {
    seedCapability(identified({ dialect: 'google-3', levels: ['low', 'medium', 'high'] }));
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.getAttribute('data-state')).toBe('checked');
    expect(box.disabled).toBe(true);
    expect(screen.getByText(REASONING_NOTES.always)).toBeTruthy();
  });

  // Fable and Mythos reject a switched-off request, which only the record knows; the dialect row allows off.
  it('locks the switch on a Claude line that refuses off, though its dialect row allows it', () => {
    seedCapability(identified({ dialect: 'anthropic-adaptive', offAllowed: false }));
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    expect(screen.getByText(REASONING_NOTES.always)).toBeTruthy();
  });

  it('keeps the switch clickable on a Claude model that accepts off', () => {
    seedCapability(identified({ dialect: 'anthropic-adaptive' }));
    openNarrationOptions();
    makeEditable();
    expect((screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement).disabled)
      .toBe(false);
  });
});

/**
 * Moonshot's two Kimi generations differ from each other more than either differs from another vendor: k3
 * offers a gapped ladder and refuses off through its dialect row, while the k2 models offer no strength at
 * all and disagree among themselves about whether off may be sent.
 */
describe('the Native Reasoning controls on a Kimi model', () => {
  beforeEach(() => localStorage.clear());

  /**
   * The record a player on this Kimi model gets. The answers come from the identity row rather than written
   * out here, so the dropdown is asserted against the real ladder and not a copy of it that cannot drift.
   * The sources are stated flatly: no control reads them, and the resolver test is what pins how they land.
   */
  const kimi = (model: string, over: Partial<ReasoningCapability> = {}): ReasoningCapability => {
    const answer = reasoningIdentityAnswer('https://api.moonshot.ai/v1/chat/completions', model)!;
    return {
      ...answer,
      offAllowed: answer.offAllowed ?? null, tools: null,
      sources: { reasons: 'identity', budget: 'identity', dialect: 'identity', levels: 'identity' },
      ...over,
    };
  };

  // k3's ladder skips Medium, so a player must never be offered it: the endpoint rejects the literal.
  it('offers k3 its three rungs and no others', () => {
    seedCapability(kimi('kimi-k3'));
    openNarrationOptions();
    makeEditable();
    const strength = screen.getAllByRole('combobox').find((c) => c.textContent?.includes('Global'))!;
    // Radix opens a Select from the keyboard; a click needs pointer capture, which jsdom has not got.
    fireEvent.keyDown(strength, { key: 'Enter' });
    expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Global', 'Model Default', 'Low', 'High', 'Max']);
  });

  it('shows no strength dropdown on a k2 model, which takes no effort field', () => {
    seedCapability(kimi('kimi-k2.6'));
    openNarrationOptions();
    makeEditable();
    expect(screen.queryAllByRole('combobox').filter((c) => c.textContent?.includes('Global'))).toHaveLength(0);
  });

  it('keeps the k2.6 switch clickable, since that model does take the off signal', () => {
    seedCapability(kimi('kimi-k2.6'));
    openNarrationOptions();
    makeEditable();
    expect((screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement).disabled)
      .toBe(false);
  });

  /**
   * The case only the record can answer: k2-thinking and k2.7-code share k2.6's dialect row, which allows
   * off, and error on `disabled` anyway. Narration ships switched on, so this asserts the lock rather than
   * the stored setting agreeing with it by chance.
   */
  it('locks the switch on a k2 model that errors on disabled, though its dialect row allows off', () => {
    seedCapability(kimi('kimi-k2-thinking'));
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.getAttribute('data-state')).toBe('checked');
    expect(box.disabled).toBe(true);
    expect(screen.getByText(REASONING_NOTES.always)).toBeTruthy();
  });

  // k3 refuses off through its dialect row, with no record answer of its own, so the lock must hold there too.
  it('locks the switch on k3 from its dialect row alone', () => {
    seedCapability(kimi('kimi-k3'));
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.disabled).toBe(true);
  });

  it('shows no budget slider on either Kimi dialect, since Moonshot takes no token cap', () => {
    seedCapability(kimi('kimi-k3', { budget: true }));
    openNarrationOptions();
    expect(screen.queryByRole('slider', { name: 'Reasoning Budget' })).toBeNull();
  });
});
