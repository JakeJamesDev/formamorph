import '@testing-library/jest-dom/vitest'; // augments Vitest's expect with DOM matchers
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount anything React Testing Library rendered between tests.
afterEach(() => cleanup());
