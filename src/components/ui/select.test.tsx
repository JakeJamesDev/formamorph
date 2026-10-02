import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const ITEMS = Array.from({ length: 40 }, (_, i) => `Item ${i + 1}`);

const renderSelect = () =>
  render(
    <Select defaultValue="Item 1">
      <SelectTrigger aria-label="Pick">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>,
  );

describe('Select scrolling', () => {
  it('renders no overlay scroll buttons', async () => {
    const user = userEvent.setup();
    renderSelect();
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('listbox')).toBeTruthy();
    expect(document.querySelector('[data-radix-select-scroll-up-button]')).toBeNull();
    expect(document.querySelector('[data-radix-select-scroll-down-button]')).toBeNull();
  });

  it('keeps the native scrollbar on the viewport', async () => {
    const user = userEvent.setup();
    renderSelect();
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    const viewport = document.querySelector('[data-radix-select-viewport]') as HTMLElement;
    // Radix injects scrollbar-width:none; these classes override it.
    expect(viewport.className).toContain('![scrollbar-width:thin]');
    expect(viewport.className).toContain('[&::-webkit-scrollbar]:!block');
  });

  it('reaches the last item by keyboard', async () => {
    const user = userEvent.setup();
    renderSelect();
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    await user.keyboard('{End}');
    const last = screen.getByRole('option', { name: 'Item 40' });
    expect(last.hasAttribute('data-highlighted')).toBe(true);
  });
});
