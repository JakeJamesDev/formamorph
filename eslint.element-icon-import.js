import { srcPath } from './eslint.module-boundary.js';

/** Every icon `ELEMENT_ICONS` owns, by lucide name; `eslint.rules.test.ts` keeps this list equal to the map. */
export const MAPPED_ICONS = [
  'BookOpen',
  'Braces',
  'ChartColumn',
  'CircleUserRound',
  'Earth',
  'Folder',
  'LayoutTemplate',
  'MapPin',
  'Package',
  'PersonStanding',
  'Play',
  'Smile',
  'ToggleRight',
  'User',
  'Users',
];

/** Direct imports of a mapped icon that mean something else, by path under `src/`. A new element-type call site reads the map. */
const OTHER_MEANINGS = {
  'components/community/ProfileStats.tsx': { icons: ['Users'], meaning: 'follower count' },
  'components/community/RemoteWorldDetailsModal.tsx': { icons: ['Play'], meaning: 'use-preset action' },
  'components/editor/IssuesInstrument.tsx': { icons: ['Play'], meaning: 'run-check action' },
  'components/formaquestion/FormaquestionMascotTab.tsx': { icons: ['Play'], meaning: 'preview action' },
  'components/formaquestion/FormaquestionGuide.tsx': { icons: ['BookOpen'], meaning: 'Guide full-screen header' },
  'components/formaquestion/FormaquestionMenu.tsx': { icons: ['BookOpen'], meaning: 'Open Guide item' },
  'components/formaquestion/GuideBody.tsx': { icons: ['BookOpen'], meaning: 'Guide tab' },
  'components/formaquestion/MinimalChat.tsx': { icons: ['PersonStanding'], meaning: 'full-body view toggle' },
  'components/game/AudioPlayer.tsx': { icons: ['Play'], meaning: 'playback' },
  'components/game/TtsPlaybackBar.tsx': { icons: ['Play'], meaning: 'playback' },
  'components/menu/FeedbackMarkdown.tsx': { icons: ['User'], meaning: 'unknown player chip' },
  'components/menu/SentMessageList.tsx': { icons: ['Users'], meaning: 'message audience' },
  'components/modals/LoadGameDialog.tsx': { icons: ['Folder'], meaning: 'save folder' },
  'components/modals/ToolTryIt.tsx': { icons: ['Play'], meaning: 'run action' },
  'components/modals/toolsView.ts': { icons: ['Braces'], meaning: 'Parameters tab' },
  'components/prompt/CodeArea.tsx': { icons: ['Braces'], meaning: 'slot snippet menu' },
  'views/DesignSystemShowcase.tsx': { icons: ['BookOpen'], meaning: 'guide link' },
  'views/MainMenu.tsx': { icons: ['BookOpen', 'User'], meaning: 'View Prompts action, account button' },
};

/** Icons no surface may import, so no element type reads as another. */
const RETIRED_ICONS = ['SquareUser', 'Gauge', 'Activity'];

export const elementIconImportRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Read an element type icon from ELEMENT_ICONS, never directly from lucide-react.' },
    schema: [],
    messages: {
      mapped: '{{name}} is an element type icon. Read it from @/lib/elementIcons, or list its other meaning in OTHER_MEANINGS.',
      retired: '{{name}} is a retired element type icon.',
      stale: 'OTHER_MEANINGS lists {{name}} for this file, which no longer imports it.',
    },
  },
  create(context) {
    const path = srcPath(context.filename);
    const exempt = path === 'lib/elementIcons.ts' || path.startsWith('components/ui/');
    const listed = OTHER_MEANINGS[path]?.icons ?? [];
    const imported = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'lucide-react') return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          const name = specifier.imported.name;
          imported.add(name);
          if (RETIRED_ICONS.includes(name)) context.report({ node: specifier, messageId: 'retired', data: { name } });
          else if (!exempt && MAPPED_ICONS.includes(name) && !listed.includes(name)) {
            context.report({ node: specifier, messageId: 'mapped', data: { name } });
          }
        }
      },
      'Program:exit': (program) => {
        for (const name of listed) {
          if (!imported.has(name)) context.report({ node: program, messageId: 'stale', data: { name } });
        }
      },
    };
  },
};
