import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptReasoningField } from './PromptOptionFields';
import { REASONING_NOTES } from './settingsCopy';

function field(globalOff: boolean) {
  return render(
    <PromptReasoningField
      setting={{ enabled: true, level: 'high' }}
      onChange={vi.fn()}
      options={[{ value: 'global', label: 'Global' }, { value: 'high', label: 'High' }]}
      budget={null}
      room={null}
      level
      globalOff={globalOff}
    />,
  );
}

describe('a prompt reasoning field under the endpoint-wide switch', () => {
  it('locks the switch and says why while the endpoint-wide switch is off, still showing the prompt as on', () => {
    field(true);
    const toggle = screen.getByRole('checkbox');
    expect(toggle).toBeDisabled();
    expect(toggle).toBeChecked();
    expect(screen.getByText(REASONING_NOTES.globalOff)).toBeInTheDocument();
  });

  it('leaves the switch usable and the note out while the endpoint-wide switch is on', () => {
    field(false);
    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(screen.queryByText(REASONING_NOTES.globalOff)).toBeNull();
  });
});
