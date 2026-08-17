/**
 * The whole Test Bench orchestration behind the World Editor: open/close, the per-world Instrument tab, the
 * debounced rule pass and the on-demand stat-code check, the lens, the trigger report, the two view-models,
 * seen-state, and quick-fix write-through. The editor keeps only wiring — where its own selection stands and
 * how to land on an item — so the view stops changing for Bench reasons.
 *
 * Reads and writes the authored world through GameDataContext directly; the panel itself stays presentational
 * and receives everything as `panelProps`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useGameData } from '@/contexts/GameDataContext';
import { asBenchTab } from './benchTabs';
import type { CodeCheckStatus, TestBenchProps } from '@/lib/testBench/benchProps';
import {
  applyRuleFix, RULES, selectMatchingFindings, type Finding, type FindingSection,
} from './rules';
import { buildAiContext, EMPTY_AI_CONTEXT } from './aiContext';
import { buildOpening, EMPTY_OPENING } from './opening';
import { useOpeningRolls } from './useOpeningRolls';
import { loadLastTurn, type LastTurn } from './lastTurn';
import { checkStatCode } from './statCodeCheck';
import { lensStatOverrides } from './lens';
import { useBenchFindings } from './useBenchFindings';
import { useBenchLens } from './useBenchLens';
import { useBenchTab } from './useBenchTab';
import { useDebouncedTriggerReport } from './useTriggerReport';
import { useTriggerSemantics } from './useTriggerSemantics';
import { joinHistory } from './triggers';
import { hasSeenDownloadNote, markDownloadNoteSeen } from './downloadNote';
import { useDebouncedFindings } from './useFindings';

/** What the Bench needs from the view — the editor's own knowledge, nothing Bench-owned. */
export interface TestBenchWiring {
  /** The editor's Locations selection, for the lens seed; null when another tab is active. */
  selectedLocationId: string | null;
  /** Mobile renders the Bench as a covering sheet, so navigating to an item also closes it. */
  isMobile: boolean;
  /** The dev-router's `bench=` slot: an Instrument to open on (DEV builds only). */
  routedTab?: string;
  /** Land the editor on a finding's item: its tab active, its row selected and revealed. */
  navigateToItem: (section: FindingSection, itemId: string) => void;
}

/** The Bench as the view wires it: the open flag, the header button's numbers, and the panel's props. */
export interface TestBenchHandle {
  open: boolean;
  openBench: () => void;
  closeBench: () => void;
  /** How many rows the Issues list shows — the header badge's muted total. */
  count: number;
  /** How many of them carry something the author has not been shown — the badge's loud number. */
  newCount: number;
  panelProps: TestBenchProps;
}

export function useTestBench({ selectedLocationId, isMobile, routedTab, navigateToItem }: TestBenchWiring): TestBenchHandle {
  const {
    worldId, worldOverview, getWorldData, worldMetadata, updateWorldOverview,
    setStats, setLocations, setConnections, setEntities, setEntityGroups,
    setTraits, setTraitGroups, setStatUpdates, setDictionaries, setPlaceholders,
  } = useGameData();

  const [benchOpen, setBenchOpen] = useState(false);
  // The open Instrument, remembered per world for the session — the sheet closing doesn't reset the setup.
  const { tab: benchTab, setTab: setBenchTab, routeTab: routeBenchTab } = useBenchTab(worldId, { open: benchOpen });
  // Above the tab strip, so switching instruments (which unmounts the panel below it) doesn't discard the
  // prose the author is testing with.
  const [triggerText, setTriggerText] = useState('');
  const [triggerHistory, setTriggerHistory] = useState('');
  // `getWorldData` is memoized on the world arrays, so this payload's identity is the "world changed"
  // signal the rule pass debounces on.
  const benchWorld = useMemo(getWorldData, [getWorldData]);
  const staticFindings = useDebouncedFindings(benchWorld);
  // Stat-code execution is the one check the live pass can't carry — each stat costs a sandbox VM. Its
  // findings are held from the last explicit run and dropped the moment the world moves, so a repaired stat
  // can never keep showing its old failure.
  const [codeFindings, setCodeFindings] = useState<Finding[]>([]);
  const [codeCheckStatus, setCodeCheckStatus] = useState<CodeCheckStatus>('idle');
  // Which run is the current one. A run started against a world the author has since edited must not land:
  // its verdict is about code that no longer exists, which is the one thing the clearing below exists to stop.
  const codeRunRef = useRef(0);
  useEffect(() => {
    codeRunRef.current += 1;
    // Guarded so an ordinary keystroke doesn't re-render the panel to replace nothing with nothing.
    setCodeFindings((prev) => (prev.length === 0 ? prev : []));
    setCodeCheckStatus((prev) => (prev === 'idle' ? prev : 'idle'));
  }, [benchWorld]);
  const runStatCodeCheck = useCallback(async () => {
    const run = (codeRunRef.current += 1);
    setCodeCheckStatus('running');
    try {
      const found = await checkStatCode(getWorldData());
      if (run !== codeRunRef.current) return;
      setCodeFindings(found);
      setCodeCheckStatus('done');
    } catch (error) {
      // The executor reports its own failures as results, so reaching here means the check itself broke —
      // leaving the button spinning would strand the author with no way to try again.
      console.error('Stat code check failed:', error);
      if (run === codeRunRef.current) setCodeCheckStatus('idle');
    }
  }, [getWorldData]);
  const codedStatCount = useMemo(
    () => benchWorld.stats.filter((s) => s.code?.trim()).length,
    [benchWorld],
  );
  const findings = useMemo(
    () => (codeFindings.length === 0 ? staticFindings : [...staticFindings, ...codeFindings]),
    [staticFindings, codeFindings],
  );
  // Semantic scoring is opt-in per session and never remembered: a toggle that came back on by itself would
  // let an author read a semantic firing as proof their keywords work.
  const [semanticOn, setSemanticOn] = useState(false);
  const semantics = useTriggerSemantics(
    benchOpen && benchTab === 'triggers', semanticOn, benchWorld, triggerText,
  );
  // The lens every instrument reads. It seeds from whatever location the author has open in the editor, so
  // opening the Bench mid-edit lands on the place they were already looking at.
  const benchLens = useBenchLens(worldId, benchWorld, {
    open: benchOpen,
    selectedLocationId,
  });
  const statOverrides = useMemo(
    () => lensStatOverrides(benchWorld, benchLens.lens),
    [benchWorld, benchLens.lens],
  );
  const triggerReport = useDebouncedTriggerReport(benchWorld, triggerText, triggerHistory, {
    semantic: semantics.input,
    pins: benchLens.lens.pins,
  });
  // Assembled only while the author is looking at it: every enabled lore entry is concatenated and
  // placeholder-scanned in there, which is not work to redo on each keystroke of an edit nobody is watching.
  const aiContextLive = benchOpen && benchTab === 'aiContext';
  const aiContext = useMemo(
    () => (aiContextLive ? buildAiContext(benchWorld, benchLens.lens) : EMPTY_AI_CONTEXT),
    [aiContextLive, benchWorld, benchLens.lens],
  );
  // The Opening instrument's frozen rolls live above the assembly so a tab switch never rerolls them; the
  // assembly itself — stat settling, the roll table, the whole first prompt — runs only while watched.
  const openingLive = benchOpen && benchTab === 'opening';
  const openingRolls = useOpeningRolls(benchWorld, openingLive);
  const opening = useMemo(
    () => (openingLive ? buildOpening(benchWorld, benchLens.lens, openingRolls.rolls) : EMPTY_OPENING),
    [openingLive, benchWorld, benchLens.lens, openingRolls.rolls],
  );
  const rerollOpening = useCallback(
    () => openingRolls.reroll(benchLens.lens),
    [openingRolls, benchLens.lens],
  );
  // The world's most recent save, read while the Bench is open so a turn played since it was last opened is
  // the one offered. Absent when the world has never been played — then there is no button at all.
  const [lastTurn, setLastTurn] = useState<LastTurn | null>(null);
  useEffect(() => {
    if (!benchOpen) return;
    let live = true;
    loadLastTurn(worldId, worldOverview.name).then((turn) => { if (live) setLastTurn(turn); });
    return () => { live = false; };
  }, [benchOpen, worldId, worldOverview.name]);
  const pasteLastTurn = useCallback(() => {
    if (!lastTurn) return;
    setTriggerText(lastTurn.scene);
    setTriggerHistory(joinHistory(lastTurn.history));
  }, [lastTurn]);
  const benchWorldMeta = worldMetadata.find((m) => m.id === worldId);
  // Newness and dismissals are per world and outlive the session, so the rule pass's raw output goes through
  // the stored marks before it reaches the panel or the badge.
  const bench = useBenchFindings(worldId, benchWorldMeta?.sourceUpdatedAt, findings);
  // Triggers shows the matching-related half of what Issues lists — the same rows, filtered rather than
  // re-run, and taken after the dismissals so a rule muted on one tab stops nagging on both.
  const matchingFindings = useMemo(
    () => selectMatchingFindings(bench.groups.flatMap((group) => group.findings)),
    [bench.groups],
  );
  // The Bench closing is what marks its list as shown — the author has had it in front of them.
  const closeBench = useCallback(() => {
    bench.markAllSeen();
    setBenchOpen(false);
  }, [bench]);
  const openBench = useCallback(() => setBenchOpen(true), []);
  // A finding's item is a place in the editor: the view lands on it, and the mobile sheet — which covers the
  // editor — closes on the way; the desktop panel sits beside it and stays open for the next finding.
  const openFindingItem = useCallback((section: FindingSection, itemId: string) => {
    navigateToItem(section, itemId);
    if (isMobile) closeBench();
  }, [navigateToItem, isMobile, closeBench]);
  // A downloaded copy nobody has edited yet: the first quick fix is what diverges it from its source, and
  // that is worth saying once. After the note (or after any save) the copy is already edited and it'd be noise.
  const noteFirstDownloadEdit = useCallback(() => {
    if (!worldId || !benchWorldMeta?.sourceId || benchWorldMeta.dirty) return;
    if (hasSeenDownloadNote(worldId)) return;
    markDownloadNoteSeen(worldId);
    toast.info('This world was downloaded — saving this fix marks your copy as edited.');
  }, [worldId, benchWorldMeta?.sourceId, benchWorldMeta?.dirty]);
  // A quick fix is a hand edit made all at once: the rule returns the repaired world and each slice it
  // rebuilt is written back through the same setter the panels use, so the world goes dirty and Exit
  // Without Saving is still the whole undo.
  const applyBenchFix = useCallback((ruleId: string) => {
    const before = getWorldData();
    const after = applyRuleFix(before, ruleId);
    if (after === before) return;
    // `updateWorldOverview` merges, so a fix that ever needs to *remove* an overview field will need more
    // than this line; none does today, and the rest of the payload is replaced wholesale.
    if (after.worldOverview !== before.worldOverview) updateWorldOverview(after.worldOverview);
    if (after.stats !== before.stats) setStats(after.stats);
    if (after.locations !== before.locations) setLocations(after.locations);
    if (after.connections !== before.connections) setConnections(after.connections ?? []);
    if (after.entities !== before.entities) setEntities(after.entities);
    if (after.entityGroups !== before.entityGroups) setEntityGroups(after.entityGroups ?? []);
    if (after.traits !== before.traits) setTraits(after.traits);
    if (after.traitGroups !== before.traitGroups) setTraitGroups(after.traitGroups ?? []);
    if (after.statUpdates !== before.statUpdates) setStatUpdates(after.statUpdates);
    if (after.dictionaries !== before.dictionaries) setDictionaries(after.dictionaries);
    if (after.placeholders !== before.placeholders) setPlaceholders(after.placeholders ?? []);
    noteFirstDownloadEdit();
  }, [getWorldData, updateWorldOverview, setStats, setLocations, setConnections, setEntities,
      setEntityGroups, setTraits, setTraitGroups, setStatUpdates, setDictionaries, setPlaceholders,
      noteFirstDownloadEdit]);
  // DEV dev-router: `#dev?modal=worldEditor&bench=issues` opens the Bench on an instrument. The route wins
  // the open's seed without being recorded, so it overrides the view but not the remembered tab.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const tab = asBenchTab(routedTab);
    if (!tab) return;
    routeBenchTab(tab);
    setBenchOpen(true);
  }, [routedTab, routeBenchTab]);

  return {
    open: benchOpen,
    openBench,
    closeBench,
    count: bench.groups.length,
    newCount: bench.newCount,
    panelProps: {
      tab: benchTab,
      onTabChange: setBenchTab,
      onClose: closeBench,
      onFixRule: applyBenchFix,
      issues: {
        groups: bench.groups,
        dismissedGroups: bench.dismissedGroups,
        ruleCount: RULES.length,
        newCount: bench.newCount,
        codedStatCount,
        codeCheckStatus,
        onOpenItem: openFindingItem,
        onDismissRule: bench.dismissRule,
        onRestoreRule: bench.restoreRule,
        onMarkAllSeen: bench.markAllSeen,
        onCheckStatCode: runStatCodeCheck,
      },
      lens: {
        lens: benchLens.lens,
        pcOptions: benchLens.pcOptions,
        locationOptions: benchLens.locationOptions,
        statOverrides,
        onPcChange: benchLens.setPc,
        onLocationChange: benchLens.setLocation,
      },
      triggers: {
        text: triggerText,
        onTextChange: setTriggerText,
        history: triggerHistory,
        onHistoryChange: setTriggerHistory,
        report: triggerReport,
        matchingFindings,
        onPasteLastTurn: lastTurn ? pasteLastTurn : undefined,
        semanticStatus: semantics.status,
        semanticOn,
        onSemanticChange: setSemanticOn,
      },
      aiContext,
      opening: {
        data: opening,
        onReroll: rerollOpening,
      },
    },
  };
}
