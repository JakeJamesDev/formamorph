import { Fragment } from 'react';
import { YouMark } from '@/components/game/YouMark';
import type { GateLinePart } from '@/lib/traitGateLine';

/** A gate line as the player reads it: the played persona's name takes the You pill. */
export function GateLineText({ parts }: { parts: readonly GateLinePart[] }) {
  return (
    <>
      {parts.map((part, i) => (typeof part === 'string'
        ? <Fragment key={i}>{part}</Fragment>
        : <Fragment key={i}>{part.persona}<YouMark /></Fragment>))}
    </>
  );
}
