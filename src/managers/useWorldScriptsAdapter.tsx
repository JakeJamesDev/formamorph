import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { HelpButton } from '@/components/HelpButton';
import { DropRefusalNotice } from '@/components/editor/DropRefusalNotice';
import { ListMenuRow } from '@/components/ListToolbar';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { useGameData } from '@/contexts/GameDataContext';
import { useCodeCardNavigation } from '@/lib/codeCardNavigation';
import { useCodeUseReveal } from '@/lib/codeUseReveal';
import { registerScriptInsert, reportScriptInsert } from '@/lib/formaquestion/scriptInsert';
import { newScript } from '@/lib/scriptRows';
import { patchScript, SCRIPT_TIMING_DESCRIPTION, SCRIPT_TIMING_LABEL, SCRIPT_TIMINGS, type ScriptPatch } from '@/lib/scripts';
import { isStatOn } from '@/lib/statCodeTargets';
import {
  editScripts, orderEdits, ownerRowId, reorderWrites, scriptEntryKey, scriptsByTiming, worldScriptEntries,
  type ScriptEdit, type ScriptEntry, type ScriptSlices,
} from '@/lib/worldScripts';
import type { Script, ScriptTiming } from '@/types';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { ScriptRow } from './ScriptsSection';
import { useScriptBoxContext } from './useScriptBoxContext';

/** One row of the tree: a timing's group, or a script under it. */
interface ScriptTreeRow {
  id: string;
  depth: number;
  timing: ScriptTiming;
  entry?: ScriptEntry;
}

const GROUP_PREFIX = 'timing:';
const groupId = (timing: ScriptTiming) => `${GROUP_PREFIX}${timing}`;
const groupTiming = (id: string): ScriptTiming | null => {
  const timing = id.startsWith(GROUP_PREFIX) ? id.slice(GROUP_PREFIX.length) : null;
  return SCRIPT_TIMINGS.find((t) => t === timing) ?? null;
};

/** Writes the slices a script edit rewrote through the per-record writers, so a typed run is one Step and a
 *  write that spans homes lands in one commit. */
function useScriptWrites() {
  const world = useGameData();
  const { updateStat, updateTrait, editEntity, setWorldScripts, updateWorldScript } = world;
  const latest = useRef(world);
  latest.current = world;
  return useCallback((edits: readonly ScriptEdit[]) => {
    const now = latest.current;
    const before: ScriptSlices = { scripts: now.worldScripts, stats: now.stats, traits: now.traits, entities: now.entities };
    const next = editScripts(before, edits);
    const changed = <T,>(was: readonly T[], is: readonly T[] | undefined) => (is ?? []).filter((record, i) => record !== was[i]);
    if (next.scripts) {
      const sameIds = next.scripts.length === before.scripts.length && next.scripts.every((s, i) => s.id === before.scripts[i].id);
      if (sameIds) changed(before.scripts, next.scripts).forEach(updateWorldScript);
      else setWorldScripts(next.scripts);
    }
    changed(before.stats, next.stats).forEach(updateStat);
    changed(before.traits, next.traits).forEach(updateTrait);
    // Apply the edits to the entity as it is when the updater runs, so a same-tick entity edit survives.
    changed(before.entities, next.entities).forEach(({ id }) => editEntity(id, (live) => (
      editScripts({ scripts: [], stats: [], traits: [], entities: [live] }, edits).entities?.[0] ?? live
    )));
  }, [updateStat, updateTrait, editEntity, setWorldScripts, updateWorldScript]);
}

/** A script's box in the tab: the owner's own row. */
function WorldScriptDetail({ entry, onWrite, autoFocus }: {
  entry: ScriptEntry;
  onWrite: (edits: ScriptEdit[]) => void;
  autoFocus: boolean;
}) {
  const { script, home } = entry;
  const context = useScriptBoxContext(home);
  // A stat's or trait's Find All Uses row opens its owner's tab, so only a world script's lands here.
  const reveal = useCodeUseReveal(script.id, null, 'world');
  const patch = (change: ScriptPatch) => onWrite([{ home, edit: (scripts) => patchScript(scripts, script.id, change) }]);
  const remove = () => onWrite([{ home, edit: (scripts) => scripts.filter((s) => s.id !== script.id) }]);
  return (
    <ScriptRow
      script={script}
      ownerName={entry.ownerName}
      context={context}
      onChange={patch}
      onRemove={remove}
      reveal={home.kind === 'world' ? reveal : null}
      autoFocus={autoFocus}
    />
  );
}

/** The detail footer's way to the stat or trait that holds the script: its own Scripts tab, the script revealed.
 *  A world script has none (Q46). */
function OpenOwnerFooter({ entry }: { entry: ScriptEntry }) {
  const { placeholders } = useGameData();
  const navigation = useCodeCardNavigation();
  const { box, entity, script } = entry;
  const rowId = ownerRowId(entry);
  if (!box || !rowId || !navigation) return null;
  const ownerText = entity ? `${entity.name} › ${entry.ownerName}` : entry.ownerName;
  const open = () => navigation.goToUse({
    entityId: entity?.id ?? null, rowId, ...('trait' in box && { trait: true as const }), timing: script.timing, scriptId: script.id,
    name: entry.ownerName, line: 1, noOwners: false,
  });
  return (
    <div className="flex items-center justify-end gap-2 border-t p-3">
      <Button type="button" variant="outline" size="sm" onClick={open}>
        Open <PlaceholderText text={ownerText} placeholders={placeholders} />
      </Button>
    </div>
  );
}

/**
 * The Scripts tab: every script in the world under its timing, in run order. A drag reorders within a timing and
 * writes `order` (Q5); the timing menu alone moves a script between timings (Q4). Add Script adds a world script.
 */
export function useWorldScriptsAdapter({ selectedId, onSelect, active = false }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** True while the Scripts tab shows: the help window's Insert targets the world then. */
  active?: boolean;
}): ListEditorAdapter {
  const { worldScripts, stats, statGroups, traits, traitGroups, entities, placeholders, setWorldScripts } = useGameData();
  const write = useScriptWrites();
  const [refused, setRefused] = useState<ScriptEntry | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const entries = useMemo(() => worldScriptEntries({
    scripts: worldScripts, stats, statGroups, traits, traitGroups, entities, placeholders,
  }), [worldScripts, stats, statGroups, traits, traitGroups, entities, placeholders]);
  const byTiming = useMemo(() => scriptsByTiming(entries), [entries]);
  const byKey = useMemo(() => new Map(entries.map((entry) => [entry.key, entry])), [entries]);

  const add = useCallback((timing: ScriptTiming, name: string, code = '') => {
    const script: Script = { ...newScript(timing, code), ...(name && { name }) };
    setWorldScripts([...worldScripts, script]);
    const key = scriptEntryKey({ kind: 'world' }, script.id);
    setFocusKey(key);
    onSelect(key);
  }, [worldScripts, setWorldScripts, onSelect]);

  // Read at insert time, so the registration does not change with each keystroke.
  const latestAdd = useRef(add);
  latestAdd.current = add;
  useEffect(() => {
    if (!active) return;
    return registerScriptInsert({
      homeName: 'World Scripts',
      insert: (timing, code) => {
        latestAdd.current(timing, '', code);
        reportScriptInsert('written');
      },
    });
  }, [active]);

  const tree: SortableTreeAdapter<ScriptTreeRow> = {
    visibleDeps: [byTiming],
    rowDeps: [placeholders],
    // A group row shows its count, which its node does not carry.
    rowInputs: (node) => (node.entry ? [] : [byTiming[node.timing].length]),
    placeholders,
    getVisible: (collapsed) => SCRIPT_TIMINGS.flatMap((timing) => [
      { id: groupId(timing), depth: 0, timing },
      ...(collapsed.has(groupId(timing)) ? [] : byTiming[timing].map((entry) => ({ id: entry.key, depth: 1, timing, entry }))),
    ]),
    projectDepth: () => null,
    onDrop: (activeId, overId) => {
      const active = byKey.get(activeId);
      if (!active || activeId === overId) return;
      const { timing } = active.script;
      const overTiming = groupTiming(overId) ?? byKey.get(overId)?.script.timing;
      const writes = overTiming === timing ? reorderWrites(byTiming[timing], activeId, groupTiming(overId) ? 'top' : overId) : null;
      if (!writes) {
        setRefused(active);
        return;
      }
      setRefused(null);
      if (writes.length) write(orderEdits(writes));
    },
    rowSpec: (node) => {
      if (!node.entry) {
        return {
          lead: 'chevron',
          collapseLabels: [`Expand ${SCRIPT_TIMING_LABEL[node.timing]}`, `Collapse ${SCRIPT_TIMING_LABEL[node.timing]}`],
          label: SCRIPT_TIMING_LABEL[node.timing],
          labelClass: 'font-medium',
          meta: String(byTiming[node.timing].length),
          fixed: true,
        };
      }
      const { entry } = node;
      // The runner skips a disabled stat's scripts.
      const off = !!entry.box && 'stat' in entry.box && !isStatOn(entry.box.stat);
      return {
        lead: 'spacer',
        faded: off,
        label: <PlaceholderText text={entry.label} placeholders={placeholders} />,
        ...((entry.entity || off) && {
          meta: (
            <>
              {entry.entity && <PlaceholderText text={entry.entity.name} placeholders={placeholders} />}
              {entry.entity && off && ' · '}
              {off && 'Off'}
            </>
          ),
        }),
      };
    },
  };

  const detail = (id: string | null) => {
    const entry = id ? byKey.get(id) : undefined;
    if (entry) {
      return <WorldScriptDetail key={entry.key} entry={entry} onWrite={write} autoFocus={focusKey === entry.key} />;
    }
    const timing = id ? groupTiming(id) : null;
    if (timing) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{SCRIPT_TIMING_LABEL[timing]}</span>
            <HelpButton topicId="worldEditor.scriptBox" className="h-6 w-6" />
          </div>
          <Hint>{SCRIPT_TIMING_DESCRIPTION[timing]}</Hint>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Scripts</span>
          <HelpButton topicId="worldEditor.scriptBox" className="h-6 w-6" />
        </div>
        <Hint>
          Shows every script by timing, in the order they run. Drag a script to change when it runs in its timing. In play,
          the persona&apos;s scripts run before other entities&apos;.
        </Hint>
      </div>
    );
  };

  return {
    tree: (
      <>
        {refused && (
          <DropRefusalNotice onDismiss={() => setRefused(null)}>
            <strong><PlaceholderText text={refused.label} placeholders={placeholders} /></strong> stays in{' '}
            {SCRIPT_TIMING_LABEL[refused.script.timing]}. Change its timing with the <strong>Timing</strong> menu.
          </DropRefusalNotice>
        )}
        <SortableTree adapter={tree} selectedId={selectedId} onSelect={onSelect} revealSelected />
      </>
    ),
    rows: () => entries.map((entry) => ({ id: entry.key, name: entry.label, actions: [] })),
    names: { placeholders },
    noun: 'scripts',
    detail,
    footer: (id) => {
      const entry = byKey.get(id);
      return entry && <OpenOwnerFooter entry={entry} />;
    },
    add: {
      label: 'Add Script',
      menu: SCRIPT_TIMINGS.map((timing) => (
        <ListMenuRow key={timing} label={SCRIPT_TIMING_LABEL[timing]} onAdd={(typed) => add(timing, typed)} />
      )),
    },
    placeholder: 'Search scripts',
    holds: (id) => byKey.has(id) || groupTiming(id) !== null,
    isEmpty: false,
    emptyHint: null,
  };
}
