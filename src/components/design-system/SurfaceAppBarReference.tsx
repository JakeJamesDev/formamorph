import { useState } from 'react';
import { FlaskConical, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModeSelect } from '@/components/ui/mode-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import { BackButton } from '@/components/BackButton';
import { SurfaceAppBar } from '@/components/SurfaceAppBar';
import { Separator } from '@/components/ui/separator';
import { ActionIcon } from '@/lib/actionIcons';
import { EDITOR_MODE_DESCRIPTIONS, type EditorMode } from '@/lib/editorMode';

type SaveState = 'never' | 'saved' | 'unsaved';

const SAVE_STATES: { value: SaveState; label: string }[] = [
  { value: 'never', label: 'Never Stored' },
  { value: 'saved', label: 'Saved' },
  { value: 'unsaved', label: 'Unsaved Changes' },
];

/** The World Editor's app bar over sample controls. Every control changes only this reference's own state. */
export function SurfaceAppBarReference() {
  const [mode, setMode] = useState<EditorMode>('simple');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [action, setAction] = useState('No action yet.');
  return (
    <Card role="region" aria-labelledby="surface-app-bar-title">
      <CardHeader>
        <CardTitle id="surface-app-bar-title" className="text-heading">Surface App Bar</CardTitle>
        <CardDescription>
          The World Editor&apos;s bar over sample controls. Find and the flask sit on the bar&apos;s center line
          whatever the sides hold.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <RadioGroup
          value={saveState}
          onValueChange={(value) => setSaveState(value as SaveState)}
          aria-label="Sample save state"
          className="flex flex-wrap gap-x-6 gap-y-3"
        >
          {SAVE_STATES.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem id={`surface-app-bar-${value}`} value={value} />
              <Label htmlFor={`surface-app-bar-${value}`} className="text-label">{label}</Label>
            </div>
          ))}
        </RadioGroup>
        <div className="overflow-x-auto rounded-md border border-border">
          <div className="min-w-[44rem] border-b">
            <SurfaceAppBar
              start={(
                <>
                  <BackButton onClick={() => setAction('Back.')} />
                  <CardTitle className="ml-1 shrink-0">World Editor</CardTitle>
                  {saveState !== 'never' && (
                    <span className="ml-2 shrink-0 text-meta text-muted-foreground">
                      {saveState === 'saved' ? 'Saved' : 'Unsaved changes'}
                    </span>
                  )}
                </>
              )}
              center={(
                <>
                  <Tip tip="Find and replace">
                    <Button variant="ghost" size="icon" onClick={() => setAction('Find and replace.')}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </Tip>
                  <Tip tip="Test Bench">
                    <Button variant="ghost" size="icon" onClick={() => setAction('Test Bench.')}>
                      <FlaskConical className="h-4 w-4" />
                    </Button>
                  </Tip>
                </>
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
                  <Tip tip="Export World">
                    <Button variant="ghost" size="icon" onClick={() => setAction('Export World.')}>
                      <ActionIcon.export className="h-4 w-4" />
                    </Button>
                  </Tip>
                  <Button size="sm" disabled={saveState !== 'unsaved'} onClick={() => { setSaveState('saved'); setAction('Save.'); }}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </>
              )}
            />
          </div>
          <p className="p-4 text-meta text-muted-foreground">The editor&apos;s panels start here.</p>
        </div>
        <p className="text-meta text-muted-foreground" aria-live="polite">Last action: {action}</p>
      </CardContent>
    </Card>
  );
}
// scroll-guard: allow horizontal: the desktop-width bar scrolls sideways in a narrow showcase
