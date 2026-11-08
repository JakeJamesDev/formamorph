// The candidate section orders for the choices prompt, applied to captured requests. Shared by the choices
// cache probe and the choices order quality probe.
//
//   Arm A = as captured.
//   Arm B = the fixed instructions (from 'The player character is "I"' to the end) moved right after the role
//           header; the world blocks keep their order.
//   Arm C = Arm B, plus the stat-bearing blocks (Global Stats, Player Stats, Player Character) moved last.
//   Arm D = Arm C, plus FORMAT_RECAP at the end of the user message.

const STATIC_MARKER = '\n\nThe player character is "I"';
const STAT_BLOCKS = new Set(['Global Stats', 'Player Stats', 'Player Character']);

/** Arm D's reminder, next to where the model writes, for the rules that moved away from it. */
export const FORMAT_RECAP = 'Reply with 3 to 5 lines and nothing else: each one short action that starts with "I".';

/** Every captured choices request in a dump, in turn order. */
export function choicesRequests(dump) {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'choices' && Array.isArray(node.messages)) found.push(node);
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(dump);
  return found;
}

/** A system prompt split into role header, `## ` world blocks, and the fixed instructions. */
export function sections(system) {
  const at = system.indexOf(STATIC_MARKER);
  if (at < 0) return null;
  const head = system.slice(0, at);
  const firstBlock = head.indexOf('\n## ');
  const header = firstBlock < 0 ? head : head.slice(0, firstBlock);
  const body = firstBlock < 0 ? '' : head.slice(firstBlock + 1);
  const blocks = body ? body.split(/\n(?=## )/).map((text) => ({ title: text.match(/^## (.+)/)?.[1] ?? '', text: text.replace(/\n+$/, '') })) : [];
  return { header: header.replace(/\n+$/, ''), blocks, instructions: system.slice(at).replace(/^\n+/, '') };
}

/** The system prompt laid out for one arm. A prompt without the fixed-instruction marker is sent as captured. */
export function relay(system, arm) {
  const parts = arm === 'A' ? null : sections(system);
  if (!parts) return system;
  const blocks = arm === 'B'
    ? parts.blocks
    : [...parts.blocks.filter((b) => !STAT_BLOCKS.has(b.title)), ...parts.blocks.filter((b) => STAT_BLOCKS.has(b.title))];
  return [parts.header, parts.instructions, ...blocks.map((b) => b.text)].join('\n\n');
}

/** A captured request's messages for one arm. */
export function messagesFor(request, arm) {
  const last = request.messages.length - 1;
  return request.messages.map((m, i) => {
    if (i === 0 && m.role === 'system') return { ...m, content: relay(m.content, arm) };
    if (arm === 'D' && i === last && m.role === 'user') return { ...m, content: `${m.content}\n${FORMAT_RECAP}` };
    return m;
  });
}
