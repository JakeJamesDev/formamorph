/* eslint-disable react-refresh/only-export-components -- one-file prototype, nothing to fast-refresh */
/* PROTOTYPE — throwaway. Not app code.
 *
 * Question: can a placeholder chip expand into its value INSIDE the same Lexical editor, so the author edits
 * the value in place, the placeholder store receives every keystroke, and the field itself still serializes
 * to the chip token? Which boundary behaviors (typing at edges, backspace, cross-boundary delete, Enter,
 * copy/paste, the same chip expanded twice) work, and which need a rule?
 *
 * Same libraries as the app: lexical + @lexical/react, React 18, lucide icons, the app's CSS tokens.
 * Served by the app's Vite dev server at /docs-internal/specs/placeholder-inline-edit/prototype.html.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DecoratorNode, ElementNode, $applyNodeReplacement, $createLineBreakNode, $createParagraphNode,
  $createTextNode, $getNodeByKey, $getRoot, $getSelection, $isRangeSelection, $isTextNode,
  $isLineBreakNode, $isElementNode, $nodesOfType,
  $setSlot, $getSlot, $removeSlot, $getSelectionSlotFrame, mountSlotContainer,
  COMMAND_PRIORITY_HIGH, DELETE_CHARACTER_COMMAND, KEY_ENTER_COMMAND, INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND, PASTE_COMMAND, COPY_COMMAND,
  type LexicalEditor, type LexicalNode, type NodeKey, type SerializedElementNode, type SerializedLexicalNode,
  type Spread, type RangeSelection,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChevronLeft, ChevronRight, Minimize2, X } from 'lucide-react';

/* ───────────────────────────── store (in memory) ───────────────────────────── */

interface Pin { source: string; text: string }
interface Placeholder { id: string; name: string; values: string[]; pins: Pin[] }

const COLORS: Record<string, string> = { hair: '#f4b860', name: '#8fd3f4', mood: '#c3e88d' };
const INITIAL: Placeholder[] = [
  { id: 'hair', name: 'Hair', values: ['long silver hair', 'a cropped black undercut', 'copper curls tied back'],
    pins: [{ source: 'Trait › Northern', text: 'pale braids' }] },
  { id: 'name', name: 'Name', values: ['Molly'], pins: [] },
  { id: 'mood', name: 'Mood', values: ['wary of strangers', 'quick to laugh, quicker to bite'], pins: [] },
];

const TOKEN_RE = /\{\{ph:([a-z]+)\}\}/g;
const tokenOf = (id: string) => `{{ph:${id}}}`;

/** Every editable slot on a placeholder, values first then pins. A chevron walks this list. */
interface Slot { kind: 'value' | 'pin'; index: number; label: string; text: string }
function slotsOf(ph: Placeholder): Slot[] {
  return [
    ...ph.values.map((text, index) => ({ kind: 'value' as const, index, label: `Value ${index + 1}`, text })),
    ...ph.pins.map((pin, index) => ({ kind: 'pin' as const, index, label: `Pin · ${pin.source}`, text: pin.text })),
  ];
}
function withSlot(ph: Placeholder, slot: number, text: string): Placeholder {
  const n = ph.values.length;
  if (slot < n) return { ...ph, values: ph.values.map((v, i) => (i === slot ? text : v)) };
  return { ...ph, pins: ph.pins.map((p, i) => (i === slot - n ? { ...p, text } : p)) };
}

interface Options {
  /** boxed / ownline / underline expand into an inline RegionNode; slot keeps the chip and opens a named slot (Lexical 0.50). */
  treatment: 'boxed' | 'ownline' | 'underline' | 'slot' | 'slot-float' | 'slot-float-v' | 'slot-float-vh' | 'slot-float-shape' | 'slot-stack' | 'slot-block';
  edgeTyping: 'outside' | 'inside';
  boundaryDelete: 'block' | 'collapse';
  enterInRegion: 'linebreak' | 'block';
}
interface Store {
  placeholders: Placeholder[];
  setSlot(id: string, slot: number, text: string): void;
  log(line: string): void;
}
const StoreContext = createContext<Store>({ placeholders: [], setSlot: () => {}, log: () => {} });
// Node classes cannot read React context, so the options they consult live here.
const OptionsRef: { current: Options } = { current: { treatment: 'boxed', edgeTyping: 'outside', boundaryDelete: 'block', enterInRegion: 'linebreak' } };

/* ───────────────────────────── nodes ───────────────────────────── */

type SerializedChip = Spread<{ id: string; expanded: boolean; slot: number }, SerializedLexicalNode>;

/** The pill. Click expands it: into a RegionNode in place (region treatments), or — slot treatment — the chip
 *  stays and opens a named slot holding the value, mounted into its own chrome. */
class ChipNode extends DecoratorNode<ReactNode> {
  __id: string;
  __expanded: boolean;
  __slot: number;
  static getType() { return 'proto-chip'; }
  static clone(n: ChipNode) { return new ChipNode(n.__id, n.__expanded, n.__slot, n.__key); }
  constructor(id: string, expanded = false, slot = 0, key?: NodeKey) { super(key); this.__id = id; this.__expanded = expanded; this.__slot = slot; }
  afterCloneFrom(prev: this) { super.afterCloneFrom(prev); this.__id = prev.__id; this.__expanded = prev.__expanded; this.__slot = prev.__slot; }
  isInline() { return true; }
  getId() { return this.getLatest().__id; }
  isExpanded() { return this.getLatest().__expanded; }
  setExpanded(v: boolean) { this.getWritable().__expanded = v; return this; }
  getSlotIndex() { return this.getLatest().__slot; }
  setSlotIndex(i: number) { this.getWritable().__slot = i; return this; }
  createDOM() { const s = document.createElement('span'); s.className = 'chip-host'; return s; }
  updateDOM() { return false; }
  static importJSON(s: SerializedChip) { return $applyNodeReplacement(new ChipNode(s.id, s.expanded, s.slot)); }
  exportJSON(): SerializedChip { return { ...super.exportJSON(), type: 'proto-chip', version: 1, id: this.__id, expanded: this.__expanded, slot: this.__slot }; }
  // The token, never the slot text: the field must not fold the value in (the base folds slots first).
  getTextContent() { return tokenOf(this.__id); }
  decorate() { return this.__expanded ? <SlotChip nodeKey={this.__key} id={this.__id} /> : <Chip nodeKey={this.__key} id={this.__id} />; }
}
const $createChipNode = (id: string) => $applyNodeReplacement(new ChipNode(id));
const $isChipNode = (n: LexicalNode | null | undefined): n is ChipNode => n instanceof ChipNode;

/** A multi-block slot value: a shadow root, so Enter makes a new paragraph inside the slot. */
class SlotBoxNode extends ElementNode {
  static getType() { return 'proto-slot-box'; }
  static clone(n: SlotBoxNode) { return new SlotBoxNode(n.__key); }
  createDOM() { const d = document.createElement('div'); d.className = 'slot-box'; return d; }
  updateDOM() { return false; }
  isShadowRoot() { return true; }
  static importJSON() { return new SlotBoxNode(); }
  exportJSON(): SerializedElementNode { return { ...super.exportJSON(), type: 'proto-slot-box', version: 1 }; }
}
const $isSlotBoxNode = (n: LexicalNode | null | undefined): n is SlotBoxNode => n instanceof SlotBoxNode;

const SLOT = 'value';
/** The slot value's text: one paragraph, or the box's paragraphs joined by newlines. */
function $slotText(chip: ChipNode): string | null {
  const v = $getSlot(chip, SLOT);
  if (!v || !$isElementNode(v)) return null;
  if ($isSlotBoxNode(v)) return v.getChildren().map((p) => ($isElementNode(p) ? serializeChildren(p, 'token') : '')).join('\n');
  return serializeChildren(v, 'token');
}
function $fillSlot(chip: ChipNode, text: string) {
  // Bare paragraph = single-line field (Enter is a no-op); the box = multi-block region.
  if (OptionsRef.current.enterInRegion === 'block') {
    const p = $createParagraphNode();
    p.append(...$parseInline(text));
    $setSlot(chip, SLOT, p);
    return p;
  }
  const box = new SlotBoxNode();
  for (const line of text.split('\n')) { const p = $createParagraphNode(); p.append(...$parseInline(line)); box.append(p); }
  $setSlot(chip, SLOT, box);
  return box;
}

type SerializedRegion = Spread<{ id: string; slot: number }, SerializedElementNode>;

/** The expanded chip: an inline element whose children are the value's text (and nested chips). */
class RegionNode extends ElementNode {
  __id: string;
  __slot: number;
  static getType() { return 'proto-region'; }
  static clone(n: RegionNode) { return new RegionNode(n.__id, n.__slot, n.__key); }
  constructor(id: string, slot: number, key?: NodeKey) { super(key); this.__id = id; this.__slot = slot; }
  afterCloneFrom(prev: this) { super.afterCloneFrom(prev); this.__id = prev.__id; this.__slot = prev.__slot; }
  getId() { return this.getLatest().__id; }
  getSlot() { return this.getLatest().__slot; }
  setSlot(slot: number) { this.getWritable().__slot = slot; return this; }
  createDOM() {
    const el = document.createElement('span');
    el.className = `region region-${OptionsRef.current.treatment}`;
    el.style.setProperty('--accent', COLORS[this.__id] ?? '#888');
    el.dataset.region = this.__id;
    return el;
  }
  updateDOM() { return false; }
  static importJSON(s: SerializedRegion) { return $createRegionNode(s.id, s.slot); }
  exportJSON(): SerializedRegion { return { ...super.exportJSON(), type: 'proto-region', version: 1, id: this.__id, slot: this.__slot }; }
  isInline() { return true; }
  canBeEmpty() { return false; }
  // The MarkNode pattern: false pushes edge typing outside the region; true keeps it inside.
  canInsertTextBefore() { return OptionsRef.current.edgeTyping === 'inside'; }
  canInsertTextAfter() { return OptionsRef.current.edgeTyping === 'inside'; }
  // Copying a region yields its text, not a second live region.
  excludeFromCopy(destination: 'clone' | 'html') { return destination !== 'clone'; }
  insertNewAfter(_s: RangeSelection, restore = true) {
    const next = $createRegionNode(this.__id, this.__slot);
    this.insertAfter(next, restore);
    return next;
  }
}
const $createRegionNode = (id: string, slot: number) => $applyNodeReplacement(new RegionNode(id, slot));
const $isRegionNode = (n: LexicalNode | null | undefined): n is RegionNode => n instanceof RegionNode;

/** The region's header: name, chevrons, collapse. Not keyboard-selectable, so arrows skip over it. */
class RegionHeadNode extends DecoratorNode<ReactNode> {
  static getType() { return 'proto-region-head'; }
  static clone(n: RegionHeadNode) { return new RegionHeadNode(n.__key); }
  isInline() { return true; }
  isKeyboardSelectable() { return false; }
  createDOM() { const s = document.createElement('span'); s.className = 'region-head-slot'; s.contentEditable = 'false'; return s; }
  updateDOM() { return false; }
  static importJSON() { return new RegionHeadNode(); }
  exportJSON(): SerializedLexicalNode { return { type: 'proto-region-head', version: 1 }; }
  getTextContent() { return ''; }
  decorate() { return <RegionHead nodeKey={this.__key} />; }
}
const $isRegionHeadNode = (n: LexicalNode | null | undefined): n is RegionHeadNode => n instanceof RegionHeadNode;

/* ───────────────────────────── parse / serialize ───────────────────────────── */

/** Text with tokens → inline nodes. */
function $parseInline(text: string): LexicalNode[] {
  const out: LexicalNode[] = [];
  const pushText = (t: string) => {
    t.split('\n').forEach((line, i) => {
      if (i > 0) out.push($createLineBreakNode());
      if (line) out.push($createTextNode(line));
    });
  };
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    pushText(text.slice(last, m.index));
    out.push($createChipNode(m[1]));
    last = (m.index ?? 0) + m[0].length;
  }
  pushText(text.slice(last));
  return out;
}

/** Inline nodes → text with tokens. A region serializes as its token for the field, or as its children's
 *  text for the store — the one split everything hangs on. */
function serializeChildren(node: ElementNode, regionAs: 'token' | 'text'): string {
  let s = '';
  for (const child of node.getChildren()) {
    if ($isTextNode(child)) s += child.getTextContent();
    else if ($isLineBreakNode(child)) s += '\n';
    else if ($isChipNode(child)) s += tokenOf(child.getId());
    else if ($isRegionHeadNode(child)) continue;
    else if ($isRegionNode(child)) s += regionAs === 'token' ? tokenOf(child.getId()) : serializeChildren(child, 'token');
    else if ($isElementNode(child)) s += serializeChildren(child, regionAs);
  }
  return s;
}
function $serializeField(): string {
  return $getRoot().getChildren().map((p) => ($isElementNode(p) ? serializeChildren(p, 'token') : '')).join('\n');
}
/** What a region's body says right now — the value text the store should hold. */
const $regionText = (r: RegionNode) => serializeChildren(r, 'token');

function $fillRegion(region: RegionNode, text: string) {
  const body = $parseInline(text);
  // One splice, never clear-then-append: `ElementNode.splice` removes an element that cannot be empty the
  // moment its child count hits zero, so a cleared region is detached before anything is appended to it.
  // An empty value still gets an empty text node, a place for the caret.
  region.splice(0, region.getChildrenSize(), [new RegionHeadNode(), ...(body.length ? body : [$createTextNode('')])]);
}

// Both collapses park the caret right after the chip first: removing the node the selection sits in
// leaves Lexical with a lost selection, and the whole update rolls back.
function $collapse(region: RegionNode) {
  const chip = $createChipNode(region.getId());
  region.replace(chip);
  chip.selectNext(0, 0);
}
function $collapseChip(chip: ChipNode) {
  const sel = $getSelection();
  const frame = $getSelectionSlotFrame(sel);
  if (frame && $getSlot(chip, SLOT)?.is(frame)) chip.selectNext(0, 0);
  $removeSlot(chip, SLOT);
  chip.setExpanded(false);
}
function $expand(chipKey: NodeKey, store: Store) {
  const chip = $getNodeByKey(chipKey);
  if (!$isChipNode(chip)) return;
  const id = chip.getId();
  // The same placeholder expanded twice edits one record from two carets — collapse the other first.
  for (const other of $nodesOfType(RegionNode)) if (other.getId() === id) $collapse(other);
  for (const other of $nodesOfType(ChipNode)) if (other.getId() === id && other.isExpanded()) $collapseChip(other);
  const ph = store.placeholders.find((p) => p.id === id);
  if (!ph) return;
  const text = slotsOf(ph)[0]?.text ?? '';
  if (OptionsRef.current.treatment.startsWith('slot')) {
    chip.setExpanded(true).setSlotIndex(0);
    const value = $fillSlot(chip, text);
    value.selectEnd();
    store.log(`expand ${ph.name} (slot)`);
    return;
  }
  const region = $createRegionNode(id, 0);
  chip.replace(region);
  $fillRegion(region, text);
  region.getLastChild()?.selectEnd();
  store.log(`expand ${ph.name}`);
}

/** Put the caret in a chip's open slot. `editor.focus()` only reaches the root, and a slot container is its
 *  own contenteditable island, so the island must be focused itself before the selection is applied. */
function focusChip(editor: LexicalEditor, chipKey: NodeKey) {
  const island = editor.getElementByKey(chipKey)?.querySelector<HTMLElement>('[data-lexical-slot]');
  if (!island) { editor.focus(); return; }
  island.focus();
  editor.update(() => {
    const chip = $getNodeByKey(chipKey);
    if ($isChipNode(chip)) $getSlot(chip, SLOT)?.selectEnd();
  });
}

/* ───────────────────────────── chip + head UI ───────────────────────────── */

function Chip({ nodeKey, id }: { nodeKey: NodeKey; id: string }) {
  const [editor] = useLexicalComposerContext();
  const store = useContext(StoreContext);
  const ph = store.placeholders.find((p) => p.id === id);
  if (!ph) return <span className="chip" style={{ background: '#888' }}>?</span>;
  return (
    <span
      className="chip"
      style={{ background: COLORS[id] }}
      title={slotsOf(ph).map((s) => s.text).join(' | ')}
      onClick={() => { editor.update(() => $expand(nodeKey, store), { discrete: true }); focusChip(editor, nodeKey); }}
    >
      {ph.name}
      <button type="button" className="chip-x" aria-label="Remove" onClick={(e) => { e.stopPropagation(); editor.update(() => $getNodeByKey(nodeKey)?.remove()); }}><X size={10} /></button>
    </span>
  );
}

/** The slot treatment's expanded chip: header + the slot container mounted into this chrome. */
function SlotChip({ nodeKey, id }: { nodeKey: NodeKey; id: string }) {
  const [editor] = useLexicalComposerContext();
  const store = useContext(StoreContext);
  const target = useRef<HTMLSpanElement>(null);
  const [slot, setSlotState] = useState(0);
  // Mount after every commit that touches this chip: the container is parked hidden in the host DOM until
  // something reveals it, and a reconcile may re-park it.
  const head = useRef<HTMLSpanElement>(null);
  const shape = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const mount = () => { if (target.current) mountSlotContainer(editor, nodeKey, SLOT, target.current); clamp(); };
    // One outline around every line fragment of the value: the fragments are measured, padded, made to meet
    // vertically, and traced as a single rounded polygon in an SVG placed over the chrome's first fragment.
    const draw = () => {
      const svg = shape.current; const chrome = svg?.parentElement; const slot = target.current?.querySelector('[data-lexical-slot]');
      if (!svg || !chrome || !slot) return;
      const PX = 6, PY = 3, R = 6;
      const lines: { l: number; r: number; t: number; b: number }[] = [];
      for (const c of slot.getClientRects()) {
        const last = lines[lines.length - 1];
        if (last && c.top < last.b && c.bottom > last.t) { last.l = Math.min(last.l, c.left); last.r = Math.max(last.r, c.right); last.t = Math.min(last.t, c.top); last.b = Math.max(last.b, c.bottom); }
        else lines.push({ l: c.left, r: c.right, t: c.top, b: c.bottom });
      }
      if (!lines.length) return;
      for (const ln of lines) { ln.l -= PX; ln.r += PX; ln.t -= PY; ln.b += PY; }
      for (let i = 1; i < lines.length; i++) { const mid = (lines[i - 1].b + lines[i].t) / 2; lines[i - 1].b = mid; lines[i].t = mid; }
      const pts: [number, number][] = [];
      for (const ln of lines) pts.push([ln.r, ln.t], [ln.r, ln.b]);
      for (let i = lines.length - 1; i >= 0; i--) pts.push([lines[i].l, lines[i].b], [lines[i].l, lines[i].t]);
      // Drop repeated and collinear points so every remaining vertex is a real corner.
      const clean: [number, number][] = [];
      for (const p of pts) { const q = clean[clean.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) clean.push(p); }
      const corners = clean.filter((p, i) => { const a = clean[(i + clean.length - 1) % clean.length]; const b = clean[(i + 1) % clean.length]; return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); });
      const minX = Math.min(...corners.map((p) => p[0])), minY = Math.min(...corners.map((p) => p[1]));
      const maxX = Math.max(...corners.map((p) => p[0])), maxY = Math.max(...corners.map((p) => p[1]));
      // Rounded corners: each corner is cut short by r on both sides and bridged with a quadratic curve.
      let d = '';
      const n = corners.length;
      for (let i = 0; i < n; i++) {
        const a = corners[(i + n - 1) % n], p = corners[i], b = corners[(i + 1) % n];
        const r = Math.min(R, Math.hypot(p[0] - a[0], p[1] - a[1]) / 2, Math.hypot(b[0] - p[0], b[1] - p[1]) / 2);
        const inn: [number, number] = [p[0] + Math.sign(a[0] - p[0]) * r, p[1] + Math.sign(a[1] - p[1]) * r];
        const out: [number, number] = [p[0] + Math.sign(b[0] - p[0]) * r, p[1] + Math.sign(b[1] - p[1]) * r];
        const f = (x: number, y: number) => `${(x - minX + 1).toFixed(1)} ${(y - minY + 1).toFixed(1)}`;
        d += (i ? `L ${f(...inn)} ` : `M ${f(...inn)} `) + `Q ${f(...p)} ${f(...out)} `;
      }
      d += 'Z';
      const first = chrome.getClientRects()[0];
      svg.style.left = `${minX - first.left - 1}px`; svg.style.top = `${minY - first.top - 1}px`;
      svg.setAttribute('width', `${maxX - minX + 2}`); svg.setAttribute('height', `${maxY - minY + 2}`);
      svg.setAttribute('viewBox', `0 0 ${maxX - minX + 2} ${maxY - minY + 2}`);
      svg.querySelector('path')?.setAttribute('d', d);
    };
    // A floating header is anchored to the value's first fragment, which can sit anywhere on the line. Keep
    // it inside the editor's box: shift it left when it would run past the right edge, right past the left.
    const clamp = () => {
      const el = head.current; const root = editor.getRootElement();
      if (!el || !root) return;
      el.style.transform = '';
      const h = el.getBoundingClientRect(); const r = root.getBoundingClientRect();
      const over = Math.max(0, h.right - (r.right - 4)); const under = Math.max(0, (r.left + 4) - h.left);
      if (over || under) el.style.transform = `translateX(${under - over}px)`;
      draw();
    };
    mount();
    window.addEventListener('resize', clamp);
    const off = mergeRegister(
      editor.registerMutationListener(ChipNode, (m) => { if (m.get(nodeKey) === 'updated') mount(); }),
      editor.registerUpdateListener(clamp),
    );
    return () => { off(); window.removeEventListener('resize', clamp); };
  }, [editor, nodeKey]);
  useEffect(() => editor.registerUpdateListener(({ editorState }) => editorState.read(() => {
    const chip = $getNodeByKey(nodeKey);
    if ($isChipNode(chip)) setSlotState(chip.getSlotIndex());
  })), [editor, nodeKey]);
  const ph = store.placeholders.find((p) => p.id === id);
  if (!ph) return null;
  const slots = slotsOf(ph);
  const step = (d: number) => editor.update(() => {
    const chip = $getNodeByKey(nodeKey);
    if (!$isChipNode(chip)) return;
    const next = (chip.getSlotIndex() + d + slots.length) % slots.length;
    chip.setSlotIndex(next);
    $fillSlot(chip, slots[next].text).selectEnd();
    store.log(`${ph.name} → ${slots[next].label}`);
  });
  const collapse = () => editor.update(() => {
    const chip = $getNodeByKey(nodeKey);
    if ($isChipNode(chip)) { $collapseChip(chip); store.log(`collapse ${ph.name} (slot)`); }
  });
  const stop = (e: MouseEvent) => e.preventDefault();
  return (
    <span className={`slot-chrome slot-chrome-${OptionsRef.current.treatment}`} style={{ '--accent': COLORS[id] } as CSSProperties}>
      <span ref={head} className="region-head" onMouseDown={stop}>
        <button type="button" onClick={() => step(-1)} disabled={slots.length < 2} aria-label="Previous"><ChevronLeft size={12} /></button>
        <span className="region-name">{ph.name}</span>
        <span className="region-slot">{slots[slot]?.label} · {slot + 1}/{slots.length}</span>
        <button type="button" onClick={() => step(1)} disabled={slots.length < 2} aria-label="Next"><ChevronRight size={12} /></button>
        <button type="button" onClick={collapse} aria-label="Collapse"><Minimize2 size={12} /></button>
      </span>
      <span ref={target} className="slot-target" />
      {OptionsRef.current.treatment === 'slot-float-shape' && (
        <svg ref={shape} className="slot-shape" aria-hidden><path /></svg>
      )}
    </span>
  );
}

function RegionHead({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const store = useContext(StoreContext);
  const [state, setState] = useState<{ id: string; slot: number } | null>(null);
  useEffect(() => {
    const read = () => editor.getEditorState().read(() => {
      const region = $getNodeByKey(nodeKey)?.getParent();
      if ($isRegionNode(region)) setState({ id: region.getId(), slot: region.getSlot() });
    });
    read();
    return editor.registerUpdateListener(read);
  }, [editor, nodeKey]);
  const ph = state && store.placeholders.find((p) => p.id === state.id);
  if (!ph || !state) return null;
  const slots = slotsOf(ph);
  const slot = slots[state.slot];
  const step = (d: number) => editor.update(() => {
    const region = $getNodeByKey(nodeKey)?.getParent();
    if (!$isRegionNode(region)) return;
    const next = (region.getSlot() + d + slots.length) % slots.length;
    region.setSlot(next);
    $fillRegion(region, slots[next].text);
    region.getLastChild()?.selectEnd();
    store.log(`${ph.name} → ${slots[next].label}`);
  });
  const collapse = () => editor.update(() => {
    const region = $getNodeByKey(nodeKey)?.getParent();
    if ($isRegionNode(region)) { $collapse(region); store.log(`collapse ${ph.name}`); }
  });
  // mousedown is swallowed so the click never moves the editor's caret out of the region body.
  const stop = (e: MouseEvent) => e.preventDefault();
  return (
    <span className="region-head" style={{ '--accent': COLORS[ph.id] } as CSSProperties} onMouseDown={stop}>
      <button type="button" onClick={() => step(-1)} disabled={slots.length < 2} aria-label="Previous"><ChevronLeft size={12} /></button>
      <span className="region-name">{ph.name}</span>
      <span className="region-slot">{slot?.label} · {state.slot + 1}/{slots.length}</span>
      <button type="button" onClick={() => step(1)} disabled={slots.length < 2} aria-label="Next"><ChevronRight size={12} /></button>
      <button type="button" onClick={collapse} aria-label="Collapse"><Minimize2 size={12} /></button>
    </span>
  );
}

/* ───────────────────────────── plugins ───────────────────────────── */

const $regionAround = (n: LexicalNode | null): RegionNode | null => {
  for (let cur = n; cur; cur = cur.getParent()) if ($isRegionNode(cur)) return cur;
  return null;
};

/** Sync: region bodies → store on every edit; store → unfocused regions; field text → onChange. */
function SyncPlugin({ onChange }: { onChange: (text: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const store = useContext(StoreContext);
  const storeRef = useRef(store);
  storeRef.current = store;
  useEffect(() => {
    editor.getEditorState().read(() => onChange($serializeField()));
    return editor.registerUpdateListener(({ editorState }) => {
    editorState.read(() => {
      onChange($serializeField());
      const push = (id: string, slot: number, text: string | null) => {
        const ph = storeRef.current.placeholders.find((p) => p.id === id);
        if (ph && text != null && slotsOf(ph)[slot]?.text !== text) storeRef.current.setSlot(ph.id, slot, text);
      };
      for (const region of $nodesOfType(RegionNode)) push(region.getId(), region.getSlot(), $regionText(region));
      for (const chip of $nodesOfType(ChipNode)) if (chip.isExpanded()) push(chip.getId(), chip.getSlotIndex(), $slotText(chip));
    });
    });
  }, [editor, onChange]);
  // Store → region/slot, only when the caret is not inside it (the other editor, or the store panel).
  useEffect(() => {
    editor.update(() => {
      const sel = $getSelection();
      const hasFocus = !!editor.getRootElement()?.contains(document.activeElement);
      const focused = $isRangeSelection(sel) ? $regionAround(sel.anchor.getNode()) : null;
      const want = (id: string, slot: number) => {
        const ph = store.placeholders.find((p) => p.id === id);
        return ph ? slotsOf(ph)[slot]?.text ?? '' : '';
      };
      for (const region of $nodesOfType(RegionNode)) {
        if (region === focused && hasFocus) continue;
        const w = want(region.getId(), region.getSlot());
        if ($regionText(region) !== w) $fillRegion(region, w);
      }
      const frame = $getSelectionSlotFrame(sel);
      for (const chip of $nodesOfType(ChipNode)) {
        if (!chip.isExpanded()) continue;
        if (hasFocus && frame && $getSlot(chip, SLOT)?.is(frame)) continue;
        const w = want(chip.getId(), chip.getSlotIndex());
        if ($slotText(chip) !== w) $fillSlot(chip, w);
      }
    });
  }, [editor, store.placeholders]);
  return null;
}

/** Character offset of a collapsed caret inside a region body, or null when the caret is not in it. */
function $caretOffsetIn(region: RegionNode, sel: RangeSelection): number | null {
  const node = sel.anchor.getNode();
  if (node.is(region)) {
    // Element-level point: offset counts children; the head is child 0.
    return sel.anchor.offset <= 1 ? 0 : $regionText(region).length;
  }
  let n = 0;
  for (const c of region.getChildren()) {
    if (c.is(node)) return n + sel.anchor.offset;
    if ($isRegionHeadNode(c)) continue;
    n += $isLineBreakNode(c) ? 1 : $isChipNode(c) ? tokenOf(c.getId()).length : c.getTextContent().length;
  }
  return null;
}

/** Boundary rules: backspace at a region's start, delete at its end, a selection across its edge, Enter. */
function BoundaryPlugin({ singleLine }: { singleLine: boolean }) {
  const [editor] = useLexicalComposerContext();
  const store = useContext(StoreContext);
  useEffect(() => mergeRegister(
    editor.registerCommand(DELETE_CHARACTER_COMMAND, (backward) => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return false;
      const a = $regionAround(sel.anchor.getNode());
      const f = $regionAround(sel.focus.getNode());
      if (!sel.isCollapsed() && a !== f) {
        store.log(`delete across a region edge → ${OptionsRef.current.boundaryDelete}`);
        if (OptionsRef.current.boundaryDelete === 'block') return true;
        // Collapse: the region becomes its chip again; Lexical then deletes what the selection still covers.
        for (const r of [a, f]) if (r) $collapse(r);
        return false;
      }
      if (!a || !sel.isCollapsed()) return false;
      const offset = $caretOffsetIn(a, sel);
      if (offset == null) return false;
      if (backward && offset === 0) { store.log('backspace at region start → blocked'); return true; }
      if (!backward && offset >= $regionText(a).length) { store.log('delete at region end → blocked'); return true; }
      return false;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ENTER_COMMAND, (event) => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return false;
      // Inside a named slot Lexical owns Enter: a no-op in a bare paragraph, a new paragraph in the box.
      if ($getSelectionSlotFrame(sel)) { store.log('Enter in slot → Lexical'); return false; }
      if ($regionAround(sel.anchor.getNode())) {
        event?.preventDefault();
        if (OptionsRef.current.enterInRegion === 'block') { store.log('Enter in region → blocked'); return true; }
        editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
        store.log('Enter in region → line break');
        return true;
      }
      if (singleLine) { event?.preventDefault(); store.log('Enter in name field → blocked'); return true; }
      return false;
    }, COMMAND_PRIORITY_HIGH),
    // A paragraph split inside an inline region would tear it in two; one region is one value.
    editor.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
      const sel = $getSelection();
      return $isRangeSelection(sel) && !!$regionAround(sel.anchor.getNode());
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(COPY_COMMAND, () => { store.log('copy'); return false; }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(PASTE_COMMAND, () => { store.log('paste'); return false; }, COMMAND_PRIORITY_HIGH),
  ), [editor, store, singleLine]);
  return null;
}

/** Lets the page's scenario buttons expand the first chip of a placeholder in a named field. */
const expanders: Record<string, (id: string) => void> = {};
function ExpandHook({ name }: { name: string }) {
  const [editor] = useLexicalComposerContext();
  const store = useContext(StoreContext);
  useEffect(() => {
    expanders[name] = (id) => {
      let key: NodeKey | null = null;
      editor.update(() => {
        const chip = $nodesOfType(ChipNode).find((c) => c.getId() === id);
        if (chip) { key = chip.getKey(); $expand(key, store); }
      }, { discrete: true });
      if (key) focusChip(editor, key); else editor.focus();
    };
  }, [editor, store, name]);
  return null;
}

/* ───────────────────────────── field ───────────────────────────── */

function Field({ label, initial, singleLine, onChange }: { label: string; initial: string; singleLine: boolean; onChange: (t: string) => void }) {
  const config = useMemo(() => ({
    namespace: `proto-${label}`,
    nodes: [ChipNode, RegionNode, RegionHeadNode, SlotBoxNode],
    onError: (e: Error) => { throw e; },
    editorState: () => { const p = $createParagraphNode(); p.append(...$parseInline(initial)); $getRoot().append(p); },
  }), [label, initial]);
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <LexicalComposer initialConfig={config}>
        <PlainTextPlugin
          contentEditable={<ContentEditable className={`editor ${singleLine ? 'editor-line' : 'editor-prose'}`} />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <SyncPlugin onChange={onChange} />
        <BoundaryPlugin singleLine={singleLine} />
        <ExpandHook name={label} />
      </LexicalComposer>
    </div>
  );
}

/* ───────────────────────────── page ───────────────────────────── */

const SCENARIOS: { title: string; watch: string; steps: { label: string; run?: () => void }[] }[] = [
  { title: '1 · Expand and edit',
    watch: 'Click the Hair chip in the description, or press the step. Type inside the box. The store panel and the Name field\'s Hair chip tooltip must follow every keystroke. The field\'s stored text on the right must keep showing {{ph:hair}}, never your typing.',
    steps: [{ label: 'Expand Hair in the description', run: () => expanders.Description?.('hair') }] },
  { title: '2 · Chevrons across values and pins',
    watch: 'Use ‹ › in the header. Values 1–3 come first, then the pin from Trait › Northern. An edit on the pin must land on the pin, not on a value.',
    steps: [{ label: 'Expand Hair', run: () => expanders.Description?.('hair') }] },
  { title: '3 · Boundaries',
    watch: 'Caret at the very start of the box: Backspace must not eat the header or the text before the box. Caret at the very end: Delete must not eat the text after. Type at the left edge: does the letter land inside or outside (toggle edgeTyping)? Select from outside into the box and press Delete (toggle boundaryDelete).',
    steps: [{ label: 'Expand Mood', run: () => expanders.Description?.('mood') }] },
  { title: '4 · Multiline value in a one-line field',
    watch: 'Expand Hair in the Name field, press Enter inside the box. Does the one-line field survive a line break inside the region? Compare the enterInRegion toggle.',
    steps: [{ label: 'Expand Hair in the name field', run: () => expanders.Name?.('hair') }] },
  { title: '5 · Same chip twice',
    watch: 'The description holds Hair twice. Expanding the second collapses the first. Edit one, collapse it, expand the other: same text.',
    steps: [{ label: 'Expand the first Hair', run: () => expanders.Description?.('hair') }] },
  { title: '6 · Copy, cut, paste, undo',
    watch: 'Select across the whole box and copy, then paste elsewhere. Does the paste bring text, a chip, or a second live box? Ctrl+Z after typing in the box: does the store follow the undo?',
    steps: [{ label: 'Expand Hair', run: () => expanders.Description?.('hair') }] },
];

function App() {
  const [placeholders, setPlaceholders] = useState(INITIAL);
  const [log, setLog] = useState<string[]>([]);
  const [options, setOptions] = useState<Options>(OptionsRef.current);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [scenario, setScenario] = useState(0);
  const [epoch, setEpoch] = useState(0);
  OptionsRef.current = options;
  const store = useMemo<Store>(() => ({
    placeholders,
    setSlot: (id, slot, text) => setPlaceholders((prev) => prev.map((p) => (p.id === id ? withSlot(p, slot, text) : p))),
    log: (line) => setLog((prev) => [line, ...prev].slice(0, 30)),
  }), [placeholders]);
  const reset = () => { setPlaceholders(INITIAL); setLog([]); setEpoch((e) => e + 1); };
  const opt = <K extends keyof Options>(key: K, values: Options[K][]) => (
    <label className="opt">{key}
      <select value={options[key]} onChange={(e) => { setOptions({ ...options, [key]: e.target.value }); setEpoch((x) => x + 1); }}>
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
  return (
    <StoreContext.Provider value={store}>
      <h1>Inline placeholder expansion <span className="tag">PROTOTYPE</span></h1>
      <p className="question">
        <b>Question:</b> can a chip expand into its value inside the same Lexical editor, with the value written to the
        placeholder store and the field still serializing to the chip token? Which boundary behaviors work as they are,
        and which need a rule? Click a chip to expand it. The last header button collapses it. Changing an option
        resets the fields.
      </p>
      <div className="options">
        {opt('treatment', ['boxed', 'ownline', 'underline', 'slot', 'slot-float', 'slot-float-v', 'slot-float-vh', 'slot-float-shape', 'slot-stack', 'slot-block'])}
        {opt('edgeTyping', ['outside', 'inside'])}
        {opt('boundaryDelete', ['block', 'collapse'])}
        {opt('enterInRegion', ['linebreak', 'block'])}
        <button type="button" className="reset" onClick={reset}>Reset everything</button>
      </div>
      <div className="tabs">
        {SCENARIOS.map((s, i) => <button key={s.title} type="button" className={i === scenario ? 'active' : ''} onClick={() => setScenario(i)}>{s.title}</button>)}
      </div>
      <div className="scenario">
        <p>{SCENARIOS[scenario].watch}</p>
        {SCENARIOS[scenario].steps.map((st) => <button key={st.label} type="button" disabled={!st.run} onClick={st.run}>{st.label}</button>)}
      </div>
      <div className="cols">
        <div className="col" key={epoch}>
          <Field label="Description" singleLine={false}
            initial={'She has {{ph:hair}} and is {{ph:mood}}. Everyone in Sedge Landing knows {{ph:name}} by her {{ph:hair}}, even at night.'}
            onChange={(t) => setFields((f) => (f.Description === t ? f : { ...f, Description: t }))} />
          <Field label="Name" singleLine
            initial={'{{ph:name}} of the {{ph:hair}}'}
            onChange={(t) => setFields((f) => (f.Name === t ? f : { ...f, Name: t }))} />
          <div className="panel">
            <div className="panel-title">Placeholder store (the record every chip resolves through)</div>
            {placeholders.map((ph) => (
              <div key={ph.id} className="ph">
                <span className="chip" style={{ background: COLORS[ph.id] }}>{ph.name}</span>
                {slotsOf(ph).map((s, i) => (
                  <label key={s.label} className="slot"><span>{s.label}</span>
                    <input value={s.text} onChange={(e) => store.setSlot(ph.id, i, e.target.value)} />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="col">
          <div className="panel">
            <div className="panel-title">What each field stores (must never contain value text)</div>
            {Object.entries(fields).map(([k, v]) => <div key={k} className="stored"><b>{k}</b><code>{v}</code></div>)}
          </div>
          <div className="panel">
            <div className="panel-title">Event log</div>
            <ol className="log">{log.map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}</ol>
          </div>
        </div>
      </div>
    </StoreContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
