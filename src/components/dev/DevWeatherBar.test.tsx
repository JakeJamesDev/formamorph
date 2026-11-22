import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DevWeatherBar } from './DevWeatherBar';

const mount = (kind: Parameters<typeof DevWeatherBar>[0]['kind']) => {
  const onKind = vi.fn();
  render(<DevWeatherBar kind={kind} onKind={onKind} day onToggleDay={() => {}} backdrop={null} onNextBackdrop={() => {}} />);
  return onKind;
};

describe('the dev weather bar', () => {
  it('steps forward and wraps from Bright Sun to Clear', () => {
    const onKind = mount('brightSun');
    fireEvent.click(screen.getByRole('button', { name: 'Next weather' }));
    expect(onKind).toHaveBeenCalledWith('clear');
  });

  it('steps back and wraps from Clear to Bright Sun', () => {
    const onKind = mount('clear');
    fireEvent.click(screen.getByRole('button', { name: 'Previous weather' }));
    expect(onKind).toHaveBeenCalledWith('brightSun');
  });

  it('steps on arrow keys, but not while a text field has focus', () => {
    const onKind = mount('rain');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onKind).toHaveBeenLastCalledWith('snow');
    const input = document.body.appendChild(document.createElement('input'));
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onKind).toHaveBeenCalledTimes(1);
  });
});
