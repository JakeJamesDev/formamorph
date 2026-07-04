// Extract the Stable Diffusion positive prompt embedded in an uploaded PNG, across the common tools.
// There's no single universal format, so we read all PNG text chunks (tEXt + uncompressed iTXt) and try,
// in order:
//   1. A1111 / Forge / Fooocus — a flat `parameters` blob: "<positive>\nNegative prompt: …".
//   2. JSON tools (InvokeAI `invokeai_metadata.positive_prompt`, NovelAI `Comment.prompt`, etc.) — any
//      chunk that parses as JSON and carries a positive-prompt string field.
// ComfyUI stores a node-graph JSON with no flat prompt field; traversing it is out of scope for now.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const isPng = (bytes: Uint8Array): boolean =>
  bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b);

/** All PNG text chunks as keyword→value (tEXt + uncompressed iTXt). Empty for non-PNG. */
function readPngTextChunks(bytes: Uint8Array): Map<string, string> {
  const map = new Map<string, string>();
  if (!isPng(bytes)) return map;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const latin1 = new TextDecoder('latin1');
  const utf8 = new TextDecoder('utf-8');
  let pos = 8; // skip the signature
  while (pos + 8 <= bytes.length) {
    const length = view.getUint32(pos);
    const type = latin1.decode(bytes.subarray(pos + 4, pos + 8));
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) break; // truncated/invalid
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === 'tEXt') {
      // keyword \0 text (Latin-1)
      const nul = data.indexOf(0);
      if (nul !== -1) map.set(latin1.decode(data.subarray(0, nul)), latin1.decode(data.subarray(nul + 1)));
    } else if (type === 'iTXt') {
      // keyword \0 compressionFlag compressionMethod languageTag \0 translatedKeyword \0 text (UTF-8)
      const kEnd = data.indexOf(0);
      if (kEnd !== -1 && data[kEnd + 1] === 0) { // only uncompressed
        const langEnd = data.indexOf(0, kEnd + 3);
        const transEnd = langEnd !== -1 ? data.indexOf(0, langEnd + 1) : -1;
        if (transEnd !== -1) map.set(latin1.decode(data.subarray(0, kEnd)), utf8.decode(data.subarray(transEnd + 1)));
      }
    }
    if (type === 'IEND') break;
    pos = dataEnd + 4; // skip the 4-byte CRC
  }
  return map;
}

/** A1111-style blob → the text before the "Negative prompt:" line (or the whole thing), trimmed. */
function positiveBeforeNegative(text: string): string | null {
  const negIdx = text.indexOf('\nNegative prompt:');
  const positive = (negIdx === -1 ? text : text.slice(0, negIdx)).trim();
  return positive || null;
}

// Ordered by preference; the first string field found wins. `prompt` last so a flat string is used but a
// ComfyUI-style graph object under `prompt` is skipped (not a string).
const POSITIVE_KEYS = ['positive_prompt', 'positive', 'prompt'];

/** If `value` is JSON carrying a positive-prompt string field, return it (InvokeAI, NovelAI, …). */
function positiveFromJson(value: string): string | null {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  for (const key of POSITIVE_KEYS) {
    if (typeof obj[key] === 'string' && (obj[key] as string).trim()) return (obj[key] as string).trim();
  }
  return null;
}

// --- ComfyUI: the `prompt` chunk is the API node graph { id: { class_type, inputs } }. There's no flat
// prompt field, so walk from a node's `positive` conditioning link back to the CLIPTextEncode `text`.

interface ComfyNode { class_type?: string; inputs?: Record<string, unknown> }
type ComfyGraph = Record<string, ComfyNode>;
/** A link input references another node's output: [nodeId, outputIndex]. */
const isLink = (v: unknown): v is [string | number, number] =>
  Array.isArray(v) && v.length === 2 && (typeof v[0] === 'string' || typeof v[0] === 'number');

/** Follow links backward from a node to the first text string (CLIPTextEncode/SDXL/efficiency loader). */
function resolveComfyText(graph: ComfyGraph, id: string, visited: Set<string>, depth: number): string | null {
  if (depth > 8 || visited.has(id)) return null;
  visited.add(id);
  const inputs = graph[id]?.inputs;
  if (!inputs) return null;
  for (const key of ['text', 'text_g', 'positive']) {
    const v = inputs[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  for (const v of Object.values(inputs)) {
    if (isLink(v)) {
      const found = resolveComfyText(graph, String(v[0]), visited, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** If `value` is a ComfyUI API graph, resolve the positive prompt, else null. */
function positiveFromComfy(value: string): string | null {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const graph = parsed as ComfyGraph;
  const nodes = Object.values(graph);
  if (!nodes.some((n) => n && typeof n === 'object' && typeof n.class_type === 'string')) return null;

  // Start from any node whose `positive` conditioning is a link (KSampler/SamplerCustom/CFGGuider…).
  for (const [nid, node] of Object.entries(graph)) {
    const pos = node?.inputs?.positive;
    if (isLink(pos)) {
      const text = resolveComfyText(graph, String(pos[0]), new Set([nid]), 0);
      if (text) return text;
    }
  }
  // Fallback: an unambiguous single CLIPTextEncode.
  const encoders = Object.keys(graph).filter((id) => graph[id]?.class_type === 'CLIPTextEncode');
  if (encoders.length === 1) {
    const t = graph[encoders[0]]?.inputs?.text;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}

/** The positive prompt embedded in a PNG by the generating tool, or null when none is found. */
export function extractSdPrompt(bytes: Uint8Array): string | null {
  const chunks = readPngTextChunks(bytes);
  const a1111 = chunks.get('parameters');
  if (a1111) {
    const p = positiveBeforeNegative(a1111);
    if (p) return p;
  }
  for (const value of chunks.values()) {
    const p = positiveFromJson(value);
    if (p) return p;
  }
  // ComfyUI stores its prompt as a node graph — prefer the `prompt` chunk, else scan for any graph.
  const comfy = chunks.get('prompt');
  if (comfy) {
    const p = positiveFromComfy(comfy);
    if (p) return p;
  }
  for (const value of chunks.values()) {
    const p = positiveFromComfy(value);
    if (p) return p;
  }
  return null;
}

/** Read a File's bytes and pull out its embedded positive prompt (null if none / not a PNG). */
export async function readSdPromptFromFile(file: File): Promise<string | null> {
  try {
    return extractSdPrompt(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return null;
  }
}
