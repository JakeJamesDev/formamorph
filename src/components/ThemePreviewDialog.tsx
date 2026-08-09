import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import IndeterminateProgress from '@/components/ui/indeterminate-progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Chip } from '@/components/Chip';
import { MultiSelect } from '@/components/ui/multi-select';
import { WorldCardShell } from '@/components/WorldCardShell';
import { CardTags } from '@/components/WorldDetails';
import { Settings, Plus, GripVertical, Copy, X } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from './theme-provider';
import { hslTripleToHex, hexToHslTriple } from '@/lib/hslColor';

interface TokenDef {
  token: string;
  label: string;
}

const TOKEN_GROUPS: { title: string; tokens: TokenDef[] }[] = [
  {
    title: 'Surfaces',
    tokens: [
      { token: '--background', label: 'Background' },
      { token: '--foreground', label: 'Foreground' },
      { token: '--card', label: 'Card' },
      { token: '--card-foreground', label: 'Card text' },
      { token: '--popover', label: 'Popover' },
      { token: '--popover-foreground', label: 'Popover text' },
    ],
  },
  {
    title: 'Brand & neutrals',
    tokens: [
      { token: '--primary', label: 'Primary' },
      { token: '--primary-foreground', label: 'Primary text' },
      { token: '--secondary', label: 'Secondary' },
      { token: '--secondary-foreground', label: 'Secondary text' },
      { token: '--accent', label: 'Accent' },
      { token: '--accent-foreground', label: 'Accent text' },
      { token: '--muted', label: 'Muted' },
      { token: '--muted-foreground', label: 'Muted text' },
    ],
  },
  {
    title: 'Status',
    tokens: [
      { token: '--destructive', label: 'Destructive' },
      { token: '--destructive-foreground', label: 'Destructive text' },
      { token: '--destructive-fill', label: 'Destructive fill' },
      { token: '--success', label: 'Success' },
      { token: '--success-foreground', label: 'Success text' },
      { token: '--warning', label: 'Warning' },
      { token: '--warning-foreground', label: 'Warning text' },
      { token: '--info', label: 'Info' },
      { token: '--info-foreground', label: 'Info text' },
      { token: '--overlay', label: 'Overlay' },
    ],
  },
  {
    title: 'Chrome',
    tokens: [
      { token: '--border', label: 'Border' },
      { token: '--input', label: 'Input' },
      { token: '--ring', label: 'Ring' },
    ],
  },
  {
    title: 'Charts',
    tokens: [
      { token: '--chart-1', label: 'Chart 1' },
      { token: '--chart-2', label: 'Chart 2' },
      { token: '--chart-3', label: 'Chart 3' },
      { token: '--chart-4', label: 'Chart 4' },
      { token: '--chart-5', label: 'Chart 5' },
    ],
  },
];

const ALL_TOKENS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.token));

/** Snapshot the live theme's token values off `<html>` (reflects the active light/dark + data-theme). */
function readTokens(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const t of ALL_TOKENS) out[t] = cs.getPropertyValue(t).trim();
  return out;
}

/** A settings-style label + control row. */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-2">
      <div className="text-label">
        <div>{label}</div>
        {hint && <div className="text-helper text-muted-foreground">{hint}</div>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

const TAGS = ['adventure', 'mystery', 'romance'];
const noRemove = (_label: string) => { /* viewer: chips are display-only */ };
const noop = () => { /* viewer: display-only */ };
const MULTI_OPTIONS = [
  { value: 'a', label: 'Adventure' },
  { value: 'b', label: 'Mystery' },
  { value: 'c', label: 'Romance' },
  { value: 'd', label: 'Horror' },
];
const LIST_ROWS = ['Lorem ipsum', 'Dolor sit amet', 'Consectetur'];

/**
 * The right-hand panel: a mock of a real settings menu built from our own unique widgets (one of each,
 * no duplicates), so every token can be judged in context. Controls are uncontrolled/display-only.
 */
function PreviewPanel() {
  return (
    <div className="space-y-5 rounded-md border border-border bg-background p-5 text-foreground">
      <div>
        <h3 className="text-title font-semibold">Lorem ipsum dolor</h3>
        <p className="text-helper text-muted-foreground">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-3">
          <Row label="Enable feature" hint="A checkbox with helper text.">
            <label className="flex items-center gap-2 text-label">
              <Checkbox defaultChecked /> Consectetur adipiscing
            </label>
          </Row>

          <Row label="Mode" hint="Pick one option.">
            <RadioGroup defaultValue="a" className="gap-1">
              <label className="flex items-center gap-2 text-label"><RadioGroupItem value="a" /> Tempor incididunt</label>
              <label className="flex items-center gap-2 text-label"><RadioGroupItem value="b" /> Labore et dolore</label>
            </RadioGroup>
          </Row>

          <Row label="Preset">
            <Select defaultValue="one">
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one">Ut enim ad minim</SelectItem>
                <SelectItem value="two">Quis nostrud</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="Categories" hint="Multiselect with chips.">
            <MultiSelect options={MULTI_OPTIONS} defaultValue={['a', 'b']} onValueChange={noop} placeholder="Select…" hideSelectAll className="w-full" />
          </Row>

          <Row label="Amount" hint="Sed do eiusmod.">
            <Slider defaultValue={[60]} min={0} max={100} step={1} />
          </Row>

          <Row label="Name">
            <Input placeholder="Duis aute irure" />
          </Row>

          <Row label="Notes">
            <Textarea rows={2} placeholder="Excepteur sint occaecat cupidatat non proident." />
          </Row>

          <Row label="Tags" hint="Double-click to edit, drag to reorder.">
            <div className="flex flex-wrap gap-1">
              {TAGS.map((t) => <Chip key={t} label={t} onRemove={noRemove} grabbable />)}
            </div>
          </Row>
        </TabsContent>

        <TabsContent value="appearance" className="pt-3 text-helper text-muted-foreground">
          Lorem ipsum dolor sit amet — switch tabs to see the active-tab treatment.
        </TabsContent>
        <TabsContent value="advanced" className="pt-3 text-helper text-muted-foreground">
          Consectetur adipiscing elit, sed do eiusmod tempor.
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Primary</Button>
        <Button size="sm" variant="secondary">Secondary</Button>
        <Button size="sm" variant="destructive">Destructive</Button>
        <Button size="sm" variant="outline">Outline</Button>
        <Button size="sm" variant="ghost">Ghost</Button>
        {/* Circular icon buttons (the floating settings-cog style). */}
        <span className="p-2 rounded-full bg-secondary text-secondary-foreground shadow-lg"><Settings className="h-5 w-5" /></span>
        <span className="p-2 rounded-full bg-primary text-primary-foreground shadow-lg"><Plus className="h-5 w-5" /></span>
      </div>

      {/* Reorderable list rows (drag handle + row actions), one selected. */}
      <div className="space-y-1">
        {LIST_ROWS.map((row, i) => {
          const selected = i === 0;
          return (
            <div key={row} className={`p-2 rounded-md flex items-center gap-1 ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
              <span className={`px-1 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}><GripVertical className="h-4 w-4" /></span>
              <span className="flex-grow text-label">{row}</span>
              <Button variant="ghost" size="icon" className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}><X className="h-4 w-4" /></Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded px-2 py-0.5 text-meta font-medium bg-success text-success-foreground">Success</span>
        <span className="rounded px-2 py-0.5 text-meta font-medium bg-warning text-warning-foreground">Warning</span>
        <span className="rounded px-2 py-0.5 text-meta font-medium bg-info text-info-foreground">Info</span>
      </div>

      <Alert variant="destructive">
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Aliquip ex ea commodo consequat — destructive alert styling.</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Progress value={62} />
        <IndeterminateProgress />
      </div>

      {/* A real world card: placeholder-image background + tags on the card surface. */}
      <div className="max-w-[260px]">
        <WorldCardShell
          frameClassName="bg-card"
          name="Lorem Ipsum"
          description="Dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor."
          author="by anonymous"
        >
          <CardTags tags={TAGS} onHide={noRemove} />
        </WorldCardShell>
      </div>
    </div>
  );
}

function ThemePreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { themeColor } = useSettings();
  const { resolvedTheme } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});

  // Seed from the live theme whenever the dialog opens or the underlying theme changes beneath it.
  useEffect(() => {
    if (!open) return;
    setValues(readTokens());
  }, [open, themeColor, resolvedTheme]);

  const previewStyle = useMemo(() => values as CSSProperties, [values]);

  const setToken = (token: string, hex: string) =>
    setValues((v) => ({ ...v, [token]: hexToHslTriple(hex) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1080px)] max-w-none h-[640px] max-h-[90dvh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Theme preview</DialogTitle>
          <DialogDescription className="sr-only">Edit theme colors and preview them on sample interface elements.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 gap-4">
          {/* Token editor */}
          <ScrollArea className="w-[320px] shrink-0">
            <div className="space-y-4">
            {TOKEN_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <div className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</div>
                {group.tokens.map(({ token, label }) => {
                  const value = values[token] ?? '';
                  const hex = value ? hslTripleToHex(value) : '#000000';
                  return (
                    <label key={token} className="flex items-center gap-2 text-label">
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) => setToken(token, e.target.value)}
                        className="h-6 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                      />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <code className="text-[10px] text-muted-foreground">{value}</code>
                    </label>
                  );
                })}
              </div>
            ))}
            </div>
          </ScrollArea>

          {/* Live preview — token overrides cascade to everything inside via CSS vars on the wrapper. */}
          <ScrollArea className="flex-1" style={previewStyle}>
            <PreviewPanel />
          </ScrollArea>
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-between sm:justify-between">
          <span className="text-helper text-muted-foreground">
            Live viewer — nothing is saved. Seeded from your current theme ({resolvedTheme}); edits reset on reopen.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setValues(readTokens())}>Reset</Button>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Button + dialog to inspect and live-edit every theme token; drop into settings beside Theme Color. */
export function ThemePreviewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Preview theme…
      </Button>
      <ThemePreviewDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
