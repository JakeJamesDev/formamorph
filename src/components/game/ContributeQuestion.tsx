import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/typography';

/** The Contribute Corrections question's words, asked once per account (Q64, Q69). */
export const CONTRIBUTE_QUESTION_COPY = {
  title: 'Help Improve Character Mentions?',
  body: 'Your corrections teach the model who’s who, so names and quotes link to the right character for everyone. Each correction shares the whole passage, and accepted passages are kept. You can change this in Settings.',
  no: 'No Thanks',
  yes: 'Contribute',
};

/** The yes-or-no Contribute Corrections question, in the offer card and in a mention card after a correction. */
export function ContributeQuestion({ onAnswer, focusFirst = false }: {
  onAnswer: (yes: boolean) => void;
  /** Moves focus to the first button, for a card opened from the keyboard. */
  focusFirst?: boolean;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (focusFirst) first.current?.focus(); }, [focusFirst]);
  return (
    <div role="group" aria-label={CONTRIBUTE_QUESTION_COPY.title} data-testid="contribute-question" className="space-y-2">
      <div className="text-label font-semibold">{CONTRIBUTE_QUESTION_COPY.title}</div>
      <Meta as="p">{CONTRIBUTE_QUESTION_COPY.body}</Meta>
      <div className="flex justify-end gap-2">
        <Button ref={first} variant="ghost" size="sm" onClick={() => onAnswer(false)}>{CONTRIBUTE_QUESTION_COPY.no}</Button>
        <Button size="sm" onClick={() => onAnswer(true)}>{CONTRIBUTE_QUESTION_COPY.yes}</Button>
      </div>
    </div>
  );
}
