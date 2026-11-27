import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeArea } from './CodeArea';
import { HighlightedCode } from './HighlightedCode';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';

/**
 * Both chunks load on demand, so a dropped connection fails the import. The plain text stays, and the
 * failure is caught: an unhandled one fails this file.
 */

const FETCH_FAILED = 'Failed to fetch dynamically imported module';
vi.mock('@/components/prompt/codeSession', () => { throw new TypeError(FETCH_FAILED); });
vi.mock('@/lib/codeHighlight', () => { throw new TypeError(FETCH_FAILED); });

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => warn.mockClear());

// Vitest wraps a throwing mock factory, keeping the thrown error as the cause.
const failedLoads = () => warn.mock.calls.filter((args) => String((args[1] as Error | undefined)?.cause).includes(FETCH_FAILED));

describe('a code chunk that fails to load', () => {
  it('leaves the plain text field in place of the editor', async () => {
    render(<CodeArea value="return 1;" onChange={() => {}} ariaLabel="Stat code" surface={STAT_CODE_SURFACE} />);

    await vi.waitFor(() => expect(failedLoads()).toHaveLength(1));
    expect(screen.getByRole('textbox', { name: 'Stat code' })).toHaveValue('return 1;');
  });

  it('leaves highlighted code as plain text', async () => {
    render(<HighlightedCode code="return 1;" />);

    await vi.waitFor(() => expect(failedLoads()).toHaveLength(1));
    expect(screen.getByText('return 1;').tagName).toBe('PRE');
  });
});
