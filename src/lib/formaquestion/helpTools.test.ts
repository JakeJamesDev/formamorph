import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { helpTool as tool } from '@/test/helpFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_FACE } from './helpFace';
import { HELP_ROLL } from './helpRoll';
import {
  deleteHelpTool, dropHelpToolSwitch, HELP_FIXED_FUNCTIONS, HELP_RESERVED_TOOL_NAMES, helpToolsOn, parseHelpTools, parseHelpToolSwitches, saveHelpTool,
} from './helpTools';

describe('the fixed functions of a help request', () => {
  it('are the guide lookup, the dice roll and the face call, and their names are the reserved Tool names', () => {
    expect(HELP_FIXED_FUNCTIONS).toEqual([DOCS_LOOKUP, HELP_ROLL, HELP_FACE]);
    expect(HELP_RESERVED_TOOL_NAMES).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name, HELP_FACE.name]);
  });

  it('refuse a Tool named as the face call, at save and on read', () => {
    const named = tool({ name: HELP_FACE.name });
    expect(saveHelpTool([], named)).toEqual([]);
    expect(parseHelpTools([named])).toEqual([]);
  });
});

describe('saveHelpTool', () => {
  it('adds a new Tool and replaces a held one by id', () => {
    const held = saveHelpTool([], tool());
    expect(held).toEqual([tool()]);
    expect(saveHelpTool(held, tool({ description: 'Finds a person by name.' }))).toEqual([tool({ description: 'Finds a person by name.' })]);
  });

  it('refuses a fixed function’s name, in any case, and a catalog name', () => {
    expect(saveHelpTool([], tool({ name: DOCS_LOOKUP.name }))).toEqual([]);
    expect(saveHelpTool([], tool({ name: DOCS_LOOKUP.name.toUpperCase() }))).toEqual([]);
    expect(saveHelpTool([], tool({ name: TOOL_CATALOG[0].name }))).toEqual([]);
  });

  it('refuses a name another held Tool uses, and lets a Tool keep its own', () => {
    const held = [tool()];
    expect(saveHelpTool(held, tool({ id: 'h-2', name: 'FIND_PERSON' }))).toEqual(held);
    expect(saveHelpTool(held, tool({ description: 'Same name, same Tool.' }))).toHaveLength(1);
  });
});

describe('the Tool list and its switches', () => {
  it('drop a Tool by id, and the switch with it', () => {
    expect(deleteHelpTool([tool(), tool({ id: 'h-2', name: 'other' })], 'h-1').map((t) => t.id)).toEqual(['h-2']);
    expect(dropHelpToolSwitch({ 'h-1': true, 'h-2': false }, 'h-1')).toEqual({ 'h-2': false });
  });

  it('list the Tools that are on, in list order', () => {
    const tools = [tool(), tool({ id: 'h-2', name: 'other' }), tool({ id: 'h-3', name: 'third' })];
    expect(helpToolsOn(tools, { 'h-3': true, 'h-1': true, 'h-2': false }).map((t) => t.id)).toEqual(['h-1', 'h-3']);
    expect(helpToolsOn(tools, {})).toEqual([]);
  });
});

describe('the stored Tools', () => {
  it('read back well-formed Tools and drop a malformed one, a repeated id, a taken name and a reserved name', () => {
    const stored = [
      tool(),
      { id: 'bad' },
      tool({ id: 'h-1', name: 'repeat_id' }),
      tool({ id: 'h-2', name: 'Find_Person' }),
      tool({ id: 'h-3', name: DOCS_LOOKUP.name }),
      tool({ id: 'h-4', name: 'kept' }),
    ];
    expect(parseHelpTools(stored).map((t) => t.id)).toEqual(['h-1', 'h-4']);
    expect(parseHelpTools('tools')).toEqual([]);
  });

  it('keep a switch only for a Tool in the list, and only a boolean one', () => {
    const tools = [tool()];
    expect(parseHelpToolSwitches({ 'h-1': true, gone: true, 'h-1x': 'yes' }, tools)).toEqual({ 'h-1': true });
    expect(parseHelpToolSwitches(null, tools)).toEqual({});
  });
});
