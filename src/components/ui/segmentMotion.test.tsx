import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { BookOpen, Earth, Users } from 'lucide-react';
import { stubSegmentWidths } from '@/test/segmentWidths';
import { CollapsingToggleGroup } from './collapsing-toggle-group';
import { CollapsingTabsList } from './collapsing-tabs-list';
import { SegmentMotionContext, SEGMENT_MOTIONS, type SegmentMotion } from './segmentMotion';
import { Tabs } from './tabs';
import { TooltipProvider } from './tooltip';

type V = 'worlds' | 'entities' | 'dictionaries';
const OPTIONS = [
  { value: 'worlds', label: 'Worlds', icon: Earth },
  { value: 'entities', label: 'Entities', icon: Users },
  { value: 'dictionaries', label: 'Dictionaries', icon: BookOpen },
] as const satisfies readonly { value: V; label: string; icon: typeof Earth }[];

const stub = stubSegmentWidths('Dictionaries');
const MARKED: SegmentMotion = { segment: 'motion-segment', label: 'motion-label', pill: 'motion-pill' };

const nextFrame = () => act(async () => {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
});

function Strips({ motion, children }: { motion: SegmentMotion; children?: ReactNode }) {
  const [toggle, setToggle] = useState<V>('worlds');
  const [tab, setTab] = useState<V>('worlds');
  return (
    <TooltipProvider>
      <SegmentMotionContext.Provider value={motion}>
        <CollapsingToggleGroup options={OPTIONS} value={toggle} onValueChange={setToggle} aria-label="Toggle" />
        <Tabs value={tab} onValueChange={(v) => setTab(v as V)}>
          <CollapsingTabsList tabs={OPTIONS} value={tab} aria-label="Fill" />
        </Tabs>
        <Tabs value={tab} onValueChange={(v) => setTab(v as V)}>
          <CollapsingTabsList hug tabs={OPTIONS} value={tab} aria-label="Hug" />
        </Tabs>
        {children}
      </SegmentMotionContext.Provider>
    </TooltipProvider>
  );
}

describe('segment motion', () => {
  it('moves every kind of strip by the one motion it is given', async () => {
    stub.room = 400;
    render(<Strips motion={MARKED} />);
    await nextFrame();
    const segments = [...screen.getAllByRole('radio'), ...screen.getAllByRole('tab')];
    expect(segments).toHaveLength(9);
    for (const segment of segments) {
      expect(segment.className).toContain('motion-segment');
      expect(segment.querySelector('.grid')!.className).toContain('motion-label');
    }
    const pills = document.querySelectorAll('[data-collapsing-pill]');
    expect(pills).toHaveLength(3);
    pills.forEach((pill) => expect(pill.className).toContain('motion-pill'));
  });

  it('names its curves in a form Tailwind generates, not the arbitrary ease that tailwindcss-animate makes ambiguous', () => {
    const classes = Object.values(SEGMENT_MOTIONS).flatMap((m) => [m.segment, m.label, typeof m.pill === 'string' ? m.pill : '']).join(' ');
    expect(classes).not.toMatch(/(^|\s)ease-\[/);
    expect(classes).toContain('[transition-timing-function:');
  });

  it('stretches the pill toward a pick: the leading edge first, the trailing edge after the lag', async () => {
    stub.room = 400;
    render(<Strips motion={SEGMENT_MOTIONS.stretch} />);
    await nextFrame();
    const pill = () => document.querySelector<HTMLElement>('[data-collapsing-pill]')!;
    await userEvent.click(screen.getByRole('radio', { name: 'Dictionaries' }));
    expect(pill().style.transition).toBe('left 180ms cubic-bezier(0.2,0,0,1) 90ms, right 180ms cubic-bezier(0.2,0,0,1)');
    await userEvent.click(screen.getByRole('radio', { name: 'Worlds' }));
    expect(pill().style.transition).toBe('left 180ms cubic-bezier(0.2,0,0,1), right 180ms cubic-bezier(0.2,0,0,1) 90ms');
  });
});
