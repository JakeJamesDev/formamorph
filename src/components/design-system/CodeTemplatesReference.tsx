import { useMemo, useRef, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import {
  StatCodeTemplateDialog,
  type StatTemplateFileTransfer,
  type StatTemplateRepository,
} from '@/components/modals/StatCodeTemplateDialog';
import { HighlightedCode } from '@/components/prompt/HighlightedCode';
import { Button } from '@/components/ui/button';
import { Hint, Meta } from '@/components/ui/typography';
import type { StatCodeTemplate } from '@/lib/statCodeTemplates';
import { buildTemplatePack } from '@/services/StatTemplateStorageService';
import { entityTraitNames, worldTraitPlaces } from '@/lib/statCodeTraits';
import type { Entity, EntityGroup, Stat, Trait, TraitGroup } from '@/types';

const SAMPLE_STATS: Stat[] = [
  {
    id: 'sample-focus',
    name: 'Focus',
    type: 'number',
    description: 'The reader’s ability to keep attention on one task.',
    min: 0,
    max: 100,
    value: 45,
    regen: 0,
    descriptors: [],
  },
  {
    id: 'sample-warmth',
    name: 'Warmth',
    type: 'number',
    description: 'Protection from the cold outside the observatory.',
    min: 0,
    max: 100,
    value: 72,
    regen: 0,
    descriptors: [],
  },
  {
    id: 'sample-fatigue',
    name: 'Fatigue',
    type: 'number',
    description: 'Tiredness after travel and careful study.',
    min: 0,
    max: 100,
    value: 28,
    regen: 0,
    descriptors: [],
  },
];

const LONG_TEMPLATE: StatCodeTemplate = {
  id: 'showcase-long-template',
  name: 'Long Observatory Schedule With Recovery Conditions',
  description: 'This controlled personal template has enough detail and parameters to demonstrate selection, wrapping, and vertical overflow without reading the real template library.',
  timing: 'after',
  code: `const source = stats[{{source:stat}}].value;
const floor = {{floor:number=10}};
const ceiling = {{ceiling:number=90}};
const recovery = {{recovery:number=4}};
const nightPenalty = clock.daypart === {{quietPeriod:daypart=night}} ? {{penalty:number=8}} : 0;
return Math.min(ceiling, Math.max(floor, source + recovery * clock.deltaHours - nightPenalty));`,
};

const TRAIT_TEMPLATE: StatCodeTemplate = {
  id: 'showcase-trait-template',
  name: 'Trait Bonus',
  description: 'Follow another stat, with a bonus while a world trait is on.',
  timing: 'after',
  code: 'return stats[{{base:stat}}].value + (traits[{{trait:trait}}].enabled ? {{bonus:number=5}} : 0);',
};

// A deep trait path and Entity folders, so the slot pickers show their breadcrumbs and the collapse.
const SAMPLE_TRAIT_GROUPS: TraitGroup[] = [
  { id: 'sample-lineage', name: 'Lineage', parentId: null, order: 0 },
  { id: 'sample-bloodlines', name: 'Bloodlines of the Northern Reach', parentId: 'sample-lineage', order: 0 },
  { id: 'sample-storms', name: 'Storms', parentId: 'sample-bloodlines', order: 0 },
  { id: 'sample-habits', name: 'Habits', parentId: null, order: 1 },
];
const SAMPLE_TRAITS: Trait[] = [
  { id: 'sample-storm', name: 'Storm Touched by the Long Winter', statChanges: [], groupId: 'sample-storms', order: 0 },
  { id: 'sample-owl', name: 'Night Owl', statChanges: [], groupId: 'sample-habits', order: 0 },
  { id: 'sample-steady', name: 'Steady', statChanges: [], order: 2 },
];
const SAMPLE_ENTITY_GROUPS: EntityGroup[] = [
  { id: 'sample-observatory', name: 'Observatory', parentId: null, order: 0 },
  { id: 'sample-staff', name: 'Staff', parentId: 'sample-observatory', order: 0 },
];
const SAMPLE_ENTITIES: Entity[] = [
  { id: 'sample-mira', name: 'Mira Vance', groupId: 'sample-staff', order: 0, traits: [{ id: 'sample-wounded', name: 'Wounded', statChanges: [] }] },
  { id: 'sample-rook', name: 'Rook', order: 1, persona: true, traits: [{ id: 'sample-scarred', name: 'Scarred', statChanges: [] }] },
];
const SAMPLE_WORLD = { traits: SAMPLE_TRAITS, traitGroups: SAMPLE_TRAIT_GROUPS, entities: SAMPLE_ENTITIES, entityGroups: SAMPLE_ENTITY_GROUPS };
const SAMPLE_TRAIT_PLACES = worldTraitPlaces(SAMPLE_WORLD, []);
const SAMPLE_CODE_ENTITIES = entityTraitNames(SAMPLE_WORLD, []);

const IMPORT_TEMPLATE: StatCodeTemplate = {
  id: 'showcase-import-template',
  name: 'Imported Local Demonstration',
  description: 'This template comes from controlled showcase text.',
  timing: 'after',
  code: 'return {{amount:number=3}};',
};

export function CodeTemplatesReference() {
  const [open, setOpen] = useState(false);
  const [insertedCode, setInsertedCode] = useState('');
  const [lastAction, setLastAction] = useState('Select “Open Code Templates”.');
  const templates = useRef<StatCodeTemplate[]>([{ ...LONG_TEMPLATE }, { ...TRAIT_TEMPLATE }]);
  const nextId = useRef(1);

  const repository = useMemo<StatTemplateRepository>(() => ({
    list: async () => templates.current.map((template) => ({ ...template })),
    save: async (template) => {
      const saved = { ...template, id: template.id || `showcase-template-${nextId.current++}` };
      const index = templates.current.findIndex((item) => item.id === saved.id);
      templates.current = index === -1
        ? [...templates.current, saved]
        : templates.current.map((item) => item.id === saved.id ? saved : item);
      setLastAction(`The local template library saved “${saved.name}”.`);
      return saved;
    },
    remove: async (id) => {
      templates.current = templates.current.filter((template) => template.id !== id);
      setLastAction('The local template library erased the selected template.');
    },
    import: async (incoming) => {
      const known = new Set(templates.current.map((template) => template.id));
      const added = incoming.filter((template) => !known.has(template.id));
      templates.current = [...templates.current, ...added];
      setLastAction(`The local template library imported ${added.length} template${added.length === 1 ? '' : 's'}.`);
      return added.length;
    },
  }), []);

  const fileTransfer = useMemo<StatTemplateFileTransfer>(() => ({
    readImportPack: async () => JSON.stringify(buildTemplatePack([IMPORT_TEMPLATE])),
    writeExportPack: () => setLastAction('The local template export is ready.'),
  }), []);

  return (
    <section data-code-templates-reference className="grid gap-6" aria-labelledby="code-templates-reference-title">
      <div className="grid gap-2">
        <h3 id="code-templates-reference-title" className="text-heading">Stat Code Templates</h3>
        <Hint>
          Use the production dialog with controlled world data and local templates.
        </Hint>
      </div>

      <div className="grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0 space-y-2">
          <Meta className="uppercase tracking-wider">Local Sample Target</Meta>
          <h4 className="text-title font-semibold">Focus</h4>
          <Hint>This stat receives generated code only in this mounted reference.</Hint>
          {insertedCode ? (
            <HighlightedCode
              code={insertedCode}
              className="max-h-52 overflow-auto rounded-md border bg-muted/40 p-2 text-meta"
            />
          ) : (
            <p className="text-helper text-muted-foreground">No code is inserted.</p>
          )}
        </div>
        <Button onClick={() => setOpen(true)}>
          <LayoutTemplate className="h-4 w-4" />
          Open Code Templates
        </Button>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <Meta aria-live="polite">{lastAction}</Meta>
      </div>

      <StatCodeTemplateDialog
        open={open}
        onOpenChange={setOpen}
        timing="after"
        stats={SAMPLE_STATS}
        currentStatId="sample-focus"
        hasExistingCode={false}
        onInsert={(code) => {
          setInsertedCode(code);
          setLastAction('The local sample stat code is updated.');
        }}
        traitPlaces={SAMPLE_TRAIT_PLACES}
        entities={SAMPLE_CODE_ENTITIES}
        repository={repository}
        fileTransfer={fileTransfer}
      />
    </section>
  );
}
