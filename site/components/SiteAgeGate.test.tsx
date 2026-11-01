import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAccountPage } from '../test/support';
import { SiteAgeGate } from './SiteAgeGate';

beforeEach(() => { resetAccountPage('/community'); });
afterEach(cleanup);

describe('the site age gate', () => {
  it('says what Decline does on the site, where it never signs the reader out', () => {
    render(<SiteAgeGate><p>Page body</p></SiteAgeGate>);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent("If you decline, you'll go back to the home page and be asked again next time.");
    expect(dialog).not.toHaveTextContent('signed out');
  });
});
