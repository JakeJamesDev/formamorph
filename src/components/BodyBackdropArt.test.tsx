import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BodyBackdropArt } from './BodyBackdropArt';

const art = (backdrop: Parameters<typeof BodyBackdropArt>[0]['backdrop']) => render(<BodyBackdropArt backdrop={backdrop} />).container.querySelector('img');

describe('BodyBackdropArt', () => {
  it('fades a Custom Image by its opacity', () => {
    expect(art({ kind: 'image', image: { data: 'data:a' }, opacity: 0.3 })).toHaveStyle({ opacity: '0.3' });
  });

  it('draws a Custom Image with no opacity at full strength', () => {
    expect(art({ kind: 'image', image: { data: 'data:a' } })).toHaveStyle({ opacity: '1' });
  });
});
