import { Linter, RuleTester } from 'eslint';
import * as lucide from 'lucide-react';
import tseslint from 'typescript-eslint';
import { afterAll, describe, expect, it } from 'vitest';
import config from './eslint.config.js';
import { MAPPED_ICONS, elementIconImportRule } from './eslint.element-icon-import.js';
import { fieldCaptionPropRule } from './eslint.field-caption-prop.js';
import { moduleBoundaryRule } from './eslint.module-boundary.js';
import { noNativeScrollerRule } from './eslint.no-native-scroller.js';
import { noRawEntityListRule } from './eslint.no-raw-entity-list.js';
import { noRawEntityPlacesRule } from './eslint.no-raw-entity-places.js';
import { sourceContractRule } from './eslint.source-contract.js';
import { ELEMENT_ICONS } from '@/lib/elementIcons';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

const errors = (messageId: string, count = 1) => Array.from({ length: count }, () => ({ messageId }));

tester.run('no-native-scroller', noNativeScrollerRule, {
  valid: [
    `<div className="overflow-hidden" />`,
    `<div className="overflow-visible" />`,
    `<td className="[overflow-wrap:break-word]" />`,
    `<div style={{ overflow: 'hidden' }} />`,
    `<ScrollArea className="h-40" />`,
    `<div className="overflow-auto" />\n// scroll-guard: allow horizontal: the code block scrolls sideways`,
    `<div className="overflow-auto" />\n  // scroll-guard: allow popover-list: wheel lock inside a dialog`,
    `// overflow-auto names the class.\nconst a = 1;`,
  ],
  invalid: [
    { code: `<pre className="overflow-auto" />`, errors: errors('nativeScroller') },
    { code: `<div className="overflow-x-auto" />`, errors: errors('nativeScroller') },
    { code: `<div className="overflow-y-scroll" />`, errors: errors('nativeScroller') },
    { code: `<div className="md:overflow-y-auto" />`, errors: errors('nativeScroller') },
    { code: '<div className={`h-4 overflow-auto ${x}`} />', errors: errors('nativeScroller') },
    { code: `<div style={{ overflowY: 'auto' }} />`, errors: errors('nativeScroller') },
    { code: `<div style={{ overflowX: "scroll" }} />`, errors: errors('nativeScroller') },
    { code: `const s = { overflow: "scroll" };`, errors: errors('nativeScroller') },
    { code: `<a className="overflow-auto" />;\n<b className="overflow-y-auto" />`, errors: errors('nativeScroller', 2) },
    {
      name: 'importing ScrollArea exempts nothing',
      code: `import { ScrollArea } from '@/components/ui/scroll-area';\n<div className="overflow-auto" />`,
      errors: errors('nativeScroller'),
    },
    {
      name: 'an unknown exception name',
      code: `<div className="overflow-auto" />\n// scroll-guard: allow because: it is easier`,
      errors: errors('nativeScroller'),
    },
    {
      name: 'an allow comment that shares a line with code',
      code: `<div className="overflow-auto" />; // scroll-guard: allow horizontal: scrolls sideways`,
      errors: errors('nativeScroller'),
    },
    {
      name: 'an allow comment with no reason',
      code: `<div className="overflow-auto" />\n// scroll-guard: allow horizontal`,
      errors: errors('nativeScroller'),
    },
  ],
});

tester.run('element-icon-import', elementIconImportRule, {
  valid: [
    { code: `import { Search } from 'lucide-react';`, filename: 'src/views/A.tsx' },
    { code: `import { Users as Friends } from 'somewhere-else';`, filename: 'src/views/A.tsx' },
    { code: `import { Users } from 'lucide-react';`, filename: 'src/lib/elementIcons.ts' },
    { code: `import { Users } from 'lucide-react';`, filename: 'src/components/ui/thing.tsx' },
    { code: `import { Users } from 'lucide-react';`, filename: 'src/components/community/ProfileStats.tsx' },
  ],
  invalid: [
    { code: `import { Users } from 'lucide-react';`, filename: 'src/views/A.tsx', errors: errors('mapped') },
    { code: `import { Users as Friends } from 'lucide-react';`, filename: 'src/views/A.tsx', errors: errors('mapped') },
    { code: `import { type Users } from 'lucide-react';`, filename: 'src/views/A.tsx', errors: errors('mapped') },
    {
      name: 'a ledger entry covers only the icons it names',
      code: `import { Users, Play } from 'lucide-react';`,
      filename: 'src/components/community/ProfileStats.tsx',
      errors: errors('mapped'),
    },
    { code: `import { Gauge } from 'lucide-react';`, filename: 'src/views/A.tsx', errors: errors('retired') },
    { code: `import { Activity } from 'lucide-react';`, filename: 'src/components/ui/thing.tsx', errors: errors('retired') },
    { code: `const a = 1;`, filename: 'src/components/community/ProfileStats.tsx', errors: errors('stale') },
  ],
});

const BOUNDARIES = [
  { module: 'statCodeExecutor', names: ['executeStatCode'], except: ['lib/sandboxSnapshot.ts'], reason: 'r' },
  { module: 'bundledDocsIndex', dynamicOnly: ['lib/docs/loadDocsIndex.ts'], reason: 'r' },
];

tester.run('module-boundary', moduleBoundaryRule, {
  valid: [
    { code: `import { clampToOwnRange, CODE_BOUND_FIELDS } from '@/lib/statCodeExecutor';`, options: BOUNDARIES },
    { code: `import { executeStatCode } from './otherExecutor';`, options: BOUNDARIES },
    { code: `import { executeStatCode } from './statCodeExecutor';`, options: BOUNDARIES, filename: 'src/lib/sandboxSnapshot.ts' },
    { code: `const { clampToOwnRange } = await import('./statCodeExecutor');`, options: BOUNDARIES },
    { code: `export { clampToOwnRange } from './statCodeExecutor';`, options: BOUNDARIES },
    { code: `const load = () => import('./bundledDocsIndex');`, options: BOUNDARIES, filename: 'src/lib/docs/loadDocsIndex.ts' },
  ],
  invalid: [
    { code: `import { executeStatCode } from '@/lib/statCodeExecutor';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `import {\n  clampToOwnRange, executeStatCode,\n} from './statCodeExecutor';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `import { executeStatCode as run } from './statCodeExecutor';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `import type { executeStatCode } from './statCodeExecutor';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `const { executeStatCode } = await import('@/lib/statCodeExecutor');`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `const sandbox = await import('./statCodeExecutor');`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `const { clampToOwnRange, ...rest } = await import('./statCodeExecutor');`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `import('./statCodeExecutor').then((m) => m.executeStatCode);`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `import * as sandbox from './statCodeExecutor';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `export { executeStatCode } from './statCodeExecutor';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `export * from './statCodeExecutor';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `import { bundledDocsIndex } from './bundledDocsIndex';`, options: BOUNDARIES, errors: errors('boundary') },
    { code: `const load = () => import('@/lib/docs/bundledDocsIndex');`, options: BOUNDARIES, errors: errors('boundary') },
    {
      name: 'the loader keeps to the dynamic form',
      code: `import { bundledDocsIndex } from './bundledDocsIndex';`,
      options: BOUNDARIES,
      filename: 'src/lib/docs/loadDocsIndex.ts',
      errors: [{ messageId: 'boundary' }, { messageId: 'noLoad' }],
    },
    { name: 'the loader stops loading it', code: `export const a = 1;`, options: BOUNDARIES, filename: 'src/lib/docs/loadDocsIndex.ts', errors: errors('noLoad') },
  ],
});

const CONTRACT = [{ renders: ['Shell'], requires: ['useMorph'], forbids: ['hand'], reason: 'r' }];

tester.run('source-contract', sourceContractRule, {
  valid: [
    { code: `useMorph(); <Shell />;`, options: CONTRACT },
    { code: `useMorph(); <Shell hideClose />;`, options: CONTRACT },
  ],
  invalid: [
    { code: `useMorph();`, options: CONTRACT, errors: errors('missing') },
    { name: 'an import alone is not a render', code: `import { Shell } from './s'; useMorph(); Shell;`, options: CONTRACT, errors: errors('missing') },
    { code: `<Shell />;`, options: CONTRACT, errors: errors('missing') },
    { code: `useMorph(); <Shell className={hand} />;`, options: CONTRACT, errors: errors('forbidden') },
    { code: `useMorph(); <Shell />; <hand />;`, options: CONTRACT, errors: errors('forbidden') },
  ],
});

tester.run('no-raw-entity-list', noRawEntityListRule, {
  valid: [
    `const { entities } = useResolvedWorld();`,
    `const { stats } = useGameData();`,
    `const game = useGameData(); game.stats;`,
    `const other = pick(); other.entities;`,
    `const { entities: authoredEntities } = useResolvedWorld();`,
  ],
  invalid: [
    { code: `const { entities } = useGameData();`, errors: errors('rawEntities') },
    { code: `const { stats, entities: raw } = useGameData();`, errors: errors('rawEntities') },
    { code: `useGameData().entities;`, errors: errors('rawEntities') },
    { code: `gameData.entities;`, errors: errors('rawEntities') },
    { code: `props.gameData.entities;`, errors: errors('rawEntities') },
    { name: 'a read above its handle', code: `const f = () => game.entities; const game = useGameData();`, errors: errors('rawEntities') },
    { code: `const game = useGameData(); game.entities;`, errors: errors('rawEntities') },
    { code: `useResolvedAuthoredWorld();`, errors: errors('rawEntities') },
  ],
});

// Type-aware: each case stands in for a real file outside the module, so the project resolves `@/types`.
const typedTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
});
const OUTSIDE = 'src/lib/entityPresence.ts';
const typed = (code: string) => `import type { Entity, World } from '@/types';\n${code}`;

typedTester.run('no-raw-entity-places', noRawEntityPlacesRule, {
  valid: [
    { name: "a world's location list", filename: OUTSIDE, code: typed(`export const ids = (world: World) => world.locations.map((l) => l.id);`) },
    { name: "a world's list destructured", filename: OUTSIDE, code: typed(`export const ids = ({ locations }: World) => locations.length;`) },
    { name: 'another type with the same field', filename: OUTSIDE, code: typed(`export const n = (graph: { locations: string[] }) => graph.locations.length;`) },
    { name: 'a literal of another type', filename: OUTSIDE, code: typed(`export const graph: { locations: string[] } = { locations: [] };`) },
  ],
  invalid: [
    { name: 'a read', filename: OUTSIDE, code: typed(`export const at = (entity: Entity) => entity.locations ?? [];`), errors: errors('rawPlaces') },
    { name: 'a read through a Pick', filename: OUTSIDE, code: typed(`export const at = (entity: Pick<Entity, 'locations'>) => entity.locations;`), errors: errors('rawPlaces') },
    { name: 'a read of a found entity', filename: OUTSIDE, code: typed(`export const at = (world: World) => world.entities.find(Boolean)?.locations;`), errors: errors('rawPlaces') },
    { name: 'a read by a string key', filename: OUTSIDE, code: typed(`export const at = (entity: Entity) => entity['locations'];`), errors: errors('rawPlaces') },
    { name: 'a destructure', filename: OUTSIDE, code: typed(`export const at = ({ locations }: Entity) => locations;`), errors: errors('rawPlaces') },
    { name: 'a write', filename: OUTSIDE, code: typed(`export const put = (entity: Entity) => { entity.locations = []; };`), errors: errors('rawPlaces') },
    { name: 'a literal', filename: OUTSIDE, code: typed(`export const one: Entity = { id: 'a', name: 'A', locations: ['x'] };`), errors: errors('rawPlaces') },
  ],
});

tester.run('field-caption-prop', fieldCaptionPropRule, {
  valid: [
    `<div><PromptField label="Name" /></div>`,
    `<div><Label>Name</Label><Input /></div>`,
    `<div><Label>Name</Label></div>`,
    `<Label>Name</Label>`,
    `<div><Label>Name</Label><Input /><PromptField /></div>`,
  ],
  invalid: [
    { code: `<div><Label>Name</Label><PromptField /></div>`, errors: errors('siblingLabel') },
    { code: `<div>\n  <Label htmlFor="a">Name</Label>\n  <PlaceholderField />\n</div>`, errors: errors('siblingLabel') },
  ],
});

// The one type-aware rule costs a project load per file, so only its own rows run it.
const TYPED_RULE = 'formamorph/no-raw-entity-places';
const UNTYPED: Linter.Config = { languageOptions: { parserOptions: { projectService: false } }, rules: { [TYPED_RULE]: 'off' } };
const configFor = (typed: boolean) => (typed ? config : [...config, UNTYPED]) as Linter.Config[];

/** The rule ids the repo's own config reports for `code` at `filename`; `typed` runs the type-aware rule too. */
const lint = (code: string, filename: string, typed = false) =>
  new Linter({ configType: 'flat' })
    .verify(code, configFor(typed), { filename })
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId);

describe('the lint config reports each scanned problem where the scan looked', () => {
  // Each row holds one reinstated bug, a file its scan read, and a file just outside the scan.
  it.each([
    ['native scroller', `export const A = 'overflow-y-auto';\n`, 'src/lib/a.ts', 'site/a.ts', 'formamorph/no-native-scroller'],
    ['element icon', `import { Users } from 'lucide-react';\nexport { Users };\n`, 'src/views/A.tsx', 'src/views/A.test.tsx', 'formamorph/element-icon-import'],
    ['executor import', `export { executeStatCode } from './statCodeExecutor';\n`, 'src/lib/a.ts', 'src/lib/sandboxSnapshot.ts', 'formamorph/module-boundary'],
    ['docs index import', `export { bundledDocsIndex } from './bundledDocsIndex';\n`, 'src/lib/docs/a.ts', 'src/lib/docs/a.test.ts', 'formamorph/module-boundary'],
    ['raw entity list', `export const a = gameData.entities;\n`, 'src/components/game/deep/a.ts', 'src/managers/a.ts', 'formamorph/no-raw-entity-list'],
    ['raw entity list in the view', `export const a = gameData.entities;\n`, 'src/views/GameViewer.tsx', 'src/views/WorldEditor.tsx', 'formamorph/no-raw-entity-list'],
    ['raw entity places', `import type { Entity } from '@/types';\nexport const a = (e: Entity) => e.locations;\n`, 'src/lib/entityPresence.ts', 'src/lib/entityPlaces.ts', 'formamorph/no-raw-entity-places'],
    ['raw entity places in a test', `import type { Entity } from '@/types';\nexport const a = (e: Entity) => e.locations;\n`, 'src/lib/entityPresence.ts', 'src/lib/entityPresence.test.ts', 'formamorph/no-raw-entity-places'],
    ['sibling caption', `export const A = () => <div><Label>A</Label><PromptField /></div>;\n`, 'src/managers/A.tsx', 'src/managers/deep/A.tsx', 'formamorph/field-caption-prop'],
    ['help session value import', `import { helpSettingsOf } from './helpSettings';\nexport { helpSettingsOf };\n`, 'src/lib/formaquestion/helpSession.ts', 'src/lib/formaquestion/other.ts', '@typescript-eslint/no-restricted-imports'],
    ['help session value import by alias', `import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';\nexport { helpSettingsOf };\n`, 'src/lib/formaquestion/helpSession.ts', 'src/lib/formaquestion/other.ts', '@typescript-eslint/no-restricted-imports'],
    ['help session constant', `export const HELP_MAX_TOKENS = 1;\n`, 'src/lib/formaquestion/helpSession.ts', 'src/lib/formaquestion/other.ts', 'formamorph/source-contract'],
  ])('%s', (_name, code, inside, outside, rule) => {
    expect(lint(code, inside, rule === TYPED_RULE)).toContain(rule);
    expect(lint(code, outside, rule === TYPED_RULE)).not.toContain(rule);
  });

  it.each([
    'src/components/prompt/CodeArea.tsx',
    'src/components/prompt/PromptField.tsx',
    'src/components/PanelShell.tsx',
    'src/components/modals/SettingsModal.tsx',
    'src/components/formaquestion/FormaquestionPromptsTab.tsx',
    'src/components/formaquestion/FormaquestionMascotTab.tsx',
    'src/components/modals/EditTextModal.tsx',
  ])('%s fails with its full-screen window gone', (file) => {
    expect(lint('export const A = 1;\n', file)).toContain('formamorph/source-contract');
  });

  it.each(['MyFeedbackSection', 'MyFeedbackTab', 'FeedbackList', 'FeedbackThreadView', 'FeedbackDialog', 'FeedbackEditDialog'])('%s imports no toast library', (name) => {
    for (const module of ['react-toastify', '@/lib/linkToast', '@/lib/feedbackToast']) {
      const code = `import { toast } from '${module}';\nexport { toast };\n`;
      expect(lint(code, `src/components/menu/${name}.tsx`)).toContain('no-restricted-imports');
      expect(lint(code, 'src/components/menu/Other.tsx')).not.toContain('no-restricted-imports');
    }
  });

  it.each([
    ['src/components/prompt/CodeArea.tsx', 'dialogFullHeight'],
    ['src/components/prompt/PromptField.tsx', 'dialogFullHeight'],
    ['src/components/PanelShell.tsx', 'dialogFullHeight'],
    ['src/components/modals/SettingsModal.tsx', 'dialogFullHeight'],
    ['src/components/modals/SettingsModal.tsx', 'FullscreenShell'],
    ['src/components/formaquestion/FormaquestionPromptsTab.tsx', 'FullscreenShell'],
    ['src/components/formaquestion/FormaquestionMascotTab.tsx', 'FullscreenShell'],
  ])('%s may not name %s', (file, name) => {
    const messages = new Linter({ configType: 'flat' }).verify(`export const a = ${name};\n`, configFor(false), { filename: file });
    expect(messages.some((message) => message.ruleId === 'formamorph/source-contract' && message.message.includes(`must not use ${name}`))).toBe(true);
  });

  it('accepts the help session taking its settings as a type alone', () => {
    expect(lint(`import type { HelpSettings } from './helpSettings';\nexport type A = HelpSettings;\n`, 'src/lib/formaquestion/helpSession.ts')).toEqual([]);
  });
});

describe('the element icon lists', () => {
  it('name every icon the map owns', () => {
    expect(new Set(MAPPED_ICONS.map((name) => lucide[name as keyof typeof lucide]))).toEqual(new Set(Object.values(ELEMENT_ICONS)));
    expect(MAPPED_ICONS).toHaveLength(Object.keys(ELEMENT_ICONS).length);
  });
});
