import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FlaskConical, ImageDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SaveSplitButton } from '@/components/editor/SaveSplitButton';
import { useSaveStatus } from '@/components/editor/useSaveStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModeSelect } from '@/components/ui/mode-select';
import { Tip } from '@/components/ui/tooltip';
import { BackButton } from '@/components/BackButton';
import { SurfaceAppBar } from '@/components/SurfaceAppBar';
import { TruncatedText } from '@/components/TruncatedText';
import { Separator } from '@/components/ui/separator';
import { ActionIcon } from '@/lib/actionIcons';
import { EDITOR_MODE_DESCRIPTIONS, type EditorMode } from '@/lib/editorMode';
import EditorFindBar from '@/components/editor/EditorFindBar';
import { EMPTY_LETTERS } from '@/lib/placementLetters';
import type { SearchTarget } from '@/lib/worldSearch';
import type { Placeholder } from '@/types';

const SAMPLE_WORLD_NAME = 'Sedge Landing';
const NO_TARGETS: SearchTarget[] = [];
const NO_PLACEHOLDERS: Placeholder[] = [];
/** How long the sample save runs, so Saving… shows. */
const SAMPLE_SAVE_MS = 600;

/** The World Editor's app bar over sample controls. Every control changes only this reference's own state. */
export function SurfaceAppBarReference() {
  const [mode, setMode] = useState<EditorMode>('simple');
  const [action, setAction] = useState('No action yet.');
  const [searchExpanded, setSearchExpanded] = useState(false);
  // A sample world: it starts with a change, and a save only flips these flags after a short wait.
  const [dirty, setDirty] = useState(true);
  const [failNext, setFailNext] = useState(false);
  const save = useSaveStatus(dirty);
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  const sampleSave = () => {
    setAction('Save.');
    void save.track(() => new Promise<boolean>((resolve) => {
      saveTimer.current = window.setTimeout(() => {
        if (!failNext) setDirty(false);
        resolve(!failNext);
      }, SAMPLE_SAVE_MS);
    }));
  };
  return (
    <Card role="region" aria-labelledby="surface-app-bar-title">
      <CardHeader>
        <CardTitle id="surface-app-bar-title" className="text-heading">Surface App Bar</CardTitle>
        <CardDescription>
          The World Editor&apos;s bar over sample controls. Search World sits on the bar&apos;s center line
          when space allows, and never overlaps the sides.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="overflow-x-auto rounded-md border border-border">
          <div className="min-w-[64rem] border-b">
            <SurfaceAppBar
              start={(
                <>
                  <BackButton onClick={() => setAction('Back.')} />
                  <CardTitle className="ml-1 shrink-0">World Editor</CardTitle>
                  <ChevronRight aria-hidden className="mx-1 h-3 w-3 shrink-0 text-muted-foreground" />
                  <TruncatedText text={SAMPLE_WORLD_NAME} className="text-body text-muted-foreground" />
                </>
              )}
              center={(
                // The production field over no world, so a search here finds nothing.
                <EditorFindBar
                  layout="docked"
                  targets={NO_TARGETS}
                  placeholders={NO_PLACEHOLDERS}
                  placementLetters={EMPTY_LETTERS}
                  allowPlaceholderReplace={false}
                  onNavigate={() => {}}
                  onAddPlaceholder={() => {}}
                  expanded={searchExpanded}
                  onExpandedChange={setSearchExpanded}
                  onClose={() => { setSearchExpanded(false); setAction('Close Search.'); }}
                />
              )}
              end={(
                <>
                  <ModeSelect
                    mode={mode}
                    onModeChange={setMode}
                    descriptions={EDITOR_MODE_DESCRIPTIONS}
                    aria-label="Sample editor mode"
                  />
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  {mode === 'advanced' && (
                    <Tip tip="Optimize Images: downscale oversized images to conserve file size">
                      <Button
                        variant="ghost" size="icon" aria-label="Optimize Images"
                        onClick={() => setAction('Optimize Images.')}
                      >
                        <ImageDown className="h-4 w-4" />
                      </Button>
                    </Tip>
                  )}
                  <Tip tip="Test Bench">
                    <Button variant="ghost" size="icon" onClick={() => setAction('Test Bench.')}>
                      <FlaskConical className="h-4 w-4" />
                    </Button>
                  </Tip>
                  <SaveSplitButton
                    status={save.status}
                    onSave={sampleSave}
                    menu={[{
                      label: 'Export World',
                      icon: <ActionIcon.export className="mr-2 h-4 w-4 shrink-0" />,
                      onClick: () => setAction('Export World.'),
                    }]}
                  />
                </>
              )}
            />
          </div>
          <p className="p-4 text-meta text-muted-foreground">The editor&apos;s panels start here.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button variant="secondary" size="sm" onClick={() => setDirty(true)}>Make a Change</Button>
          <label htmlFor="app-bar-fail-save" className="flex items-center gap-2 text-label">
            <Checkbox id="app-bar-fail-save" checked={failNext} onCheckedChange={(value) => setFailNext(value === true)} />
            Fail Saves
          </label>
        </div>
        <p className="text-meta text-muted-foreground" aria-live="polite">Last action: {action}</p>
      </CardContent>
    </Card>
  );
}
// scroll-guard: allow horizontal: the desktop-width bar scrolls sideways in a narrow showcase
