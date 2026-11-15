// The seed correction view's file and edit logic, with no DOM. seed-editor.html loads it as a classic script;
// the tests require it. Offsets are code points, as Python indexes the text.
(function (root) {
  'use strict';

  const REQUIRED = ['id', 'text', 'clusters'];

  const length = (text) => Array.from(text).length;

  /** Problems with one passage, as short sentences. Empty when the passage is valid. */
  function validate(p) {
    const problems = [];
    for (const key of REQUIRED) if (!(key in p)) problems.push(`lacks "${key}"`);
    if (typeof p.text !== 'string' || !Array.isArray(p.clusters)) return problems.length ? problems : ['has a bad shape'];
    const n = length(p.text);
    const seen = new Set();
    p.clusters.forEach((c, ci) => {
      if (!Array.isArray(c) || c.length === 0) return problems.push(`cluster ${ci + 1} is empty`);
      for (const span of c) {
        const [s, e] = Array.isArray(span) ? span : [];
        if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e > n || s >= e) problems.push(`cluster ${ci + 1} has a bad span ${JSON.stringify(span)}`);
        else if (seen.has(`${s}:${e}`)) problems.push(`span [${s}, ${e}) is in two clusters`);
        else seen.add(`${s}:${e}`);
      }
    });
    return problems;
  }

  /** Passages from a JSON Lines file, and an error per bad line. */
  function parseFile(content) {
    const passages = [];
    const errors = [];
    const ids = new Set();
    content.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      let p;
      try {
        p = JSON.parse(line);
      } catch {
        errors.push(`line ${i + 1}: not JSON`);
        return;
      }
      const problems = validate(p);
      if (ids.has(p.id)) problems.push(`repeats id ${p.id}`);
      if (problems.length) errors.push(`line ${i + 1}: ${problems.join('; ')}`);
      else {
        ids.add(p.id);
        passages.push(p);
      }
    });
    return { passages, errors };
  }

  /** The file text: one passage per line, spans sorted, empty clusters dropped. Throws on an invalid passage. */
  function serialize(passages) {
    const ids = new Set();
    return passages.map((p) => {
      const clean = { ...p, clusters: tidy(p.clusters) };
      const problems = validate(clean);
      if (ids.has(p.id)) problems.push(`repeats id ${p.id}`);
      if (problems.length) throw new Error(`${p.id}: ${problems.join('; ')}`);
      ids.add(p.id);
      return JSON.stringify(clean);
    }).join('\n') + '\n';
  }

  const bySpan = (a, b) => a[0] - b[0] || a[1] - b[1];

  /** Clusters with their spans sorted, empty ones dropped, in order of first mention. */
  function tidy(clusters) {
    return clusters.filter((c) => c.length).map((c) => [...c].sort(bySpan)).sort((a, b) => bySpan(a[0], b[0]));
  }

  /** The span trimmed of surrounding whitespace, or null when nothing is left. */
  function trimSpan(text, s, e) {
    const chars = Array.from(text);
    while (s < e && /\s/.test(chars[s])) s++;
    while (e > s && /\s/.test(chars[e - 1])) e--;
    return s < e ? [s, e] : null;
  }

  const without = (clusters, s, e) => clusters.map((c) => c.filter(([a, b]) => a !== s || b !== e));

  /** The passage with span [s, e) in cluster `target`: an index, "new", or null to drop the span. */
  function placeSpan(p, s, e, target) {
    let clusters = without(p.clusters, s, e);
    if (target === 'new') clusters = [...clusters, [[s, e]]];
    else if (target !== null) {
      // Leaving a cluster keeps every index, so `target` is the cluster's place as displayed.
      clusters = clusters.map((c, i) => (i === target ? [...c, [s, e]] : c));
    }
    return { ...p, clusters: tidy(clusters) };
  }

  /** The passage with cluster `from` merged into cluster `into`. */
  function mergeClusters(p, from, into) {
    if (from === into) return p;
    const clusters = p.clusters.map((c, i) => (i === into ? [...c, ...p.clusters[from]] : i === from ? [] : c));
    return { ...p, clusters: tidy(clusters) };
  }

  /**
   * The text cut at every word edge and mention edge, for display: [{s, e, text, mentions}], where mentions are
   * [cluster, s, e] of each span covering the piece, innermost first.
   */
  function segments(text, clusters) {
    const chars = Array.from(text);
    const cuts = new Set([0, chars.length]);
    const word = /[\p{L}\p{N}]+|\s+|[^\p{L}\p{N}\s]/gu;
    let offset = 0;
    for (const m of text.matchAll(word)) {
      const n = Array.from(m[0]).length;
      cuts.add(offset);
      cuts.add(offset + n);
      offset += n;
    }
    const spans = clusters.flatMap((c, ci) => c.map(([s, e]) => [ci, s, e]));
    for (const [, s, e] of spans) {
      cuts.add(s);
      cuts.add(e);
    }
    const sorted = [...cuts].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 1 < sorted.length; i++) {
      const [s, e] = [sorted[i], sorted[i + 1]];
      const mentions = spans.filter(([, a, b]) => a <= s && e <= b).sort((x, y) => (x[2] - x[1]) - (y[2] - y[1]));
      out.push({ s, e, text: chars.slice(s, e).join(''), mentions });
    }
    return out;
  }

  const api = { validate, parseFile, serialize, tidy, trimSpan, placeSpan, mergeClusters, segments };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SeedEditor = api;
})(this);
