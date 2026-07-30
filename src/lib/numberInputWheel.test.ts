import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { attachNumberWheelStep, setValueLikeUser, steppedValue } from './numberInputWheel';

function makeInput(attrs: Partial<Record<'value' | 'step' | 'min' | 'max', string>> = {}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = attrs.value ?? '50';
  if (attrs.step !== undefined) input.step = attrs.step;
  if (attrs.min !== undefined) input.min = attrs.min;
  if (attrs.max !== undefined) input.max = attrs.max;
  return input;
}

describe('steppedValue', () => {
  it('increases on wheel up and decreases on wheel down', () => {
    const input = makeInput();
    expect(steppedValue(input, -120)).toBe(51);
    expect(steppedValue(input, 120)).toBe(49);
  });

  it('honors the field\'s own step', () => {
    expect(steppedValue(makeInput({ step: '5' }), -120)).toBe(55);
    expect(steppedValue(makeInput({ step: '0.5' }), -120)).toBe(50.5);
  });

  it('keeps decimal steps clean instead of drifting', () => {
    const input = makeInput({ value: '0.3', step: '0.1' });
    expect(steppedValue(input, -120)).toBe(0.4); // 0.30000000000000004 without the fix
  });

  it('clamps to min and max', () => {
    expect(steppedValue(makeInput({ value: '0', min: '0' }), 120)).toBe(0);
    expect(steppedValue(makeInput({ value: '100', max: '100' }), -120)).toBe(100);
  });

  it('treats a non-numeric step or empty value as 1 and 0', () => {
    expect(steppedValue(makeInput({ value: '', step: 'any' }), -120)).toBe(1);
  });

  it('never returns a value past a bound finer-grained than the step', () => {
    // Rounding after clamping pushed the clamped 0.05 back up to 0.1, over the max.
    expect(steppedValue(makeInput({ value: '0', step: '0.1', max: '0.05' }), -120)).toBeLessThanOrEqual(0.05);
    expect(steppedValue(makeInput({ value: '0', step: '0.1', min: '-0.05' }), 120)).toBeGreaterThanOrEqual(-0.05);
  });
});

describe('setValueLikeUser', () => {
  it('writes the value and fires a bubbling input event', () => {
    const input = makeInput();
    document.body.appendChild(input);
    let seen: string | null = null;
    document.body.addEventListener('input', (e) => { seen = (e.target as HTMLInputElement).value; });

    setValueLikeUser(input, '73');

    expect(input.value).toBe('73');
    expect(seen).toBe('73');
    document.body.innerHTML = '';
  });
});

describe('attachNumberWheelStep', () => {
  let input: HTMLInputElement;
  let detach: () => void;
  let changes: string[];

  beforeEach(() => {
    input = makeInput({ value: '50' });
    document.body.appendChild(input);
    changes = [];
    input.addEventListener('input', () => changes.push(input.value));
    detach = attachNumberWheelStep(input);
  });

  afterEach(() => {
    detach();
    document.body.innerHTML = '';
  });

  const wheel = (deltaY: number) => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    return event;
  };

  it('steps both ways regardless of any scroll position — the reported bug', () => {
    input.focus();
    expect(wheel(-120).defaultPrevented).toBe(true);
    expect(input.value).toBe('51');
    expect(wheel(120).defaultPrevented).toBe(true);
    expect(input.value).toBe('50');
    expect(changes).toEqual(['51', '50']);
  });

  it('ignores the wheel when the input is not focused, so scrolling past it is safe', () => {
    expect(document.activeElement).not.toBe(input);
    expect(wheel(-120).defaultPrevented).toBe(false);
    expect(input.value).toBe('50');
    expect(changes).toEqual([]);
  });

  it('leaves disabled and readonly fields alone', () => {
    input.focus();
    input.disabled = true;
    expect(wheel(-120).defaultPrevented).toBe(false);
    input.disabled = false;
    input.readOnly = true;
    input.focus();
    expect(wheel(-120).defaultPrevented).toBe(false);
    expect(input.value).toBe('50');
  });

  it('ignores a horizontal-only wheel', () => {
    input.focus();
    expect(wheel(0).defaultPrevented).toBe(false);
    expect(input.value).toBe('50');
  });

  it('stops stepping once detached', () => {
    input.focus();
    detach();
    expect(wheel(-120).defaultPrevented).toBe(false);
    expect(input.value).toBe('50');
  });
});
