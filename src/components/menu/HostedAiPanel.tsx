import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toastError } from "@/lib/linkToast";
import { Section, Row, HintInfo } from "@/components/SettingsRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint, Meta } from "@/components/ui/typography";
import { useMountedRef } from "@/lib/useMountedRef";
import { REASONING_DIALECTS, isReasoningDialect, type ReasoningDialect } from "@/lib/reasoningDialect";
import { SUPPORTER_LABELS, SUPPORTER_TIERS } from "@/lib/supporterFlair";
import type { SupporterTier } from "@/types/supporter";
import type {
  HostedAiAdminApi, HostedAiSettings, HostedGrant, HostedModel, HostedPause, HostedSpendDay, HostedTier,
} from "@/services/HostedAiAdminService";

/** Days the spend report covers. */
const REPORT_DAYS = 14;

/** The reasoning dialects a model can name. `unknown` and `engine` describe the client's own probing. */
const MODEL_DIALECTS = REASONING_DIALECTS.filter((id) => id !== 'unknown' && id !== 'engine');

const NO_REASONING = 'none';

const dollars = (micros: number | null) => (micros === null ? '—' : `$${(micros / 1_000_000).toFixed(2)}`);

/** A number field that keeps what the admin typed, so "0." survives until it is a number. Empty is null. */
function NumberField({ id, label, value, onChange, step = 1 }: {
  id: string; label: string; value: number | null; onChange: (next: number | null) => void; step?: number;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));

  // Follows a value that changed from outside, such as a save that stored something else.
  useEffect(() => {
    setText((current) => {
      const parsed = current.trim() === '' ? null : Number(current);
      return parsed === value ? current : (value === null ? '' : String(value));
    });
  }, [value]);

  return (
    <Input
      id={id}
      aria-label={label}
      type="number"
      inputMode="decimal"
      step={step}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const trimmed = event.target.value.trim();
        onChange(trimmed === '' || Number.isNaN(Number(trimmed)) ? null : Number(trimmed));
      }}
    />
  );
}

/** Parses an optional JSON object field. Empty is null. */
function parseObject(text: string): { value: Record<string, unknown> | null } | { error: string } {
  if (text.trim() === '') return { value: null };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'Enter a JSON object' };
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: 'Enter valid JSON' };
  }
}

const stringify = (value: Record<string, unknown> | null | undefined) => (value ? JSON.stringify(value, null, 2) : '');

interface ModelDraft {
  /** The entry being edited, or null for a new one. */
  editing: string | null;
  id: string;
  model: string;
  prompt: number | null;
  completion: number | null;
  cached: number | null;
  tools: boolean;
  reasoning: ReasoningDialect | typeof NO_REASONING;
  budget: boolean;
  efforts: string;
  routing: string;
  reasoningOptions: string;
}

const emptyDraft = (): ModelDraft => ({
  editing: null, id: '', model: '', prompt: null, completion: null, cached: null, tools: false,
  reasoning: NO_REASONING, budget: false, efforts: '', routing: '', reasoningOptions: '',
});

const draftOf = (entry: HostedModel): ModelDraft => ({
  editing: entry.id,
  id: entry.id,
  model: entry.model,
  prompt: entry.prices?.prompt ?? null,
  completion: entry.prices?.completion ?? null,
  cached: entry.prices?.cached ?? null,
  tools: entry.capabilities?.tools ?? false,
  reasoning: entry.capabilities?.reasoning ?? NO_REASONING,
  budget: entry.capabilities?.budget ?? false,
  efforts: (entry.capabilities?.efforts ?? []).join(', '),
  routing: stringify(entry.routing),
  reasoningOptions: stringify(entry.reasoning),
});

/** The entry a draft describes, or why it can't be one. */
function modelOf(draft: ModelDraft): { entry: HostedModel } | { error: string } {
  if (!draft.id.trim() || !draft.model.trim()) return { error: 'Enter an id and an upstream model' };
  const routing = parseObject(draft.routing);
  if ('error' in routing) return { error: `Routing: ${routing.error}` };
  const reasoning = parseObject(draft.reasoningOptions);
  if ('error' in reasoning) return { error: `Reasoning options: ${reasoning.error}` };

  const prices: HostedModel['prices'] = {};
  if (draft.prompt !== null) prices.prompt = draft.prompt;
  if (draft.completion !== null) prices.completion = draft.completion;
  if (draft.cached !== null) prices.cached = draft.cached;

  const efforts = draft.efforts.split(',').map((effort) => effort.trim()).filter(Boolean);
  return {
    entry: {
      id: draft.id.trim(),
      model: draft.model.trim(),
      routing: routing.value,
      reasoning: reasoning.value,
      prices,
      capabilities: {
        tools: draft.tools,
        reasoning: draft.reasoning === NO_REASONING ? null : draft.reasoning,
        ...(draft.budget ? { budget: true } : {}),
        ...(efforts.length ? { efforts } : {}),
      },
    },
  };
}

/** One tier's three fields. */
function TierRows({ tier, value, onChange }: { tier: SupporterTier; value: HostedTier | undefined; onChange: (next: HostedTier) => void }) {
  const current: HostedTier = value ?? { window: 0, budget: 0, turnCost: null };
  const name = SUPPORTER_LABELS[tier];

  return (
    <>
      <Row label={`${name} Window`} htmlFor={`hosted-${tier}-window`} hint="Tokens of context">
        <NumberField id={`hosted-${tier}-window`} label={`${name} Window`} value={current.window || null}
          onChange={(window) => onChange({ ...current, window: window ?? 0 })} />
      </Row>
      <Row label={`${name} Budget`} htmlFor={`hosted-${tier}-budget`} hint="Dollars per month">
        <NumberField id={`hosted-${tier}-budget`} label={`${name} Budget`} value={value ? current.budget : null} step={0.01}
          onChange={(budget) => onChange({ ...current, budget: budget ?? 0 })} />
      </Row>
      <Row label={`${name} Fallback Cost`} htmlFor={`hosted-${tier}-turn`} hint="Dollars per turn, for the turns-left estimate">
        <NumberField id={`hosted-${tier}-turn`} label={`${name} Fallback Cost`} value={current.turnCost ?? null} step={0.001}
          onChange={(turnCost) => onChange({ ...current, turnCost })} />
      </Row>
    </>
  );
}

/** Both fields blank is unset. One blank keeps the other, with 0 for the server to refuse by name. */
const sampleOf = (recent: number | null, min: number | null) =>
  recent === null && min === null ? null : { recent: recent ?? 0, min: min ?? 0 };

/** The global limits, as one list so a new one is one entry. */
type LimitKey = {
  [K in keyof HostedAiSettings]: HostedAiSettings[K] extends number | null ? K : never
}[keyof HostedAiSettings];

const LIMITS: readonly { key: LimitKey; label: string; hint: string; step?: number }[] = [
  { key: 'dailyCeiling', label: 'Daily Ceiling', hint: 'Dollars of spend per UTC day that pause all hosted AI', step: 0.01 },
  { key: 'balanceThreshold', label: 'Balance Alert', hint: 'Provider balance in dollars that raises an alert', step: 0.01 },
  { key: 'maxTokensCap', label: 'Max Tokens Cap', hint: 'Largest reply a call may ask for' },
  { key: 'idleLimitSeconds', label: 'Idle Limit', hint: 'Seconds of silence before an upstream call ends' },
  { key: 'tokenRatio', label: 'Token Ratio', hint: 'Characters per token for the prompt estimate', step: 0.01 },
  { key: 'tokenMargin', label: 'Token Margin', hint: 'Tokens added to the window before a prompt is refused' },
  { key: 'turnLimitSeconds', label: 'Turn Time Limit', hint: 'Seconds a turn id stays valid' },
  { key: 'turnCallCap', label: 'Turn Call Cap', hint: 'Calls one turn may make' },
  { key: 'parallelLimit', label: 'Parallel Limit', hint: 'Calls one account may run at once' },
  { key: 'perMinuteLimit', label: 'Per-Minute Limit', hint: 'Calls one account may start per minute' },
  { key: 'retentionDays', label: 'Retention', hint: 'Days a usage row is kept' },
];

/** Formamorph AI for administrators: tiers, limits, models, grants, the pause and the spend report. */
export function HostedAiPanel({ active, api }: { active: boolean; api: HostedAiAdminApi }) {
  const mounted = useMountedRef();
  const [stored, setStored] = useState<HostedAiSettings | null>(null);
  const [draft, setDraft] = useState<HostedAiSettings | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState<ModelDraft | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [grants, setGrants] = useState<HostedGrant[] | null>(null);
  const [pause, setPause] = useState<HostedPause | null>(null);
  const [report, setReport] = useState<HostedSpendDay[] | null>(null);
  const [grantUser, setGrantUser] = useState('');
  const [grantTier, setGrantTier] = useState<SupporterTier>(SUPPORTER_TIERS[0]);
  const [grantEnd, setGrantEnd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    let current = true;
    const fail = (what: string) => (error: unknown) => { if (current && mounted.current) toastError(error, what); };
    api.fetchSettings()
      .then((value) => { if (current && mounted.current) { setStored(value); setDraft(value); } })
      .catch((error: unknown) => { if (current && mounted.current) { setUnreadable(true); toastError(error, 'Failed to read the hosted AI settings'); } });
    api.listGrants().then((list) => { if (current && mounted.current) setGrants(list); }).catch(fail('Failed to read the grants'));
    api.fetchPause().then((state) => { if (current && mounted.current) setPause(state); }).catch(fail('Failed to read the pause'));
    api.fetchSpendReport(REPORT_DAYS).then((days) => { if (current && mounted.current) setReport(days); }).catch(fail('Failed to read the spend report'));
    return () => { current = false; };
  }, [active, api, mounted]);

  const change = useCallback((patch: Partial<HostedAiSettings>) => {
    setDraft((value) => (value ? { ...value, ...patch } : value));
  }, []);

  const dirty = Boolean(stored && draft && JSON.stringify(stored) !== JSON.stringify(draft));

  const save = () => {
    if (!draft) return;
    const unset = SUPPORTER_TIERS.find((tier) => draft.tiers[tier] && !draft.tiers[tier]?.window);
    if (unset) {
      setSaveError(`Set a window for ${SUPPORTER_LABELS[unset]}`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    void api.saveSettings(draft)
      .then((value) => { if (mounted.current) { setStored(value); setDraft(value); } })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        setSaveError(error instanceof Error ? error.message : 'Failed to save the hosted AI settings');
      })
      .finally(() => { if (mounted.current) setSaving(false); });
  };

  const commitModel = () => {
    if (!modelDraft || !draft) return;
    const result = modelOf(modelDraft);
    if ('error' in result) { setModelError(result.error); return; }
    const { entry } = result;
    const others = draft.models.filter((existing) => existing.id !== modelDraft.editing);
    if (others.some((existing) => existing.id === entry.id)) { setModelError('Each model id must be unique'); return; }

    const models = modelDraft.editing === null
      ? [...draft.models, entry]
      : draft.models.map((existing) => (existing.id === modelDraft.editing ? entry : existing));
    // The first model added is the active one, since exactly one entry is active while any exist.
    const renamedActive = draft.activeModel === modelDraft.editing ? entry.id : draft.activeModel;
    change({ models, activeModel: renamedActive ?? entry.id });
    setModelDraft(null);
    setModelError(null);
  };

  const removeModel = (id: string) => {
    if (!draft || draft.activeModel === id) return;
    change({ models: draft.models.filter((existing) => existing.id !== id) });
  };

  const createGrant = () => {
    if (!grantUser.trim() || !grantEnd) return;
    setBusy(true);
    void api.createGrant({ userId: grantUser.trim(), tier: grantTier, endsAt: `${grantEnd}T23:59:59.000Z` })
      .then((grant) => {
        if (!mounted.current) return;
        setGrants((list) => [grant, ...(list ?? [])]);
        setGrantUser('');
        setGrantEnd('');
      })
      .catch((error: unknown) => { if (mounted.current) toastError(error, 'Failed to create the grant'); })
      .finally(() => { if (mounted.current) setBusy(false); });
  };

  const revoke = (id: number) => {
    setBusy(true);
    void api.revokeGrant(id)
      .then((grant) => { if (mounted.current) setGrants((list) => (list ?? []).map((item) => (item.id === id ? grant : item))); })
      .catch((error: unknown) => { if (mounted.current) toastError(error, 'Failed to revoke the grant'); })
      .finally(() => { if (mounted.current) setBusy(false); });
  };

  const lift = () => {
    setBusy(true);
    void api.liftPause()
      .then((state) => { if (mounted.current) setPause(state); })
      .catch((error: unknown) => { if (mounted.current) toastError(error, 'Failed to lift the pause'); })
      .finally(() => { if (mounted.current) setBusy(false); });
  };

  if (unreadable) {
    return <Meta>This server didn’t answer for the hosted AI settings</Meta>;
  }
  if (!draft) {
    return <Skeleton className="h-4 w-48" />;
  }

  const now = Date.now();
  const grantLive = (grant: HostedGrant) => !grant.revokedAt && new Date(grant.endsAt).getTime() > now;
  const modelField = (patch: Partial<ModelDraft>) => setModelDraft((value) => (value ? { ...value, ...patch } : value));

  return (
    <div className="grid gap-8" data-testid="hosted-ai-panel">
      <Section title="Formamorph AI Tiers" hint="Window and allowance per Supporter tier">
        {SUPPORTER_TIERS.map((tier) => (
          <TierRows
            key={tier}
            tier={tier}
            value={draft.tiers[tier]}
            onChange={(next) => change({ tiers: { ...draft.tiers, [tier]: next } })}
          />
        ))}
      </Section>

      <Section title="Formamorph AI Limits" hint="Clear a field to unset it. The proxy refuses calls until each is set.">
        {LIMITS.map(({ key, label, hint, step }) => (
          <Row key={key} label={label} htmlFor={`hosted-${key}`} hint={hint}>
            <NumberField
              id={`hosted-${key}`}
              label={label}
              value={draft[key]}
              step={step}
              onChange={(next) => change({ [key]: next })}
            />
          </Row>
        ))}
        <Row
          label="Warning Percents"
          htmlFor="hosted-warn"
          hint="Whole percents, lowest first, separated by commas"
          info={<HintInfo>Each percent of a tier’s allowance shows one notice per month.</HintInfo>}
        >
          <Input
            id="hosted-warn"
            aria-label="Warning Percents"
            // Remounts when a save or reload stores another list, so the text never goes stale.
            key={JSON.stringify(stored?.warnThresholds ?? null)}
            defaultValue={(draft.warnThresholds ?? []).join(', ')}
            onChange={(event) => {
              const parts = event.target.value.split(',').map((part) => part.trim()).filter(Boolean).map(Number);
              change({ warnThresholds: parts.length ? parts : null });
            }}
          />
        </Row>
        <Row label="Turn Sample" hint="Recent turns averaged for the turns-left estimate, and the fewest that count">
          <div className="grid grid-cols-2 gap-2">
            <NumberField id="hosted-sample-recent" label="Recent Turns" value={draft.turnSample?.recent || null}
              onChange={(recent) => change({ turnSample: sampleOf(recent, draft.turnSample?.min ?? null) })} />
            <NumberField id="hosted-sample-min" label="Fewest Turns" value={draft.turnSample?.min || null}
              onChange={(min) => change({ turnSample: sampleOf(draft.turnSample?.recent ?? null, min) })} />
          </div>
        </Row>
      </Section>

      <Section title="Approved Models" hint="Every tier uses the active model. A change applies to the next turn.">
        <Row label="Active Model" htmlFor="hosted-active-model">
          <Select
            value={draft.activeModel ?? undefined}
            onValueChange={(activeModel) => change({ activeModel })}
            disabled={draft.models.length === 0}
          >
            <SelectTrigger id="hosted-active-model" aria-label="Active Model"><SelectValue placeholder="No models yet" /></SelectTrigger>
            <SelectContent>
              {draft.models.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.id}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        {draft.models.map((entry) => (
          <Row key={entry.id} label={entry.id} top>
            <div className="flex flex-wrap items-center gap-2">
              <Meta className="mr-auto">{entry.model}</Meta>
              <Button type="button" size="sm" variant="outline" aria-label={`Edit ${entry.id}`}
                onClick={() => { setModelDraft(draftOf(entry)); setModelError(null); }}>Edit</Button>
              <Button type="button" size="sm" variant="outline" aria-label={`Remove ${entry.id}`}
                disabled={draft.activeModel === entry.id} onClick={() => removeModel(entry.id)}>Remove</Button>
            </div>
          </Row>
        ))}

        {modelDraft ? (
          <ModelForm draft={modelDraft} error={modelError} onChange={modelField} onSave={commitModel}
            onCancel={() => { setModelDraft(null); setModelError(null); }} />
        ) : (
          <Row>
            <Button type="button" variant="outline" onClick={() => { setModelDraft(emptyDraft()); setModelError(null); }}>Add Model</Button>
          </Row>
        )}
      </Section>

      <Row>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={!dirty || saving}>Save Settings</Button>
          {saveError && <Hint className="text-destructive" role="alert">{saveError}</Hint>}
        </div>
      </Row>

      <Section title="Grants" hint="Gives an account a tier until an end date">
        <Row label="Account Id" htmlFor="hosted-grant-user" hint="Copy it from the Users tab">
          <Input id="hosted-grant-user" value={grantUser} onChange={(event) => setGrantUser(event.target.value)} />
        </Row>
        <Row label="Tier" htmlFor="hosted-grant-tier">
          <Select value={grantTier} onValueChange={(value) => { const tier = SUPPORTER_TIERS.find((id) => id === value); if (tier) setGrantTier(tier); }}>
            <SelectTrigger id="hosted-grant-tier" aria-label="Grant Tier"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPORTER_TIERS.map((tier) => <SelectItem key={tier} value={tier}>{SUPPORTER_LABELS[tier]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Ends On" htmlFor="hosted-grant-end" hint="The end of that day, UTC">
          <Input id="hosted-grant-end" type="date" value={grantEnd} onChange={(event) => setGrantEnd(event.target.value)} />
        </Row>
        <Row>
          <Button type="button" onClick={createGrant} disabled={busy || !grantUser.trim() || !grantEnd}>Create Grant</Button>
        </Row>
        {grants === null ? <Skeleton className="h-4 w-48" /> : grants.length === 0 ? <Meta>No grants yet</Meta> : (
          <ul className="grid gap-2" aria-label="Grants">
            {grants.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center gap-2">
                <span className="mr-auto">
                  {grant.username} · {SUPPORTER_LABELS[grant.tier]} · {grant.revokedAt ? 'Revoked' : `Ends ${grant.endsAt.slice(0, 10)}`}
                </span>
                {grantLive(grant) && (
                  <Button type="button" size="sm" variant="outline" disabled={busy} aria-label={`Revoke grant for ${grant.username}`}
                    onClick={() => revoke(grant.id)}>Revoke</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Pause" hint="The daily ceiling pauses all hosted AI until 00:00 UTC">
        {pause === null ? <Skeleton className="h-4 w-48" /> : (
          <Row label="State">
            <div className="flex flex-wrap items-center gap-3">
              <span>{pause.paused ? `Paused since ${pause.pausedAt?.slice(11, 16)} UTC` : pause.liftedAt ? 'Lifted for today' : 'Running'}</span>
              <Button type="button" size="sm" variant="outline" disabled={!pause.paused || busy} onClick={lift}>Lift Pause</Button>
            </div>
          </Row>
        )}
      </Section>

      <Section title="Spend Report" hint={`Recorded spend and the provider’s figure per UTC day, last ${REPORT_DAYS} days`}>
        {report === null ? <Skeleton className="h-4 w-48" /> : report.length === 0 ? <Meta>No spend yet</Meta> : (
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr><th scope="col">Day</th><th scope="col">Calls</th><th scope="col">Recorded</th><th scope="col">Provider</th></tr>
            </thead>
            <tbody>
              {report.map((day) => (
                <tr key={day.day}>
                  <td>{day.day}</td><td>{day.calls}</td><td>{dollars(day.costMicros)}</td><td>{dollars(day.providerMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

/** The add and edit form for one approved model. */
function ModelForm({ draft, error, onChange, onSave, onCancel }: {
  draft: ModelDraft; error: string | null; onChange: (patch: Partial<ModelDraft>) => void; onSave: () => void; onCancel: () => void;
}): ReactNode {
  return (
    <div className="grid gap-4" role="group" aria-label={draft.editing === null ? 'New Model' : `Edit ${draft.editing}`}>
      <Row label="Model Id" htmlFor="hosted-model-id" hint="The name admins pick from">
        <Input id="hosted-model-id" value={draft.id} onChange={(event) => onChange({ id: event.target.value })} />
      </Row>
      <Row label="Upstream Model" htmlFor="hosted-model-upstream" hint="The provider’s model id">
        <Input id="hosted-model-upstream" value={draft.model} onChange={(event) => onChange({ model: event.target.value })} />
      </Row>
      <Row label="Prompt Price" htmlFor="hosted-model-prompt" hint="Dollars per million tokens">
        <NumberField id="hosted-model-prompt" label="Prompt Price" value={draft.prompt} step={0.01} onChange={(prompt) => onChange({ prompt })} />
      </Row>
      <Row label="Completion Price" htmlFor="hosted-model-completion" hint="Dollars per million tokens">
        <NumberField id="hosted-model-completion" label="Completion Price" value={draft.completion} step={0.01} onChange={(completion) => onChange({ completion })} />
      </Row>
      <Row label="Cached Price" htmlFor="hosted-model-cached" hint="Blank uses the prompt price">
        <NumberField id="hosted-model-cached" label="Cached Price" value={draft.cached} step={0.01} onChange={(cached) => onChange({ cached })} />
      </Row>
      <Row label="Tools" htmlFor="hosted-model-tools">
        <Checkbox id="hosted-model-tools" aria-label="Tools" checked={draft.tools} onCheckedChange={(checked) => onChange({ tools: checked === true })} />
      </Row>
      <Row label="Reasoning" htmlFor="hosted-model-reasoning">
        <Select value={draft.reasoning} onValueChange={(value) => onChange({ reasoning: isReasoningDialect(value) ? value : NO_REASONING })}>
          <SelectTrigger id="hosted-model-reasoning" aria-label="Reasoning"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REASONING}>None</SelectItem>
            {MODEL_DIALECTS.map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Reasoning Budget" htmlFor="hosted-model-budget">
        <Checkbox id="hosted-model-budget" aria-label="Reasoning Budget" checked={draft.budget} onCheckedChange={(checked) => onChange({ budget: checked === true })} />
      </Row>
      <Row label="Efforts" htmlFor="hosted-model-efforts" hint="Comma-separated effort names">
        <Input id="hosted-model-efforts" value={draft.efforts} onChange={(event) => onChange({ efforts: event.target.value })} />
      </Row>
      <Row label="Routing" htmlFor="hosted-model-routing" hint="Provider routing options as JSON" top>
        <Textarea id="hosted-model-routing" value={draft.routing} onChange={(event) => onChange({ routing: event.target.value })} />
      </Row>
      <Row label="Reasoning Options" htmlFor="hosted-model-reasoning-options" hint="Provider reasoning options as JSON" top>
        <Textarea id="hosted-model-reasoning-options" value={draft.reasoningOptions} onChange={(event) => onChange({ reasoningOptions: event.target.value })} />
      </Row>
      <Row>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={onSave}>Save Model</Button>
          {error && <Hint className="text-destructive" role="alert">{error}</Hint>}
        </div>
      </Row>
    </div>
  );
}
