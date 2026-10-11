import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { StatGroup } from '@/types';
import StatGroupManager from './StatGroupManager';

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ placeholders: [] }),
  useGameDataOptional: () => ({ placeholders: [] }),
}));
// The chip fields are not under test; plain controls with the same label, value and change callback stand in.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  PlaceholderNameField: ({ ariaLabel, value, onChange }: { ariaLabel?: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const group: StatGroup = { id: 'g1', name: 'Body', parentId: null, order: 0, aiDescription: 'What the body can take.' };

describe('StatGroupManager', () => {
  it('shows the group\'s name and AI-facing description', () => {
    render(<StatGroupManager group={group} write={() => {}} />);
    expect(screen.getByLabelText('Group Name')).toHaveValue('Body');
    expect(screen.getByLabelText('AI-Facing Description')).toHaveValue('What the body can take.');
  });

  it('writes the whole group with the renamed name, keeping every other field', () => {
    const write = vi.fn();
    render(<StatGroupManager group={group} write={write} />);
    fireEvent.change(screen.getByLabelText('Group Name'), { target: { value: 'Mind' } });
    expect(write).toHaveBeenLastCalledWith({ ...group, name: 'Mind' });
  });

  it('writes the description the author types', () => {
    const write = vi.fn();
    render(<StatGroupManager group={group} write={write} />);
    fireEvent.change(screen.getByLabelText('AI-Facing Description'), { target: { value: 'Hurt and tired.' } });
    expect(write).toHaveBeenLastCalledWith({ ...group, aiDescription: 'Hurt and tired.' });
  });

  it('shows the heading to the AI by default, and writes only the off state', () => {
    const write = vi.fn();
    render(<StatGroupManager group={group} write={write} />);
    const toggle = screen.getByRole('checkbox', { name: 'Show Heading to AI' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(write).toHaveBeenLastCalledWith({ ...group, aiVisible: false });
    fireEvent.click(toggle);
    expect(write).toHaveBeenLastCalledWith({ ...group, aiVisible: undefined });
  });

  it('offers no pick counts, modes or gates, which stat groups do not have', () => {
    render(<StatGroupManager group={group} write={() => {}} />);
    expect(screen.queryByText(/Pick Count/)).toBeNull();
    expect(screen.queryByText(/Requires|Gate|Mode/)).toBeNull();
  });
});
