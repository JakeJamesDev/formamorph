// Summarizes a V8 .heapsnapshot: retained size per object from the dominator tree, the shortest retaining path
// for the largest ones, and big strings grouped by path. `node testing/editor-speed/heapRetainers.mjs <file>`.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Read the unsigned integers of the JSON array that starts after `key` in `buf`. */
function readNumbers(buf, key, count) {
  let i = buf.indexOf(key);
  if (i < 0) throw new Error(`snapshot has no ${key}`);
  i = buf.indexOf(0x5b, i) + 1; // '['
  const out = new Float64Array(count);
  let n = 0, cur = 0, inNum = false;
  for (; ; i++) {
    const c = buf[i];
    if (c >= 0x30 && c <= 0x39) { cur = cur * 10 + (c - 0x30); inNum = true; continue; }
    if (inNum) { out[n++] = cur; cur = 0; inNum = false; }
    if (c === 0x5d) break; // ']'
  }
  if (n !== count) throw new Error(`${key}: read ${n} numbers, expected ${count}`);
  return out;
}

/** Parse a snapshot into flat arrays. Reads the numeric sections from bytes, so files over V8's string cap work. */
export async function loadSnapshot(file) {
  const buf = await readFile(file);
  const headEnd = buf.indexOf('"nodes"');
  const head = JSON.parse(buf.subarray(0, headEnd).toString('utf8').replace(/,\s*$/, '') + '}');
  const { meta, node_count: nodeCount, edge_count: edgeCount } = head.snapshot;
  const nf = meta.node_fields, ef = meta.edge_fields;
  const nodes = readNumbers(buf, '"nodes"', nodeCount * nf.length);
  const edges = readNumbers(buf, '"edges"', edgeCount * ef.length);
  const sStart = buf.indexOf('[', buf.indexOf('"strings":'));
  const sEnd = buf.lastIndexOf(']');
  const strings = JSON.parse(buf.subarray(sStart, sEnd + 1).toString('utf8'));
  return { meta, nodeCount, nodes, edges, strings };
}

/** Retained sizes, dominators and shortest retaining paths for a loaded snapshot. */
export function analyze({ meta, nodeCount, nodes, edges, strings }) {
  const nf = meta.node_fields, ef = meta.edge_fields;
  const NF = nf.length, EF = ef.length;
  const nType = nf.indexOf('type'), nName = nf.indexOf('name'), nSelf = nf.indexOf('self_size'), nEdges = nf.indexOf('edge_count');
  const eType = ef.indexOf('type'), eName = ef.indexOf('name_or_index'), eTo = ef.indexOf('to_node');
  const nodeTypes = meta.node_types[0], edgeTypes = meta.edge_types[0];
  const WEAK = edgeTypes.indexOf('weak'), SHORTCUT = edgeTypes.indexOf('shortcut');
  const ELEMENT = edgeTypes.indexOf('element'), HIDDEN = edgeTypes.indexOf('hidden');

  const firstEdge = new Uint32Array(nodeCount + 1);
  for (let n = 0, e = 0; n < nodeCount; n++) { firstEdge[n] = e; e += nodes[n * NF + nEdges] * EF; }
  firstEdge[nodeCount] = edges.length;
  // As DevTools does: weak edges never retain; shortcut edges retain only from the root, where they mark user globals.
  const essential = (e) => edges[e + eType] !== WEAK && (edges[e + eType] !== SHORTCUT || e < firstEdge[1]);

  // Depth-first postorder from the root (node 0) over essential edges.
  const post = new Int32Array(nodeCount).fill(-1);
  const order = new Uint32Array(nodeCount);
  const visited = new Uint8Array(nodeCount);
  const stackNode = new Uint32Array(nodeCount), stackEdge = new Float64Array(nodeCount);
  let sp = 0, count = 0;
  stackNode[0] = 0; stackEdge[0] = firstEdge[0]; visited[0] = 1;
  while (sp >= 0) {
    const n = stackNode[sp], e = stackEdge[sp];
    if (e < firstEdge[n + 1]) {
      stackEdge[sp] = e + EF;
      if (!essential(e)) continue;
      const to = edges[e + eTo] / NF;
      if (visited[to]) continue;
      visited[to] = 1;
      sp++; stackNode[sp] = to; stackEdge[sp] = firstEdge[to];
    } else {
      post[n] = count; order[count++] = n; sp--;
    }
  }

  // Predecessors over essential edges, as a CSR list.
  const predCount = new Uint32Array(nodeCount + 1);
  for (let n = 0; n < nodeCount; n++) {
    if (post[n] < 0) continue;
    for (let e = firstEdge[n]; e < firstEdge[n + 1]; e += EF) if (essential(e)) predCount[edges[e + eTo] / NF]++;
  }
  const predStart = new Uint32Array(nodeCount + 1);
  for (let n = 0; n < nodeCount; n++) predStart[n + 1] = predStart[n] + predCount[n];
  const preds = new Uint32Array(predStart[nodeCount]);
  const fill = predStart.slice(0, nodeCount);
  for (let n = 0; n < nodeCount; n++) {
    if (post[n] < 0) continue;
    for (let e = firstEdge[n]; e < firstEdge[n + 1]; e += EF) if (essential(e)) preds[fill[edges[e + eTo] / NF]++] = n;
  }

  // Cooper-Harvey-Kennedy iterative dominators, indexed by postorder number.
  const root = post[0];
  const idom = new Int32Array(count).fill(-1);
  idom[root] = root;
  for (let changed = true; changed;) {
    changed = false;
    for (let p = count - 2; p >= 0; p--) {
      const n = order[p];
      let best = -1;
      for (let k = predStart[n]; k < predStart[n + 1]; k++) {
        let q = post[preds[k]];
        if (q < 0 || idom[q] < 0) continue;
        if (best < 0) { best = q; continue; }
        let a = q, b = best;
        while (a !== b) { while (a < b) a = idom[a]; while (b < a) b = idom[b]; }
        best = a;
      }
      if (best >= 0 && idom[p] !== best) { idom[p] = best; changed = true; }
    }
  }

  const retained = new Float64Array(count);
  for (let p = 0; p < count; p++) retained[p] = nodes[order[p] * NF + nSelf];
  for (let p = 0; p < count - 1; p++) if (idom[p] >= 0 && idom[p] !== p) retained[idom[p]] += retained[p];

  // Shortest retaining path from the root, by breadth-first search over essential edges.
  const parentNode = new Int32Array(nodeCount).fill(-1), parentEdge = new Float64Array(nodeCount);
  const queue = new Uint32Array(nodeCount);
  let qh = 0, qt = 0;
  queue[qt++] = 0; parentNode[0] = 0;
  while (qh < qt) {
    const n = queue[qh++];
    for (let e = firstEdge[n]; e < firstEdge[n + 1]; e += EF) {
      if (!essential(e)) continue;
      const to = edges[e + eTo] / NF;
      if (parentNode[to] >= 0) continue;
      parentNode[to] = n; parentEdge[to] = e; queue[qt++] = to;
    }
  }

  const typeOf = (n) => nodeTypes[nodes[n * NF + nType]];
  const nameOf = (n) => {
    const s = strings[nodes[n * NF + nName]] ?? '';
    const t = typeOf(n);
    if (t === 'string' || t === 'concatenated string' || t === 'sliced string') return `"${s.slice(0, 40)}${s.length > 40 ? '…' : ''}"`;
    return s.length > 60 ? s.slice(0, 60) + '…' : s || `(${t})`;
  };
  const edgeLabel = (e) => {
    const t = edges[e + eType], v = edges[e + eName];
    return t === ELEMENT || t === HIDDEN ? `[${v}]` : `.${strings[v]}`;
  };
  const pathTo = (n) => {
    const parts = [];
    let cur = n;
    for (; cur !== 0 && parts.length < 14; cur = parentNode[cur]) {
      if (parentNode[cur] < 0) return '(unreachable)';
      parts.unshift(edgeLabel(parentEdge[cur]));
      if (parentNode[cur] !== 0) parts[0] = `${nameOf(parentNode[cur])}${parts[0]}`;
    }
    return (cur !== 0 ? '… → ' : '') + parts.join(' → ');
  };
  return { count, order, post, idom, retained, nodes, NF, nSelf, typeOf, nameOf, pathTo, total: retained[root] };
}

const mb = (b) => Math.round(b / 1e5) / 10;

const TOP = 25;
const BIG_STRING_BYTES = 100_000;

/** Top retainers, top constructors by self size, and strings over 100 KB grouped by retaining path. */
export function summarize(a) {
  const { count, order, retained, nodes, NF, nSelf, typeOf, nameOf, pathTo } = a;
  const byRetained = [...Array(count - 1).keys()].sort((x, y) => retained[y] - retained[x]);
  const topRetainers = [];
  for (const p of byRetained) {
    const n = order[p];
    if (typeOf(n) === 'synthetic') continue;
    topRetainers.push({ retainedMb: mb(retained[p]), selfMb: mb(nodes[n * NF + nSelf]), type: typeOf(n), name: nameOf(n), path: pathTo(n) });
    if (topRetainers.length >= TOP) break;
  }

  const byClass = new Map();
  const bigStrings = new Map();
  for (let p = 0; p < count; p++) {
    const n = order[p], self = nodes[n * NF + nSelf], t = typeOf(n);
    const key = t === 'object' || t === 'native' || t === 'closure' ? `${t}:${nameOf(n)}` : t;
    const c = byClass.get(key) ?? { count: 0, bytes: 0 };
    c.count++; c.bytes += self; byClass.set(key, c);
    if (t.includes('string') && self >= BIG_STRING_BYTES) {
      // Group by path with array indices collapsed, so one row covers every image of a kind.
      const shape = pathTo(n).replace(/\[\d+\]/g, '[]').replace(/"[^"]*"/g, '"…"');
      const g = bigStrings.get(shape) ?? { count: 0, bytes: 0 };
      g.count++; g.bytes += self; bigStrings.set(shape, g);
    }
  }
  const rank = (m, k) => [...m].sort((x, y) => y[1].bytes - x[1].bytes).slice(0, k).map(([key, v]) => ({ key, count: v.count, mb: mb(v.bytes) }));
  return { totalMb: mb(a.total), topRetainers, topSelfByType: rank(byClass, 15), bigStringsByPath: rank(bigStrings, 15) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) throw new Error('usage: heapRetainers.mjs <file.heapsnapshot>');
  console.log(JSON.stringify(summarize(analyze(await loadSnapshot(file))), null, 2));
}
