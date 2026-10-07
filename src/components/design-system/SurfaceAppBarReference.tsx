import { useState } from 'react';
import { ChevronRight, FlaskConical, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ModeSelect } from '@/components/ui/mode-select';
import { Tip } from '@/components/ui/tooltip';
import { BackButton } from '@/components/BackButton';
import { SurfaceAppBar } from '@/components/SurfaceAppBar';
import { TruncatedText } from '@/components/TruncatedText';
import { Separator } from '@/components/ui/separator';
import { ActionIcon } from '@/lib/actionIcons';
import { EDITOR_MODE_DESCRIPTIONS, type EditorMode } from '@/lib/editorMode';

const SAMPLE_WORLD_NAME = 'Sedge Landing';

/** The World Editor's app bar over sample controls. Every control changes only this reference's own state. */
export function SurfaceAppBarReference() {
  const [mode, setMode] = useState<EditorMode>('simple');
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
        <div className="overflow-x-auto rounded-md border border-border">
          <div className="min-w-[44rem] border-b">
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
                  <Button size="sm" onClick={() => setAction('Save.')}>
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
