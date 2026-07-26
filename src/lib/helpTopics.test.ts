import { describe, it, expect } from 'vitest';
import { HELP_TOPICS, helpWikiUrl } from './helpTopics';

describe('helpWikiUrl', () => {
  it('builds a page URL with an anchor', () => {
    expect(helpWikiUrl({ title: 'x', wikiPage: 'WorldEditor', wikiAnchor: 'entities' }))
      .toBe('https://github.com/JakeJamesDev/formamorph/wiki/WorldEditor#entities');
  });

  it('links the page itself when there is no anchor', () => {
    expect(helpWikiUrl({ title: 'x', wikiPage: 'Entities' }))
      .toBe('https://github.com/JakeJamesDev/formamorph/wiki/Entities');
  });

  it('has no link when no wiki page covers the topic', () => {
    expect(helpWikiUrl({ title: 'x' })).toBeNull();
    // An anchor alone must not silently resolve against some default page — that is how a reader ends
    // up on the wrong page with a link that looks correct.
    expect(helpWikiUrl({ title: 'x', wikiAnchor: 'entities' })).toBeNull();
  });
});

describe('HELP_TOPICS registry', () => {
  it('states a page for every anchor, so no topic inherits a page it never named', () => {
    const orphans = Object.entries(HELP_TOPICS)
      .filter(([, t]) => t.wikiAnchor && !t.wikiPage)
      .map(([id]) => id);
    expect(orphans).toEqual([]);
  });

  it('gives every topic a title and exactly one of body or tabs', () => {
    for (const [id, topic] of Object.entries(HELP_TOPICS)) {
      expect(topic.title, id).toBeTruthy();
      expect(Boolean(topic.body) !== Boolean(topic.tabs), `${id} needs body or tabs, not both`).toBe(true);
    }
  });

  it('registers the in-play entities topic the game panel mounts', () => {
    // The panel asks for this id by string; an unknown id renders nothing, so a rename here would
    // silently remove the help button rather than fail.
    expect(HELP_TOPICS['game.entities']?.wikiPage).toBe('Entities');
  });
});
