import type { CodeSurface } from '@/lib/codeSurface';

/** A surface shaped like a Tool script's: its own globals, one typed object, no stat-code names at all. */
export const SCRIPT_SURFACE: CodeSurface = {
  label: 'this script',
  globals: [
    { name: 'args', detail: '{ name }', info: 'The arguments the model sent.' },
    { name: 'world', detail: 'object', info: 'The world, read-only.' },
  ],
  hiddenGlobals: [],
  builtins: [{ name: 'Math', detail: 'object', info: 'min, max and the rest.' }],
  members: new Map([
    ['args', [{ name: 'name', detail: 'string', info: 'The name the model asked for.' }]],
    ['Math', [{ name: 'max', detail: '(...n) => number', info: 'The largest.' }]],
  ]),
  languageNames: ['JSON'],
  snippets: [{ label: 'An argument', text: 'args.name', select: 'name' }],
  missingReturn: 'This script never returns a result.',
};
