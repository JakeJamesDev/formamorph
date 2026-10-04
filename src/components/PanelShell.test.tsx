import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PanelShell } from './PanelShell';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';

const openMorph = (): MorphFullscreen => ({
  mounted: true,
  contentInOverlay: true,
  boxClassName: '',
  phase: 'open',
  open: () => {},
  close: () => {},
  toggle: () => {},
  boxRef: () => {},
  veilClassName: '',
  overlayClassName: '',
});

const shell = (showTitle?: boolean) => render(
  <PanelShell morph={openMorph()} sourceRef={createRef<HTMLElement>()} title="Mascot" showTitle={showTitle}>body</PanelShell>,
);

describe('PanelShell title row', () => {
  it('shows the title as a visible caption by default', () => {
    shell();
    expect(screen.getByText('Mascot').closest('.sr-only')).toBeNull();
  });

  it('hides the row but keeps the window named when showTitle is false', () => {
    shell(false);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Mascot');
    expect(screen.getByText('Mascot').closest('.sr-only')).not.toBeNull();
  });
});
