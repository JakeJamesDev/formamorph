import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import PromptField from '@/components/prompt/PromptField';
import { plainVocabulary } from '@/lib/chipVocabulary';
import type { PresetOverview } from '@/lib/promptPresets';
import { SETTINGS_COPY } from './settingsCopy';

const NO_SUGGESTIONS: string[] = [];

/**
 * A user preset's Overview: who wrote it, what it is for, and the models it fits. The store normalizes the
 * tag and model lists; this panel only writes the raw edit through.
 */
export function PresetOverviewPanel({ overview, onChange, tagSuggestions = NO_SUGGESTIONS, modelSuggestions = NO_SUGGESTIONS }: {
  overview: PresetOverview;
  onChange: (patch: Partial<PresetOverview>) => void;
  tagSuggestions?: string[];
  modelSuggestions?: string[];
}) {
  const plainVocab = useMemo(() => plainVocabulary(), []);
  const { presetAuthor, presetDescription, presetTags, presetModels } = SETTINGS_COPY;

  return (
    <div className="flex flex-col gap-5 pr-3">
      <div className="space-y-2">
        <Label htmlFor="preset-overview-author">{presetAuthor.label}</Label>
        <Input
          id="preset-overview-author"
          value={overview.author}
          onChange={(e) => onChange({ author: e.target.value })}
        />
        <Hint>{presetAuthor.description}</Hint>
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
      <div className="space-y-2">
        <Label>{presetTags.label}</Label>
        <TokenAutocomplete
          values={overview.tags}
          onChange={(tags) => onChange({ tags })}
          options={tagSuggestions}
          ariaLabel={presetTags.label}
          reorderable
          editable
          placeholder="Add tags"
        />
        <Hint>{presetTags.description}</Hint>
      </div>
      <div className="space-y-2">
        <Label>{presetModels.label}</Label>
        <TokenAutocomplete
          values={overview.models}
          onChange={(models) => onChange({ models })}
          options={modelSuggestions}
          ariaLabel={presetModels.label}
          reorderable
          editable
          placeholder="Add models"
        />
        <Hint>{presetModels.description}</Hint>
      </div>
    </div>
  );
}
