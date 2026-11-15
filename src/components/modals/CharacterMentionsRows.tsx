import { useEffect, useState } from 'react';
import { CheckRow, Row, OptionSwitcher } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { ModelDownloadBar } from '@/components/formaquestion/ModelDownloadBar';
import { FieldError, Meta } from '@/components/ui/typography';
import { SETTINGS_COPY, SETTINGS_NOTES, SETTINGS_OPTIONS, type SettingOptionCopy } from '@/components/modals/settingsCopy';
import { optionRowCopy, rowCopy } from '@/components/modals/settingsRowCopy';
import type { CharacterMentionsModel } from '@/contexts/settingsDefaults';
import { isEnglishLanguage } from '@/lib/languages';
import { useMountedRef } from '@/lib/useMountedRef';
import { characterMentions, useCharacterMentionsState } from '@/lib/coref/characterMentionsApp';
import type { DisplaySettingsSource } from './settingsSource';

const MODEL_OPTIONS: readonly SettingOptionCopy<CharacterMentionsModel>[] = SETTINGS_OPTIONS.characterMentionsModel;

const megabytes = (bytes: number) => Math.round(bytes / 1048576);

/** The Character Mentions toggle, its download rows, and the model choice. */
export function CharacterMentionsRows({ source, advanced }: {
  source: Pick<DisplaySettingsSource, 'characterMentions' | 'setCharacterMentions' | 'characterMentionsModel' | 'setCharacterMentionsModel' | 'language'>;
  advanced: boolean;
}) {
  const { characterMentions: enabled, setCharacterMentions, characterMentionsModel: choice, setCharacterMentionsModel, language } = source;
  const english = isEnglishLanguage(language);
  const { status, progress, error } = useCharacterMentionsState();
  const mounted = useMountedRef();
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    if (enabled || !english) return;
    void characterMentions().plannedSize(choice).then((bytes) => {
      if (mounted.current) setSize(bytes);
    });
  }, [enabled, english, choice, mounted]);

  const pickModel = (next: CharacterMentionsModel) => {
    // Picking Auto again probes again (Q5).
    if (next === 'auto') characterMentions().forgetProbe();
    setCharacterMentionsModel(next);
  };

  const below = !english
    ? <Meta>{SETTINGS_NOTES.characterMentionsEnglishOnly}</Meta>
    : !enabled && size !== null
      ? <Meta>{megabytes(size)} MB download</Meta>
      : undefined;
  const selected = MODEL_OPTIONS.find((o) => o.value === choice);

  return (
    <>
      <CheckRow
        htmlFor="characterMentions"
        checked={enabled && english}
        disabled={!english}
        onChange={setCharacterMentions}
        below={below}
        {...rowCopy('characterMentions')}
      />
      {enabled && english && status === 'downloading' && (
        <Row>
          <ModelDownloadBar progress={progress} />
        </Row>
      )}
      {enabled && english && status === 'error' && (
        <Row>
          <div className="flex items-center gap-2">
            <FieldError as="span">Model download failed: {error}</FieldError>
            <Button variant="outline" size="sm" onClick={() => characterMentions().retry()}>Retry</Button>
          </div>
        </Row>
      )}
      {advanced && english && (
        <Row top {...optionRowCopy('characterMentionsModel', selected)}>
          <div>
            <OptionSwitcher ariaLabel={SETTINGS_COPY.characterMentionsModel.label} value={choice} onChange={pickModel} options={MODEL_OPTIONS} />
            {/* Every help line stacked in one cell, so switching options never reflows the row. */}
            <div className="grid mt-2">
              {MODEL_OPTIONS.map((o) => (
                <p key={o.value} className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === choice ? '' : ' invisible'}`}>
                  {o.help}
                </p>
              ))}
            </div>
          </div>
        </Row>
      )}
    </>
  );
}
