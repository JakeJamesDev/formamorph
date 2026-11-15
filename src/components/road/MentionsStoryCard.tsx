import { ModelDownloadBar, toMegabytes } from '@/components/formaquestion/ModelDownloadBar';
import { ContributeQuestion } from '@/components/game/ContributeQuestion';
import { MentionsDownloadError } from '@/components/modals/CharacterMentionsRows';
import { useSettings } from '@/contexts/SettingsContext';
import { useCharacterMentionsState } from '@/lib/coref/characterMentionsApp';
import { usePlannedDownloadSize } from '@/lib/coref/usePlannedDownloadSize';
import { MentionsPreview, MentionsPreviewButton } from './MentionsPreview';
import { StoryCard } from './StoryCard';

/** The Character Mentions offer: a preview of the feature in Morphie's place. Turn On starts the Settings toggle's
 *  download, which then shows in the card, with the Contribute Corrections question when `asking`. */
export function MentionsStoryCard({ accepted, onTurnOn, onNotNow, asking = false, onAnswer, previewOpen, className }: {
  accepted: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
  asking?: boolean;
  onAnswer?: (yes: boolean) => void;
  /** Opens the larger preview at mount (DEV dev-router). */
  previewOpen?: boolean;
  className?: string;
}) {
  const { characterMentionsModel: choice } = useSettings();
  const { status, progress, error } = useCharacterMentionsState();
  const size = usePlannedDownloadSize(choice, true);

  const download = size === null ? 'a one-time download' : `a one-time ${toMegabytes(size)} MB download`;
  return (
    <StoryCard
      className={className}
      testId="mentions-story-card"
      ariaLabel="Character Mentions"
      title="Turn On Character Mentions?"
      body={`Names and pronouns in the narration link to the characters they mean, and each quote takes its speaker's color. It runs on your device after ${download}.`}
      media={(
        <div>
          <div className="text-helper">
            <MentionsPreview />
          </div>
          <MentionsPreviewButton defaultOpen={previewOpen} />
        </div>
      )}
      actionLabel="Turn On"
      onAction={accepted ? undefined : onTurnOn}
      onNotNow={accepted && status !== 'error' ? undefined : onNotNow}
    >
      {accepted && (
        <div className="space-y-3">
          {status === 'error' ? <MentionsDownloadError error={error} />
            : status !== 'ready' && <ModelDownloadBar progress={progress} />}
          {/* A failed download offers Not Now instead; the first correction asks then. */}
          {asking && onAnswer && status !== 'error' && <ContributeQuestion onAnswer={onAnswer} />}
        </div>
      )}
    </StoryCard>
  );
}
