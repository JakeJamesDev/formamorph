import { ModelDownloadBar, toMegabytes } from '@/components/formaquestion/ModelDownloadBar';
import { MentionsDownloadError } from '@/components/modals/CharacterMentionsRows';
import { useSettings } from '@/contexts/SettingsContext';
import { useCharacterMentionsState } from '@/lib/coref/characterMentionsApp';
import { usePlannedDownloadSize } from '@/lib/coref/usePlannedDownloadSize';
import { StoryCard } from './StoryCard';

/** The Character Mentions offer: Turn On starts the Settings toggle's download, which then shows in the card. */
export function MentionsStoryCard({ accepted, onTurnOn, onNotNow, className }: {
  accepted: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
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
      actionLabel="Turn On"
      onAction={accepted ? undefined : onTurnOn}
      onNotNow={accepted && status !== 'error' ? undefined : onNotNow}
    >
      {accepted && (
        <div className="mt-2">
          {status === 'error' ? <MentionsDownloadError error={error} /> : <ModelDownloadBar progress={progress} />}
        </div>
      )}
    </StoryCard>
  );
}
