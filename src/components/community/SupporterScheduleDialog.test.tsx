import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupporterScheduleDialog } from './SupporterScheduleDialog';
import { resetTierNamesForTest, seedTierNamesForTest } from '@/lib/tierNames';
import { toInputValue, type SupporterDatesSchedule } from '@/lib/supporterScheduleEdit';
import type { WorldRecord } from '@/components/WorldDetails';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 18, 12, 30, 15, 250);
const iso = (days: number) => new Date(NOW + days * DAY).toISOString();

const staged = {
  _id: 'w1', name: 'Sedge Landing', supporter_only: true, supporter_until: iso(15),
  supporterSchedule: [{ tier: 'supporter_plus', opensAt: iso(5) }, { tier: 'supporter', opensAt: iso(10) }],
} as unknown as WorldRecord;

type Save = (world: WorldRecord, schedule: SupporterDatesSchedule) => Promise<string | null>;
const input = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

beforeEach(() => { seedTierNamesForTest({ supporter_top: 'Beacon', supporter_plus: 'Flame', supporter: 'Spark' }); });
afterEach(() => { cleanup(); resetTierNamesForTest(); });

describe('the schedule dialog', () => {
  it('loads the current schedule', () => {
    render(<SupporterScheduleDialog world={staged} busy={false} onClose={() => {}} onSave={async () => null} />);

    expect(input('Flame Opens').value).toBe(toInputValue(iso(5)));
    expect(input('Spark Opens').value).toBe(toInputValue(iso(10)));
    expect(input('Everyone Opens').value).toBe(toInputValue(iso(15)));
  });

  it('saves an untouched stage as its stored instant and a moved one as the new instant', async () => {
    const onSave = vi.fn<Save>(async () => null);
    render(<SupporterScheduleDialog world={staged} busy={false} onClose={() => {}} onSave={onSave} />);

    fireEvent.change(input('Everyone Opens'), { target: { value: '2027-01-02T08:15' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(staged, {
      opensAt: { supporter_plus: iso(5), supporter: iso(10) },
      publicAt: new Date('2027-01-02T08:15').toISOString(),
    });
  });

  it('moves a passed stage back into the future', async () => {
    const passed = { ...staged, supporterSchedule: [{ tier: 'supporter_plus', opensAt: iso(-3) }, { tier: 'supporter', opensAt: iso(10) }] } as unknown as WorldRecord;
    const onSave = vi.fn<Save>(async () => null);
    render(<SupporterScheduleDialog world={passed} busy={false} onClose={() => {}} onSave={onSave} />);

    fireEvent.change(input('Flame Opens'), { target: { value: '2026-12-25T10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][1].opensAt.supporter_plus).toBe(new Date('2026-12-25T10:00').toISOString());
  });

  it('clears the public date and a tier by emptying the field', async () => {
    const onSave = vi.fn<Save>(async () => null);
    render(<SupporterScheduleDialog world={staged} busy={false} onClose={() => {}} onSave={onSave} />);

    fireEvent.change(input('Everyone Opens'), { target: { value: '' } });
    fireEvent.change(input('Spark Opens'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(staged, { opensAt: { supporter_plus: iso(5), supporter: null }, publicAt: null });
  });

  it('says a blank tier opens with the public date, and never opens without one', () => {
    const withPublic = {
      _id: 'w2', supporter_only: true, supporter_until: iso(15),
      supporterSchedule: [{ tier: 'supporter_plus', opensAt: null }, { tier: 'supporter', opensAt: null }],
    } as unknown as WorldRecord;
    render(<SupporterScheduleDialog world={withPublic} busy={false} onClose={() => {}} onSave={async () => null} />);

    expect(screen.getAllByText('Opens with the public date').length).toBe(2);
    fireEvent.change(input('Everyone Opens'), { target: { value: '' } });
    expect(screen.getAllByText('Never opens').length).toBe(2);
  });

  it('shows the server\'s refusal and stays open', async () => {
    const onSave = vi.fn<Save>(async () => 'A lower tier cannot open before a higher one');
    render(<SupporterScheduleDialog world={staged} busy={false} onClose={() => {}} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe('A lower tier cannot open before a higher one');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
