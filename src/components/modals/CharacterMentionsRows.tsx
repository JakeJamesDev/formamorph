import { CheckRow, Row, OptionSwitcher } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { ModelDownloadBar, toMegabytes } from '@/components/formaquestion/ModelDownloadBar';
import { FieldError, Meta } from '@/components/ui/typography';
import { SETTINGS_COPY, SETTINGS_NOTES, SETTINGS_OPTIONS, type SettingOptionCopy } from '@/components/modals/settingsCopy';
import { optionRowCopy, rowCopy } from '@/components/modals/settingsRowCopy';
import type { CharacterMentionsModel } from '@/contexts/settingsDefaults';
import { isEnglishLanguage } from '@/lib/languages';
import { characterMentions, useCharacterMentionsState } from '@/lib/coref/characterMentionsApp';
import { usePlannedDownloadSize } from '@/lib/coref/usePlannedDownloadSize';
import { useContributeAccess } from '@/lib/coref/useContributeAccess';
import { contributesNow } from '@/lib/coref/correctionContribution';
import { markContributeAsked } from '@/lib/firstTimeFlowStore';
import type { DisplaySettingsSource } from './settingsSource';

const MODEL_OPTIONS: readonly SettingOptionCopy<CharacterMentionsModel>[] = SETTINGS_OPTIONS.characterMentionsModel;

/** A failed model download, with Retry. */
export function MentionsDownloadError({ error }: { error: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <FieldError as="span">Model download failed: {error}</FieldError>
      <Button variant="outline" size="sm" onClick={() => characterMentions().retry()}>Retry</Button>
    </div>
  );
}

/** The Character Mentions toggle, its download rows, the model choice, and Contribute Corrections (Q64), which shows
 *  only while the feature is on and the player is signed in. */
export function CharacterMentionsRows({ source, advanced }: {
  source: Pick<DisplaySettingsSource,
    | 'characterMentions' | 'setCharacterMentions' | 'characterMentionsModel' | 'setCharacterMentionsModel' | 'language'
    | 'contributeCorrections' | 'setContributeCorrections'>;
  advanced: boolean;
}) {
  const { characterMentions: enabled, setCharacterMentions, characterMentionsModel: choice, setCharacterMentionsModel, language } = source;
  const contributor = useContributeAccess();
  const { access, accountId } = contributor;
  const english = isEnglishLanguage(language);
  const { status, progress, error } = useCharacterMentionsState();
  const size = usePlannedDownloadSize(choice, !enabled && english);

  const pickModel = (next: CharacterMentionsModel) => {
    // Picking Auto again probes again (Q5).
    if (next === 'auto') characterMentions().forgetProbe();
    setCharacterMentionsModel(next);
  };

  const below = !english
    ? <Meta>{SETTINGS_NOTES.characterMentionsEnglishOnly}</Meta>
    : !enabled && size !== null
      ? <Meta>{toMegabytes(size)} MB download</Meta>
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
          <MentionsDownloadError error={error} />
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
      {enabled && english && access !== 'signedOut' && (
        <CheckRow
          htmlFor="contributeCorrections"
          checked={contributesNow(source.contributeCorrections, contributor)}
          disabled={access !== 'ready'}
          onChange={(on) => {
            // A change here answers the ask-once question (Q69).
            if (accountId !== null) markContributeAsked(accountId);
            source.setContributeCorrections(on ? accountId : null);
          }}
          below={access === 'unattested' ? <Meta>{SETTINGS_NOTES.contributeAgeGate}</Meta> : undefined}
          {...rowCopy('contributeCorrections')}
        />
      )}
    </>
  );
}
