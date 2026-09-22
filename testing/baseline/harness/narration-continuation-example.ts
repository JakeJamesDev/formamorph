import type { ProbeMessage } from './narration-tool-call-probe';

export const SELECTION_EXAMPLE: readonly ProbeMessage[] = [
  { role: 'user', content: 'Demonstration from a separate story. Location: an observatory archive. Entity summaries: Ysra, the archivist responsible for a sealed star atlas. Vell, a clockwork moth above the reading desk. Orsa, a courier waiting outside. Player action: I ask the archivist whether I may examine the atlas.' },
  { role: 'assistant', content: '', reasoning_content: 'The scene will include Ysra answering and Vell in the background; retrieve both entries.',
    tool_calls: ['Ysra', 'Vell'].map(name => ({ id: `example-${name}`, type: 'function' as const, function: { name: 'get_entity', arguments: JSON.stringify({ name }) } })) },
  { role: 'tool', tool_call_id: 'example-Ysra', content: JSON.stringify({ matches: [{ id: 'example-ysra', name: 'Ysra', description: 'Ysra wears indigo cuffs and keeps the atlas locked. She permits visitors to examine it only while she supervises. She speaks politely and precisely.' }] }) },
  { role: 'tool', tool_call_id: 'example-Vell', content: JSON.stringify({ matches: [{ id: 'example-vell', name: 'Vell', description: 'Vell is a clockwork moth with translucent amber wings. It flies without sound.' }] }) },
  { role: 'assistant', reasoning_content: 'Ysra permits access only under supervision, so her answer should offer a supervised viewing. Vell flies silently, so its movement adds no sound.',
    content: 'The archivist rests her indigo cuffs beside the locked atlas. "You may examine it here, while I attend you," she says. She unlocks the cover and makes room at the desk for you to look. Above it, a clockwork moth turns silently on translucent amber wings.' },
];

export const CONTINUATION_EXAMPLE: readonly ProbeMessage[] = [
  { role: 'user', content: 'Demonstration from a separate story. Location: an observatory archive. Entity summary: Ysra, the archivist responsible for a sealed star atlas. Player action: I ask the archivist whether I may examine the atlas.' },
  { role: 'assistant', content: '', reasoning_content: 'The request concerns Ysra; retrieve her entry.',
    tool_calls: [{ id: 'example-ysra', type: 'function', function: { name: 'get_entity', arguments: '{"name":"Ysra"}' } }] },
  { role: 'tool', tool_call_id: 'example-ysra', content: JSON.stringify({ matches: [{ id: 'example-ysra', name: 'Ysra', description: 'Ysra wears indigo cuffs and keeps the atlas locked. She permits visitors to examine it only while she supervises. She speaks politely and precisely.' }] }) },
  { role: 'assistant', reasoning_content: 'Ysra permits access only under supervision, so her answer should offer a supervised viewing.',
    content: 'The archivist rests her indigo cuffs beside the locked atlas. "You may examine it here, while I attend you," she says. She unlocks the cover and makes room at the desk for you to look.' },
];

export const EXPANDED_CONTINUATION_EXAMPLE: readonly ProbeMessage[] = CONTINUATION_EXAMPLE.map(message => {
  if (message.role !== 'assistant') return message;
  return { ...message, reasoning_content: message.tool_calls
    ? `The player wants to ask the archivist whether they may examine the sealed star atlas.

Current setting: an observatory archive.
Available entity: Ysra, the archivist responsible for the atlas.
The request concerns Ysra. Her summary identifies her role, and I should retrieve her full entry before narrating her response.

Plan:
1. Identify the archivist as Ysra.
2. Retrieve Ysra's full entry.
3. Use her details to narrate the answer to the player's request.`
    : `The player wants to examine the sealed star atlas. I have retrieved Ysra's full entry.

Current setting: an observatory archive.
Relevant entity: Ysra, the archivist responsible for the atlas.
Retrieved details:
- She wears indigo cuffs.
- She keeps the atlas locked.
- She permits visitors to examine it only while she supervises.
- She speaks politely and precisely.

The player's request is for access to the atlas. Ysra permits access under supervision, so she can offer a supervised viewing.

Narration plan:
1. Describe the archivist beside the locked atlas, including her indigo cuffs.
2. Have her politely offer a viewing while she attends the player.
3. Have her unlock the cover and make room at the desk.

I will narrate the supervised viewing using these details.` };
});
