import { act } from '@testing-library/react';

/**
 * Waits on the real clock inside `act`. Motion's frame loop stalls once a fake clock has driven it,
 * so Motion tests keep to real timers and wait with this.
 */
export const waitReal = (ms: number) => act(() => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
