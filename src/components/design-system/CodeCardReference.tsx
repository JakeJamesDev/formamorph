import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta, SectionTitle } from '@/components/ui/typography';
import { renderCodeCard, renderCodeUses, rowText } from '@/components/prompt/codeCardView';
import { CARD_BOX } from '@/components/prompt/codeSession';
import { codeCard, type CodeCard } from '@/lib/codeCards';
import { statBoxLookups, type CodeCardWorld } from '@/lib/codeWorldLookup';
import type { CodeUse } from '@/lib/codeUses';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import type { SurfaceAnalysisOptions } from '@/lib/statCodeAnalysis';
import { cardWorldNames, statBoxAnalysisOptions } from '@/lib/statCodeBoxOptions';
import type { Dictionary, Entity, Placeholder, Stat, Trait } from '@/types';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });

const courage = stat('courage', 'Courage');
const fatigue = stat('fatigue', 'Fatigue', { type: 'percentage', value: 20, regen: 2, hidden: true });
const stats = [courage, stat('stamina', 'Stamina'), fatigue];

const brave: Trait = {
  id: 'brave', name: 'Brave', playerDescription: 'Faces danger without flinching.',
  requires: [{ all: [{ kind: 'stat', id: 'courage', operator: '>=', value: 50, unit: 'raw' }] }, { all: [{ kind: 'playingAs', id: 'tom' }] }],
  statChanges: [{ statId: 'stamina', value: 10, type: 'max' }],
  statToggles: [{ statId: 'fatigue', enabled: false }],
};
const mood: Placeholder = {
  id: 'mood', name: 'Mood', roll: true,
  values: [{ id: 'calm', text: 'calm' }, { id: 'wary', text: 'wary' }, { id: 'giddy', text: 'giddy' }],
  weights: { calm: 2, giddy: 0 },
};
const tom: Entity = { id: 'tom', name: 'Tom', persona: true };
const fauna: Dictionary = { id: 'fauna', name: 'Fauna', description: 'Animals of the marsh.', entries: [] };

const placeholders = [mood];
const placeholderOwners: PlaceholderOwners = new Map();
const world: CodeCardWorld = {
  traits: [brave], traitGroups: [], entities: [tom], locations: [], stats, statGroups: [], placeholders, placeholderOwners, dictionaries: [fauna],
};

/** The options a stat code box passes, bound to the sample world and to Courage's own box. */
const COURAGE_BOX: SurfaceAnalysisOptions = statBoxAnalysisOptions(cardWorldNames(world), {
  selfName: courage.name,
  lookup: statBoxLookups(world)({ owner: null, timing: 'after', self: courage }),
});

/** One sample: the code, with `|` where the pointer rests. */
const SAMPLES = [
  { title: 'Global', code: 'return se|lf.value;' },
  { title: 'Stat', code: 'return stats.Fati|gue.value;' },
  { title: 'Trait', code: 'return traits.Br|ave.enabled;' },
  { title: 'Placeholder', code: 'return placeholders.Mo|od.roll();' },
  { title: 'Read-Only', code: 'return self.previous.va|lue;' },
  { title: 'Declared Name', code: 'const total = stats.Courage.value;\nreturn tot|al;' },
] as const;

/** The uses a Fatigue search finds: a world stat's box, an entity's own box, and a Blueprint no one owns. */
const USES: readonly CodeUse[] = [
  { entityId: null, rowId: 'courage', timing: 'after', scriptId: 'courage:after', name: 'Courage', line: 3, noOwners: false },
  { entityId: 'tom', rowId: 'tom-health', timing: 'before', scriptId: 'tom-health:before', name: 'Health', entity: 'Tom', line: 1, noOwners: false },
  { entityId: null, rowId: 'dread', timing: 'after', scriptId: 'dread:after', name: 'Dread', line: 7, noOwners: true },
];

function cardFor(code: string): CodeCard {
  const card = codeCard(code.replace('|', ''), code.indexOf('|'), COURAGE_BOX);
  if (!card) throw new Error(`No card for ${code}`);
  return card;
}

type Report = (text: string) => void;
/** Builds the production DOM for one sample. Its controls only report what they do. */
type Build = (report: Report) => HTMLElement;

const GUIDE_REPORT = 'Read in the Guide opens the Guide at this heading.';

const cardBuild = (card: CodeCard): Build => (report) => {
  const dom = renderCodeCard(card, {
    goTo: () => report('Go to Line moves the caret to the declaration.'),
    open: () => report('Open selects the item in the World Editor.'),
    findUses: () => report('Find All Uses pins the card and lists every use.'),
    guide: () => report(GUIDE_REPORT),
  });
  // The Guide link is a real link; the reference keeps the page where it is.
  dom.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) {
      event.preventDefault();
      report(GUIDE_REPORT);
    }
  });
  return dom;
};

/** The Find All Uses list, in the same box as the card. */
const usesBuild = (uses: readonly CodeUse[]): Build => (report) => {
  const list = renderCodeUses(uses, (use) => report(`${rowText(use)} moves the caret to that line.`));
  Object.assign(list.style, CARD_BOX);
  return list;
};

// Built once, so a click's status text never rebuilds the DOM under the pointer.
const SAMPLE_BUILDS = SAMPLES.map(({ title, code }) => ({ title, build: cardBuild(cardFor(code)) }));
const FATIGUE_BUILD = cardBuild(cardFor('return stats.Fati|gue.value;'));
const USES_BUILD = usesBuild(USES);
const NO_USES_BUILD = usesBuild([]);

/** Mounts a build once. `report` is read at click time. */
function DomMount({ build, report }: { build: Build; report: Report }) {
  const host = useRef<HTMLDivElement>(null);
  const reportRef = useRef(report);
  reportRef.current = report;
  useEffect(() => {
    host.current?.replaceChildren(build((text) => reportRef.current(text)));
  }, [build]);
  return <div ref={host} />;
}

function SampleFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label} className="grid min-w-0 content-start gap-2">
      <Meta>{label}</Meta>
      <div className="w-fit max-w-full" style={CARD_BOX}>{children}</div>
    </section>
  );
}

/** The card and the list in one theme. */
function ThemePanel({ mode }: { mode: 'light' | 'dark' }) {
  const name = mode === 'light' ? 'Light' : 'Dark';
  const [status, setStatus] = useState('');
  return (
    <section
      aria-label={`${name} Theme`}
      className={`${mode} min-w-0 space-y-4 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme="blue"
    >
      <SectionTitle>{name}</SectionTitle>
      {SAMPLE_BUILDS.map(({ title, build }) => (
        <SampleFrame key={title} label={title}>
          <DomMount build={build} report={setStatus} />
        </SampleFrame>
      ))}
      <section aria-label="Find All Uses" className="grid min-w-0 content-start gap-2">
        <Meta>Find All Uses</Meta>
        <div className="flex w-fit max-w-full flex-col gap-1">
          <div style={CARD_BOX}><DomMount build={FATIGUE_BUILD} report={setStatus} /></div>
          <DomMount build={USES_BUILD} report={setStatus} />
        </div>
      </section>
      <section aria-label="No Uses" className="grid min-w-0 content-start gap-2">
        <Meta>No Uses</Meta>
        <div className="w-fit max-w-full"><DomMount build={NO_USES_BUILD} report={setStatus} /></div>
      </section>
      <p role="status" className="min-h-5 text-helper text-muted-foreground">{status}</p>
    </section>
  );
}

/** Code Hover Card: the card a code editor shows for a name, and the Find All Uses list, in both themes. */
export function CodeCardReference() {
  return (
    <Card role="region" aria-labelledby="code-card-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="code-card-reference-title" className="text-heading">Code Hover Card Reference</CardTitle>
        <CardDescription>This reference shows the production card for each kind of name, and the Find All Uses list.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ThemePanel mode="light" />
        <ThemePanel mode="dark" />
      </CardContent>
    </Card>
  );
}
