import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { BookOpen, Earth, Users } from 'lucide-react';
import { stubSegmentWidths } from '@/test/segmentWidths';
import { CollapsingToggleGroup } from './collapsing-toggle-group';
import { CollapsingTabsList } from './collapsing-tabs-list';
import { SEGMENT_MOTION } from './segmentMotion';
import { Tabs } from './tabs';
import { TooltipProvider } from './tooltip';

type V = 'worlds' | 'entities' | 'dictionaries';
const OPTIONS = [
  { value: 'worlds', label: 'Worlds', icon: Earth },
  { value: 'entities', label: 'Entities', icon: Users },
  { value: 'dictionaries', label: 'Dictionaries', icon: BookOpen },
] as const satisfies readonly { value: V; label: string; icon: typeof Earth }[];

const stub = stubSegmentWidths('Dictionaries');

const nextFrame = () => act(async () => {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
});

function Strips() {
  const [toggle, setToggle] = useState<V>('worlds');
  const [tab, setTab] = useState<V>('worlds');
  return (
    <TooltipProvider>
      <CollapsingToggleGroup options={OPTIONS} value={toggle} onValueChange={setToggle} aria-label="Toggle" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as V)}>
        <CollapsingTabsList tabs={OPTIONS} value={tab} aria-label="Fill" />
      </Tabs>
      <Tabs value={tab} onValueChange={(v) => setTab(v as V)}>
        <CollapsingTabsList hug tabs={OPTIONS} value={tab} aria-label="Hug" />
      </Tabs>
    </TooltipProvider>
  );
}

const hasAll = (className: string, classes: string) => classes.split(' ').every((c) => className.split(' ').includes(c));

describe('segment motion', () => {
  it('moves every kind of strip by the one shared motion', async () => {
    stub.room = 400;
    render(<Strips />);
    await nextFrame();
    const segments = [...screen.getAllByRole('radio'), ...screen.getAllByRole('tab')];
    expect(segments).toHaveLength(9);
    for (const segment of segments) {
      expect(hasAll(segment.className, SEGMENT_MOTION.segment)).toBe(true);
      expect(hasAll(segment.querySelector('.grid')!.className, SEGMENT_MOTION.label)).toBe(true);
    }
    const pills = document.querySelectorAll('[data-collapsing-pill]');
    expect(pills).toHaveLength(3);
    pills.forEach((pill) => expect(hasAll(pill.className, SEGMENT_MOTION.pill)).toBe(true));
  });

  it('names its curve in a form Tailwind generates, not the arbitrary ease that tailwindcss-animate makes ambiguous', () => {
    const classes = Object.values(SEGMENT_MOTION).join(' ');
    expect(classes).not.toMatch(/(^|\s)ease-\[/);
    expect(classes).toContain('[transition-timing-function:');
  });
});
