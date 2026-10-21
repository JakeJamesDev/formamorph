import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeCardNavigationContext, type CodeCardNavigation } from '@/lib/codeCardNavigation';
import { StatCodeTemplateDialog } from '@/components/modals/StatCodeTemplateDialog';
import { ToolEditor } from '@/components/modals/ToolEditor';
import EntityEditorModal from '@/components/modals/EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { sampleToolSnapshot } from '@/lib/tools/sampleToolSnapshot';
import type { Entity, Stat, Tool } from '@/types';

/** The hosts that hide Open and Find All Uses: each sits under the World Editor's navigation, and its code box
 *  must not take it. */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), getEntityMetadata: vi.fn().mockResolvedValue([]), storeEntity: vi.fn().mockResolvedValue(undefined) },
}));

// A plain field stands in for CodeMirror and records the navigation each box was handed.
const navigations = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string; navigation?: CodeCardNavigation }) => {
    navigations.set(props.ariaLabel, props.navigation);
    return <textarea aria-label={props.ariaLabel} value={props.value} readOnly />;
  },
}));

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const worldNavigation: CodeCardNavigation = { open: vi.fn(), goToUse: vi.fn() };
const underWorldEditor = (tree: ReactNode) => render(
  <SettingsProvider>
    <TooltipProvider>
      <CodeCardNavigationContext.Provider value={worldNavigation}>{tree}</CodeCardNavigationContext.Provider>
    </TooltipProvider>
  </SettingsProvider>,
);

const stat = (id: string, name: string): Stat => ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 3, regen: 0, descriptors: [] });

beforeEach(() => navigations.clear());

describe('hosts that hide Open and Find All Uses', () => {
  it('the template dialog', async () => {
    underWorldEditor(
      <StatCodeTemplateDialog
        open onOpenChange={vi.fn()} timing="after" stats={[stat('s1', 'Warmth')]} currentStatId="s1" hasExistingCode={false}
        onInsert={vi.fn()} placeholderPlaces={[]} traitPlaces={[]} entities={[]}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /New Template/i }));
    await screen.findByLabelText('Template code');
    expect(navigations.has('Template code')).toBe(true);
    expect(navigations.get('Template code')).toBeUndefined();
  });

  it('the Tool editor', () => {
    const tool: Tool = {
      id: 'u-find', name: 'find', description: '', emptyResult: '', offeredTo: ['narration'], params: [],
      handler: { kind: 'script', code: 'return 1;' },
    };
    underWorldEditor(
      <ToolEditor
        draft={tool} onDraftChange={vi.fn()} keptHandlers={{}} editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
        editing world={{ snapshot: sampleToolSnapshot, open: false }}
        fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
      />,
    );
    expect(navigations.has('Script')).toBe(true);
    expect(navigations.get('Script')).toBeUndefined();
  });

  it('the library editor', async () => {
    const ash: Entity = { id: 'ash', name: 'Ash', stats: [{ ...stat('grit', 'Grit'), scripts: [{ id: 'after', timing: 'after', code: '' }] }] } as Entity;
    underWorldEditor(<EntityEditorModal entityId={null} draft={ash} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Stats' }));
    await userEvent.click(screen.getByText('Grit'));
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name: 'Scripts' }));
    await waitFor(() => expect(navigations.has('Code Grit · After the AI')).toBe(true));
    expect(navigations.get('Code Grit · After the AI')).toBeUndefined();
  });
});
