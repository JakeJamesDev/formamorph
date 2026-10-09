import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DURATION, DEFAULT_STAGGER } from '@/lib/narrationRevealConfig';
import { setRevealTiming } from '@/lib/revealTimingStore';
import { MarkdownRenderer } from './MarkdownRenderer';

const secondWord = (container: HTMLElement) => container.querySelectorAll<HTMLElement>('[data-sd-animate]')[1];

afterEach(() => {
  cleanup();
  setRevealTiming({ duration: DEFAULT_DURATION, stagger: DEFAULT_STAGGER });
});

describe('the word timing of a reveal', () => {
  it("reads the narration store when no timing is given", () => {
    setRevealTiming({ duration: 555, stagger: 33 });
    const { container } = render(<MarkdownRenderer text="Hello brave world" animate animation="reveal" />);
    expect(secondWord(container).style.getPropertyValue('--sd-duration')).toBe('555ms');
    expect(secondWord(container).style.getPropertyValue('--sd-delay')).toBe('33ms');
  });

  it('takes a given timing over the store', () => {
    setRevealTiming({ duration: 555, stagger: 33 });
    const { container } = render(<MarkdownRenderer text="Hello brave world" animate animation="reveal" timing={{ duration: 777, stagger: 55 }} />);
    expect(secondWord(container).style.getPropertyValue('--sd-duration')).toBe('777ms');
    expect(secondWord(container).style.getPropertyValue('--sd-delay')).toBe('55ms');
  });

  // Forty words at 40ms run 1560ms past now, well over Streamdown's default 320ms backlog cap.
  const BURST = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
  const lastDelay = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('[data-sd-animate]')].at(-1)?.style.getPropertyValue('--sd-delay');

  it("keeps narration's word gap through a burst, since the sentence pacer owns catch-up", () => {
    setRevealTiming({ duration: 200, stagger: 40 });
    const { container } = render(<MarkdownRenderer text={BURST} animate animation="reveal" />);
    expect(lastDelay(container)).toBe('1560ms');
  });

  it('keeps shown words still when the timing changes mid-stream', () => {
    const words = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-sd-animate]')];
    setRevealTiming({ duration: 200, stagger: 40 });
    const { container, rerender } = render(<MarkdownRenderer text="Hello brave world." animate animation="reveal" />);
    setRevealTiming({ duration: 300, stagger: 60 });
    rerender(<MarkdownRenderer text="Hello brave world. Then more" animate animation="reveal" />);
    expect(words(container).map((w) => w.style.getPropertyValue('--sd-duration'))).toEqual(['0ms', '0ms', '0ms', '300ms', '300ms']);
    const [then, more] = words(container).slice(3).map((w) => parseFloat(w.style.getPropertyValue('--sd-delay')));
    expect(more - then).toBe(60);
  });

  it('resumes a remounted reveal: text present at mount stays still, later text fades in', () => {
    const durations = (container: HTMLElement) =>
      [...container.querySelectorAll<HTMLElement>('[data-sd-animate]')].map((w) => w.style.getPropertyValue('--sd-duration'));
    setRevealTiming({ duration: 200, stagger: 40 });
    const first = 'One two.\n\nThree four.';
    const { container, rerender } = render(<MarkdownRenderer text={first} animate animation="reveal" resume />);
    expect(durations(container)).toEqual(['0ms', '0ms', '0ms', '0ms']);
    // Flipping the prop after mount changes nothing: only its mount value counts.
    rerender(<MarkdownRenderer text={`${first} Five\n\nSix`} animate animation="reveal" resume={false} />);
    expect(durations(container)).toEqual(['0ms', '0ms', '0ms', '0ms', '200ms', '200ms']);
  });

  it('fades in the text present at mount without resume', () => {
    setRevealTiming({ duration: 200, stagger: 40 });
    const { container } = render(<MarkdownRenderer text={'One two.\n\nThree four.'} animate animation="reveal" />);
    expect([...container.querySelectorAll<HTMLElement>('[data-sd-animate]')].every((w) => w.style.getPropertyValue('--sd-duration') === '200ms')).toBe(true);
  });

  it("shortens the word gap to a given timing's backlog cap", () => {
    const { container } = render(
      <MarkdownRenderer text={BURST} animate animation="reveal" timing={{ duration: 200, stagger: 40, maxBacklogMs: 640 }} />,
    );
    expect(lastDelay(container)).toBe('640ms');
  });
});
