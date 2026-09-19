import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import PromptField from '@/components/prompt/PromptField';
import { plainVocabulary } from '@/lib/chipVocabulary';
import type { PresetOverview } from '@/lib/promptPresets';
import { SETTINGS_COPY, type SettingCopy } from './settingsCopy';

const NO_SUGGESTIONS: string[] = [];

/** A free-form chip list, read as label, help, control. */
function ChipField({ copy, values, onChange, suggestions, placeholder, onOpen }: {
  copy: SettingCopy;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: string[];
  placeholder: string;
  /** Runs when the field takes focus; a field with it lists its suggestions before any typing. */
  onOpen?: () => void;
}) {
  return (
    <div className="space-y-2" onFocus={onOpen}>
      <Label>{copy.label}</Label>
      <Hint>{copy.description}</Hint>
      <TokenAutocomplete
        values={values}
        onChange={onChange}
        options={suggestions}
        ariaLabel={copy.label}
        reorderable
        editable
        openOnFocus={!!onOpen}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * A user preset's Overview: who wrote it, what it is for, and the models it fits. The store normalizes the
 * tag and model lists; this panel only writes the raw edit through.
 */
export function PresetOverviewPanel({ overview, onChange, tagSuggestions = NO_SUGGESTIONS, modelSuggestions = NO_SUGGESTIONS, onModelsOpen }: {
  overview: PresetOverview;
  onChange: (patch: Partial<PresetOverview>) => void;
  tagSuggestions?: string[];
  modelSuggestions?: string[];
  /** Runs when the Models field opens, so its suggestions load on demand. */
  onModelsOpen?: () => void;
}) {
  const plainVocab = useMemo(() => plainVocabulary(), []);
  const { presetAuthor, presetDescription, presetTags, presetModels } = SETTINGS_COPY;

  return (
    <div className="flex flex-col gap-5 pr-3">
      <div className="space-y-2">
        <Label htmlFor="preset-overview-author">{presetAuthor.label}</Label>
        <Hint>{presetAuthor.description}</Hint>
        <Input
          id="preset-overview-author"
          value={overview.author}
          onChange={(e) => onChange({ author: e.target.value })}
        />
      </div>
      <PromptField
        label={presetDescription.label}
        ariaLabel={presetDescription.label}
        hint={presetDescription.description}
        value={overview.description}
        onChange={(description) => onChange({ description })}
        vocabulary={plainVocab}
        placeholder="Add a description"
        markdown
        resizable
      />
      <ChipField copy={presetTags} values={overview.tags} onChange={(tags) => onChange({ tags })} suggestions={tagSuggestions} placeholder="Add tags" />
      <ChipField copy={presetModels} values={overview.models} onChange={(models) => onChange({ models })} suggestions={modelSuggestions} placeholder="Add models" onOpen={onModelsOpen} />
    </div>
  );
}
