import { createContext, useContext } from 'react';
import type { OpeningPickHandle } from '@/lib/testBench/useOpeningPick';

const OpeningPickContext = createContext<OpeningPickHandle | null>(null);

/** The World Editor's Opening pick, shared by every Test Code box and the Test Bench. */
export const OpeningPickProvider = OpeningPickContext.Provider;

/** The editor's Opening pick, or null outside the World Editor, where runs read None. */
export const useOpeningPickContext = (): OpeningPickHandle | null => useContext(OpeningPickContext);
