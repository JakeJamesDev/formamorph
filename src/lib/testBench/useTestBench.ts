/**
 * The whole Test Bench orchestration behind the World Editor: open/close, the per-world Instrument tab, the
 * debounced rule pass and the on-demand stat-code check, the lens, the trigger report, the two view-models,
 * seen-state, and quick-fix write-through. The editor keeps only wiring — where its own selection stands and
 * how to land on an item — so the view stops changing for Bench reasons.
 *
 * Reads and writes the authored world through GameDataContext directly; the panel itself stays presentational
 * and receives everything as `panelProps`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useGameData } from '@/contexts/GameDataContext';
import { asBenchTab } from './benchTabs';
import { readBenchPlacement, writeBenchPlacement, type BenchPlacement } from './benchPlacement';
import type { BenchPopoverProps, CodeCheckStatus, TestBenchProps } from '@/lib/testBench/benchProps';
import {
  applyRuleFix, IMAGE_WEBP_RULE_ID, RULES, selectMatchingFindings,
  type Finding, type FindingSection, type RuleWorld,
} from './rules';
import { convertWorldImagesToWebp, describeWebpFixRun } from './imageWebpFix';
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
import { useLatestRun } from './useLatestRun';

/** What the Bench needs from the view — the editor's own knowledge, nothing Bench-owned. */
export interface TestBenchWiring {
  /** The editor's Locations selection, for the lens seed; null when another tab is active. */
  selectedLocationId: string | null;
  /** Mobile renders the Bench as a covering sheet, so navigating to an item also closes it. */
  isMobile: boolean;
  /** The editor's Simple/Advanced mode: Simple folds away the findings about fields it hides. */
  advanced: boolean;
  /** The dev-router's `bench=` slot: an Instrument to open on (DEV builds only). */
  routedTab?: string;
  /** Land the editor on a finding's item: its tab active, its row selected and revealed. */
  navigateToItem: (section: FindingSection, itemId: string) => void;
}

/** The Bench as the view wires it: where each surface goes, the header button's numbers, and one prop
 *  bundle per surface. */
export interface TestBenchHandle {
  /** Whether the full panel is showing — embedded, docked, or as the mobile sheet. */
  open: boolean;
  closeBench: () => void;
  /** Where an open panel goes on desktop. Both false on mobile, whose full panel is the sheet. */
  embedded: boolean;
  docked: boolean;
  /** The flask's one-button semantics: nothing showing opens the popover, anything showing closes. */
  toggleFlask: () => void;
  /** Whether any Bench surface is showing — what the flask reads as pressed from. */
  active: boolean;
  /** How many rows the Issues list shows — the header badge's muted total. */
  count: number;
  /** How many of them carry something the author has not been shown — the badge's loud number. */
  newCount: number;
  popoverProps: BenchPopoverProps;
  panelProps: TestBenchProps;
}

export function useTestBench({
  selectedLocationId, isMobile, advanced, routedTab, navigateToItem,
}: TestBenchWiring): TestBenchHandle {
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
  const beginCodeRun = useLatestRun(benchWorld);
  useEffect(() => {
    // Guarded so an ordinary keystroke doesn't re-render the panel to replace nothing with nothing.
    setCodeFindings((prev) => (prev.length === 0 ? prev : []));
    setCodeCheckStatus((prev) => (prev === 'idle' ? prev : 'idle'));
  }, [benchWorld]);
  const runStatCodeCheck = useCallback(async () => {
    const stillCurrent = beginCodeRun();
    setCodeCheckStatus('running');
    try {
      const found = await checkStatCode(getWorldData());
      if (!stillCurrent()) return;
      setCodeFindings(found);
      setCodeCheckStatus('done');
    } catch (error) {
      // The executor reports its own failures as results, so reaching here means the check itself broke —
      // leaving the button spinning would strand the author with no way to try again.
      console.error('Stat code check failed:', error);
      if (stillCurrent()) setCodeCheckStatus('idle');
    }
  }, [getWorldData, beginCodeRun]);
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
  const bench = useBenchFindings(worldId, benchWorldMeta?.sourceUpdatedAt, findings, advanced);
  // Triggers shows the matching-related half of what Issues lists — the same rows, filtered rather than
  // re-run, and taken after the dismissals so a rule muted on one tab stops nagging on both. Taken after the
  // mode fold too: alias hygiene is an Advanced field, and a Fix there would rewrite it unseen.
  const matchingFindings = useMemo(
    () => selectMatchingFindings(bench.groups.flatMap((group) => group.findings)),
    [bench.groups],
  );
  // The Bench closing is what marks its list as shown — the author has had it in front of them.
  const closeBench = useCallback(() => {
    bench.markAllSeen();
    setBenchOpen(false);
  }, [bench]);
  // The quick-triage popover, which shows the same list under the same rule: closing it is what marks the
  // list shown. Opening the full panel *from* it skips the mark — the list is about to be in front of the
  // author again, and quieting the badge there would hide what they came to read.
  const [popoverOpen, setPopoverOpen] = useState(false);
  const closePopover = useCallback(() => {
    bench.markAllSeen();
    setPopoverOpen(false);
  }, [bench]);
  const openPanelFromPopover = useCallback(() => {
    setPopoverOpen(false);
    setBenchOpen(true);
  }, []);
  // One button for the whole feature: the flask opens the cheapest surface first, and closes whichever one
  // is showing.
  const toggleFlask = useCallback(() => {
    if (benchOpen) closeBench();
    else if (popoverOpen) closePopover();
    else setPopoverOpen(true);
  }, [benchOpen, popoverOpen, closeBench, closePopover]);
  // Chrome, not authoring: remembered globally, so "Open Test Bench" opens the Bench the way this author
  // works rather than the way the last world left it.
  const [placement, setPlacement] = useState<BenchPlacement>(readBenchPlacement);
  // The write sits out here rather than inside the updater: a state updater that stores as a side effect
  // toggles twice, back to where it started, the moment anything replays it.
  const togglePlacement = useCallback(() => {
    const next = placement === 'embedded' ? 'docked' : 'embedded';
    writeBenchPlacement(next);
    setPlacement(next);
  }, [placement]);
  // A finding's item is a place in the editor: the view lands on it, and the mobile sheet — which covers the
  // editor — closes on the way. Only the sheet: a desktop panel sits beside the editor and stays open for
  // the next finding, and the popover covers nothing on either. Guarded on the sheet actually being what is
  // open, since closing marks the list seen — from the popover that would quiet a list still on screen.
  const openFindingItem = useCallback((section: FindingSection, itemId: string) => {
    navigateToItem(section, itemId);
    if (isMobile && benchOpen) closeBench();
  }, [navigateToItem, isMobile, benchOpen, closeBench]);
  // A downloaded copy nobody has edited yet: the first quick fix is what diverges it from its source, and
  // that is worth saying once. After the note (or after any save) the copy is already edited and it'd be noise.
  const noteFirstDownloadEdit = useCallback(() => {
    if (!worldId || !benchWorldMeta?.sourceId || benchWorldMeta.dirty) return;
    if (hasSeenDownloadNote(worldId)) return;
    markDownloadNoteSeen(worldId);
    toast.info('This world was downloaded — saving this fix marks your copy as edited.');
  }, [worldId, benchWorldMeta?.sourceId, benchWorldMeta?.dirty]);
  // A quick fix is a hand edit made all at once: the repaired world's every rebuilt slice is written back
  // through the same setter the panels use, so the world goes dirty and Exit Without Saving is still the
  // whole undo. Shared by the pure fixes and the async image conversion, which differ only in what produced
  // the world being written.
  const writeFixedWorld = useCallback((before: RuleWorld, after: RuleWorld) => {
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
  }, [updateWorldOverview, setStats, setLocations, setConnections, setEntities,
      setEntityGroups, setTraits, setTraitGroups, setStatUpdates, setDictionaries, setPlaceholders,
      noteFirstDownloadEdit]);
  // The image conversion is the one repair the pure pass can't carry — it decodes and re-encodes every
  // convertible picture. So it runs like the stat-code check: one at a time, and a result about a world the
  // author has since edited is dropped rather than written over the world they now have.
  const [fixingRuleId, setFixingRuleId] = useState<string | null>(null);
  const beginImageRun = useLatestRun(benchWorld);
  const runImageWebpFix = useCallback(async () => {
    const stillCurrent = beginImageRun();
    setFixingRuleId(IMAGE_WEBP_RULE_ID);
    try {
      const before = getWorldData();
      const result = await convertWorldImagesToWebp(before);
      if (!stillCurrent()) return;
      writeFixedWorld(before, result.world);
      const report = describeWebpFixRun(result);
      if (report) toast.info(report);
    } catch (error) {
      // The encoder returns the original on its own failures, so reaching here means the run itself broke —
      // leaving the button spinning would strand the author with no way to try again.
      console.error('Image WebP conversion failed:', error);
    } finally {
      setFixingRuleId(null);
    }
  }, [getWorldData, writeFixedWorld, beginImageRun]);
  const applyBenchFix = useCallback((ruleId: string) => {
    if (ruleId === IMAGE_WEBP_RULE_ID) {
      if (!fixingRuleId) void runImageWebpFix();
      return;
    }
    const before = getWorldData();
    writeFixedWorld(before, applyRuleFix(before, ruleId));
  }, [getWorldData, writeFixedWorld, fixingRuleId, runImageWebpFix]);
  // DEV dev-router: `#dev?modal=worldEditor&bench=issues` opens the Bench on an instrument. The route wins
  // the open's seed without being recorded, so it overrides the view but not the remembered tab.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const tab = asBenchTab(routedTab);
    if (!tab) return;
    routeBenchTab(tab);
    setBenchOpen(true);
  }, [routedTab, routeBenchTab]);

  const issues = {
    groups: bench.groups,
    dismissedGroups: bench.dismissedGroups,
    ruleCount: RULES.length,
    newCount: bench.newCount,
    advancedOnlyCount: bench.advancedOnlyCount,
    advanced,
    codedStatCount,
    codeCheckStatus,
    fixingRuleId,
    onOpenItem: openFindingItem,
    onDismissRule: bench.dismissRule,
    onRestoreRule: bench.restoreRule,
    onMarkAllSeen: bench.markAllSeen,
    onCheckStatCode: runStatCodeCheck,
  };

  return {
    open: benchOpen,
    closeBench,
    embedded: !isMobile && benchOpen && placement === 'embedded',
    docked: !isMobile && benchOpen && placement === 'docked',
    toggleFlask,
    active: benchOpen || popoverOpen,
    count: bench.groups.length,
    newCount: bench.newCount,
    popoverProps: {
      open: popoverOpen,
      onClose: closePopover,
      issues,
      onFixRule: applyBenchFix,
      onOpenPanel: openPanelFromPopover,
    },
    panelProps: {
      tab: benchTab,
      onTabChange: setBenchTab,
      onClose: closeBench,
      onFixRule: applyBenchFix,
      // Mobile's full panel is the sheet, which has nowhere else to be — so no toggle there.
      placementControl: isMobile ? undefined : { placement, onToggle: togglePlacement },
      issues,
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
