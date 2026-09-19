import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ImportPresetDialog } from './PresetShareDialogs';
import { buildSharedPreset, serializeSharedCode } from '@/lib/promptPresetShare';
import type { PresetOverview, PromptValues } from '@/lib/promptPresets';

const APP = '2.1.0';
const values = { systemPrompt: 'X' } as unknown as PromptValues;

function openWith(overview?: PresetOverview) {
  render(<ImportPresetDialog open onOpenChange={() => {}} currentAppVersion={APP} existingUserNames={[]} onImport={() => {}} />);
  const code = serializeSharedCode(buildSharedPreset({ name: 'Gift', style: 'markdown', values, overview }, APP));
  fireEvent.change(screen.getByPlaceholderText('FMPRESET1:…'), { target: { value: code } });
}

describe('ImportPresetDialog: Overview preview', () => {
  it('shows author, rendered description, tags, and models before import', () => {
    openWith({ author: 'Ann Author', description: 'Tuned for **small** models.', tags: ['dialogue'], models: ['Cydonia-24B'] });
    const w = within(screen.getByLabelText('Overview'));
    expect(w.getByText('Ann Author')).toBeTruthy();
    expect(w.getByText('small').getAttribute('data-streamdown')).toBe('strong');
    expect(w.queryByText(/\*\*/)).toBeNull();
    expect(w.getByText('dialogue')).toBeTruthy();
    expect(w.getByText('Cydonia-24B')).toBeTruthy();
    expect(screen.getByDisplayValue('Gift')).toBeTruthy();
  });

  it('shows only the fields that have content', () => {
    openWith({ author: '', description: '', tags: [], models: ['Nemo'] });
    const labels = screen.getAllByRole('term').map((t) => t.textContent);
    expect(labels).toEqual(['Models']);
  });

  it('shows no Overview for a payload without one', () => {
    openWith();
    expect(screen.queryAllByRole('term')).toHaveLength(0);
    expect(screen.getByDisplayValue('Gift')).toBeTruthy();
  });
});
