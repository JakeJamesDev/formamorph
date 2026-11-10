import { useEffect, useId, useState, type ReactNode } from "react";
import { toastError } from "@/lib/linkToast";
import { OptionSwitcher, SectionHeading } from "@/components/SettingsRows";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hint, Meta } from "@/components/ui/typography";
import { downloadBlob } from "@/lib/downloadBlob";
import { useDevRoute } from "@/lib/devRouter";
import { useMountedRef } from "@/lib/useMountedRef";
import { useTierName } from "@/lib/tierNames";
import {
  NO_VALUE, axisTop, clientLabel, dayLabel, daysCsv, endingLabel, failureLabel, instantLabel, money, offerLabel, percent,
  promptTypeLabel, promptTypesCsv, refusalLabel, seconds, whole,
} from "@/lib/usageReport";
import HostedAiAdminService, {
  type HostedActiveFigures, type HostedAiAdminApi, type HostedPromptTypeUsage, type HostedUsageDay, type HostedUsageReport,
} from "@/services/HostedAiAdminService";

// scroll-guard: allow horizontal: wide tables scroll sideways inside the panel's vertical ScrollArea

type UsageApi = Pick<HostedAiAdminApi, 'fetchUsageReport'>;

const RANGES = [
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days' },
] as const;
type Range = (typeof RANGES)[number]['value'];

const CHART_HEIGHT = 120;
const CHART_FILL = 'bg-primary';

/** A heading and its content, with an optional control on the heading's rule. */
export function UsageSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const titleId = useId();
  return (
    <section role="group" aria-labelledby={titleId} className="grid content-start gap-3 min-w-0">
      <SectionHeading id={titleId} title={title} action={action} />
      {children}
    </section>
  );
}

export function Tile({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-card p-3">
      <Meta as="div">{label}</Meta>
      <div className="text-display font-semibold tabular-nums">{value}</div>
      <Meta as="div">{meta}</Meta>
    </div>
  );
}

/**
 * Columns per UTC day on one scale, with a readout of the day under the pointer. The chart is hidden from
 * assistive technology because the Per Day table holds the same figures.
 */
function DayChart({ days, valueOf, tickOf, describe, format }: {
  days: readonly HostedUsageDay[];
  valueOf: (day: HostedUsageDay) => number;
  /** A second figure, drawn as a tick across the column. Null draws none. */
  tickOf?: (day: HostedUsageDay) => number | null;
  describe: (day: HostedUsageDay) => string;
  format: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const top = axisTop(Math.max(...days.map((day) => Math.max(valueOf(day), tickOf?.(day) ?? 0))));
  const heightOf = (value: number) => Math.round((value / top) * CHART_HEIGHT);
  const shown = days.find((day) => day.day === hovered) ?? days[days.length - 1];

  return (
    <div className="grid gap-2 min-w-0">
      <Meta as="p" className="tabular-nums">{shown ? describe(shown) : NO_VALUE}</Meta>
      <div aria-hidden="true">
        <div className="relative border-b" style={{ height: CHART_HEIGHT }}>
          <div className="absolute inset-x-0 top-0 border-t"><Meta className="absolute left-0 top-0.5 tabular-nums">{format(top)}</Meta></div>
          <div className="absolute inset-x-0 border-t" style={{ bottom: CHART_HEIGHT / 2 }}><Meta className="absolute left-0 top-0.5 tabular-nums">{format(top / 2)}</Meta></div>
          <div className="absolute inset-y-0 left-12 right-0 flex items-end justify-between gap-0.5" onPointerLeave={() => setHovered(null)}>
            {days.map((day) => {
              const tick = tickOf?.(day) ?? null;
              return (
                <div key={day.day} data-day={day.day} className="relative h-full max-w-6 flex-1" onPointerEnter={() => setHovered(day.day)}>
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-t ${CHART_FILL} ${day.day === shown?.day ? '' : 'opacity-75'}`}
                    style={{ height: heightOf(valueOf(day)) }}
                  />
                  {tick !== null && <div className="absolute inset-x-0 h-0.5 bg-muted-foreground" style={{ bottom: heightOf(tick) }} />}
                </div>
              );
            })}
          </div>
        </div>
        <div className="ml-12 mt-1 flex justify-between">
          <Meta>{days[0] && dayLabel(days[0].day)}</Meta>
          <Meta>{days[days.length - 1] && dayLabel(days[days.length - 1].day)}</Meta>
        </div>
      </div>
    </div>
  );
}

/** One bar per row on a shared baseline, longest first as the caller orders them. */
function RankedBars({ rows, empty }: { rows: readonly { label: string; amount: number; value: string }[]; empty: string }) {
  if (rows.length === 0) return <Meta>{empty}</Meta>;
  const longest = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-2 text-label">
          <span className="min-w-0 truncate">{row.label}</span>
          <div aria-hidden="true" className="h-3">
            {row.amount > 0 && <div className={`h-3 min-w-0.5 rounded-r ${CHART_FILL}`} style={{ width: `${(row.amount / longest) * 100}%` }} />}
          </div>
          <span className="tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

interface Column<Row> {
  label: string;
  /** Left for words, right for figures. */
  left?: boolean;
  cell: (row: Row) => ReactNode;
}

/** A plain figures table. `rowKey` names each row; the first column is its row header. */
export function FiguresTable<Row>({ label, columns, rows, rowKey, minWidth, header }: {
  label: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  minWidth: string;
  /** Draws a column's header, for a table whose headers do more than name the column. */
  header?: (column: Column<Row>, index: number) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-label tabular-nums" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column.label} scope="col" className={`whitespace-nowrap border-b pb-1.5 pr-2 text-meta font-medium text-muted-foreground ${column.left ? 'text-left' : 'text-right'}`}>
                {header ? header(column, index) : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column, index) => {
                const Cell = index === 0 ? 'th' : 'td';
                return (
                  <Cell key={column.label} {...(index === 0 ? { scope: 'row' } : {})} className={`whitespace-nowrap border-b py-1.5 pr-2 font-normal ${column.left ? 'text-left' : 'text-right'}`}>
                    {column.cell(row)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PROMPT_COLUMNS: readonly (Column<HostedPromptTypeUsage> & { sort: (row: HostedPromptTypeUsage) => number | string })[] = [
  { label: 'Type', left: true, cell: (row) => promptTypeLabel(row.promptType), sort: (row) => promptTypeLabel(row.promptType) },
  { label: 'Calls', cell: (row) => whole(row.calls), sort: (row) => row.calls },
  { label: 'Cost', cell: (row) => money(row.costMicros), sort: (row) => row.costMicros },
  { label: 'Avg Prompt', cell: (row) => whole(row.avgPromptTokens), sort: (row) => row.avgPromptTokens ?? -1 },
  { label: 'Avg Output', cell: (row) => whole(row.avgOutputTokens), sort: (row) => row.avgOutputTokens ?? -1 },
  { label: 'Cached', cell: (row) => percent(row.cachedShare), sort: (row) => row.cachedShare ?? -1 },
  { label: 'First Token', cell: (row) => seconds(row.firstTokenP50Ms), sort: (row) => row.firstTokenP50Ms ?? -1 },
  { label: 'Tokens/Sec', cell: (row) => whole(row.tokensPerSecondP50), sort: (row) => row.tokensPerSecondP50 ?? -1 },
  { label: 'Longest Gap', cell: (row) => seconds(row.maxGapP90Ms), sort: (row) => row.maxGapP90Ms ?? -1 },
  { label: 'Failed', cell: (row) => whole(row.failed), sort: (row) => row.failed },
];

/** The prompt types, sorted by the column the reader picked. */
function PromptTypesTable({ rows }: { rows: readonly HostedPromptTypeUsage[] }) {
  const [sort, setSort] = useState({ column: 2, descending: true });
  const key = PROMPT_COLUMNS[sort.column].sort;
  const sorted = [...rows].sort((a, b) => {
    const [first, second] = sort.descending ? [b, a] : [a, b];
    const [left, right] = [key(first), key(second)];
    return typeof left === 'string' ? left.localeCompare(String(right)) : left - Number(right);
  });

  return (
    <FiguresTable
      label="Prompt Types"
      columns={PROMPT_COLUMNS}
      rows={sorted}
      rowKey={(row) => row.promptType ?? 'none'}
      minWidth="52rem"
      header={(column, index) => (
        <button
          type="button"
          className={`hover:text-foreground ${sort.column === index ? 'text-foreground' : ''}`}
          aria-label={`Sort by ${column.label}`}
          aria-pressed={sort.column === index}
          // Words read A to Z first and figures largest first.
          onClick={() => setSort({ column: index, descending: sort.column === index ? !sort.descending : !column.left })}
        >
          {column.label}{sort.column === index && <span aria-hidden="true">{sort.descending ? ' ↓' : ' ↑'}</span>}
        </button>
      )}
    />
  );
}

const exportCsv = (text: string, name: string) => downloadBlob(new Blob([text], { type: 'text/csv' }), name);

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" size="sm" variant="outline" aria-label={label} onClick={onClick}>Export CSV</Button>;
}

const SECTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'performance', label: 'Performance' },
  { value: 'clients', label: 'Clients And Offer' },
] as const;
type Section = (typeof SECTIONS)[number]['value'];

const DAY_METRICS = [
  { value: 'spend', label: 'Spend' },
  { value: 'turns', label: 'Turns' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'installs', label: 'Installs' },
] as const;
type DayMetric = (typeof DAY_METRICS)[number]['value'];

/** Mean day over month: the share of the month's users back on a typical day. */
const stickiness = (figures: HostedActiveFigures) => (figures.averageDay !== null && figures.month > 0 ? figures.averageDay / figures.month : null);

function ActiveUsers({ installs, accounts }: { installs: HostedActiveFigures; accounts: HostedActiveFigures }) {
  return (
    <UsageSection title="Active Users">
      <FiguresTable
        label="Active Users"
        minWidth="32rem"
        rows={[{ name: 'App Installs', figures: installs }, { name: 'AI Accounts', figures: accounts }]}
        rowKey={(row) => row.name}
        columns={[
          { label: 'Who', left: true, cell: (row) => row.name },
          { label: 'Today', cell: (row) => whole(row.figures.today) },
          { label: 'Yesterday', cell: (row) => whole(row.figures.yesterday) },
          { label: 'This Month', cell: (row) => whole(row.figures.month) },
          { label: 'Average Day', cell: (row) => (row.figures.averageDay === null ? NO_VALUE : row.figures.averageDay.toFixed(1)) },
          { label: 'Daily / Monthly', cell: (row) => percent(stickiness(row.figures)) },
        ]}
      />
      <Hint>Months are UTC calendar months. Average Day counts full days from the month&apos;s first counted day.</Hint>
    </UsageSection>
  );
}

function OverviewSection({ report, days }: { report: HostedUsageReport; days: Range }) {
  const [metric, setMetric] = useState<DayMetric>('spend');
  const { totals } = report;
  const entitled = report.tiers.reduce((sum, tier) => sum + tier.entitled, 0);
  const costPerTurn = totals.turns > 0 ? totals.costMicros / totals.turns : null;
  const count = (key: 'turns' | 'accounts' | 'installs', noun: string) => ({
    valueOf: (day: HostedUsageDay) => day[key],
    format: whole,
    describe: (day: HostedUsageDay) => `${dayLabel(day.day)}: ${whole(day[key])} ${noun}`,
  });
  const chart = metric === 'spend' ? {
    valueOf: (day: HostedUsageDay) => day.costMicros,
    tickOf: (day: HostedUsageDay) => day.providerMicros,
    format: (value: number) => money(value),
    describe: (day: HostedUsageDay) => `${dayLabel(day.day)}: ${money(day.costMicros)} Recorded, ${day.providerMicros === null ? 'Provider Not Read Yet' : `${money(day.providerMicros)} Provider`}`,
  } : metric === 'turns' ? count('turns', 'Turns') : metric === 'accounts' ? count('accounts', 'Accounts') : count('installs', 'Installs');

  return (
    <div className="grid gap-8">
      <ActiveUsers installs={report.activeUsers.installs} accounts={report.activeUsers.accounts} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 min-[1000px]:grid-cols-6">
        <Tile label="Spend" value={money(totals.costMicros)} meta={`${money(totals.providerMicros)} Provider`} />
        <Tile label="Turns" value={whole(totals.turns)} meta={`${whole(totals.calls)} Calls`} />
        <Tile label="Cost Per Turn" value={money(costPerTurn)} meta={totals.turns > 0 ? `${(totals.calls / totals.turns).toFixed(1)} Calls Per Turn` : NO_VALUE} />
        <Tile label="Active Accounts" value={whole(totals.accounts)} meta={`${whole(entitled)} Entitled`} />
        <Tile label="Failed Calls" value={percent(totals.calls > 0 ? totals.failed / totals.calls : null)} meta={`${whole(totals.failed)} Calls`} />
        <Tile label="Cached Tokens" value={percent(totals.cachedShare)} meta="Of Prompt Tokens" />
      </div>

      <UsageSection title="Per Day" action={<ExportButton label="Export Per Day As CSV" onClick={() => exportCsv(daysCsv(report.days), `usage-days-${days}.csv`)} />}>
        <div className="w-full sm:w-96">
          <OptionSwitcher ariaLabel="Chart" value={metric} onChange={setMetric} options={DAY_METRICS} />
        </div>
        {metric === 'spend' && (
          <div className="flex gap-4">
            <Meta className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${CHART_FILL}`} />Recorded</Meta>
            <Meta className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-3 bg-muted-foreground" />Provider</Meta>
          </div>
        )}
        <DayChart days={report.days} {...chart} />
        <FiguresTable
          label="Per Day"
          minWidth="36rem"
          rows={[...report.days].reverse()}
          rowKey={(day) => day.day}
          columns={[
            { label: 'Day', left: true, cell: (day) => day.day },
            { label: 'Calls', cell: (day) => whole(day.calls) },
            { label: 'Turns', cell: (day) => whole(day.turns) },
            { label: 'Accounts', cell: (day) => whole(day.accounts) },
            { label: 'Installs', cell: (day) => whole(day.installs) },
            { label: 'Recorded', cell: (day) => money(day.costMicros) },
            { label: 'Provider', cell: (day) => money(day.providerMicros) },
          ]}
        />
      </UsageSection>
    </div>
  );
}

function AccountsSection({ report }: { report: HostedUsageReport }) {
  const tierName = useTierName();
  return (
    <div className="grid gap-8">
      <UsageSection title="Heaviest Accounts">
        {report.heaviest.length === 0 ? <Meta>No calls this week</Meta> : (
          <FiguresTable
            label="Heaviest Accounts"
            minWidth="24rem"
            rows={report.heaviest.map((row, index) => ({ ...row, rank: index + 1 }))}
            rowKey={(row) => String(row.rank)}
            columns={[
              { label: 'Rank', left: true, cell: (row) => row.rank },
              { label: 'Tier', left: true, cell: (row) => tierName(row.tier) },
              { label: 'Turns', cell: (row) => whole(row.turns) },
              { label: 'Cost', cell: (row) => money(row.costMicros) },
              { label: 'Budget Used', cell: (row) => percent(row.budgetShare) },
            ]}
          />
        )}
      </UsageSection>

      <UsageSection title="Tiers">
        <FiguresTable
          label="Tiers"
          minWidth="38rem"
          rows={report.tiers}
          rowKey={(row) => row.tier}
          columns={[
            { label: 'Tier', left: true, cell: (row) => tierName(row.tier) },
            { label: 'Entitled', cell: (row) => whole(row.entitled) },
            { label: 'Active', cell: (row) => whole(row.active) },
            { label: 'Turns', cell: (row) => whole(row.turns) },
            { label: 'Cost', cell: (row) => money(row.costMicros) },
            { label: 'Cost Per Turn', cell: (row) => money(row.turns > 0 ? row.costMicros / row.turns : null) },
            { label: 'Most Budget Used', cell: (row) => percent(row.topBudgetShare) },
          ]}
        />
      </UsageSection>
    </div>
  );
}

/** Each refusal code summed over its tiers, most first. */
const refusalRows = (report: HostedUsageReport) => {
  const byCode = new Map<string, number>();
  for (const row of report.refusals.tiers) byCode.set(row.code, (byCode.get(row.code) ?? 0) + row.count);
  return [...byCode].sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ label: refusalLabel(code), amount: count, value: whole(count) }));
};

function PerformanceSection({ report, days }: { report: HostedUsageReport; days: Range }) {
  const { reservations } = report;
  return (
    <div className="grid gap-8">
      <UsageSection title="Prompt Types" action={<ExportButton label="Export Prompt Types As CSV" onClick={() => exportCsv(promptTypesCsv(report.promptTypes), `usage-prompt-types-${days}.csv`)} />}>
        {report.promptTypes.length === 0 ? <Meta>No calls in this range</Meta> : <PromptTypesTable rows={report.promptTypes} />}
      </UsageSection>

      <UsageSection title="Reservations">
        {reservations.promptTypes.length === 0 ? <Meta>No settled calls in this range</Meta> : (
          <FiguresTable
            label="Reservations"
            minWidth="30rem"
            rows={[...reservations.promptTypes.map((row) => ({ ...row, name: promptTypeLabel(row.promptType) })), { ...reservations.overall, name: 'All Types' }]}
            rowKey={(row) => row.name}
            columns={[
              { label: 'Type', left: true, cell: (row) => row.name },
              { label: 'Calls', cell: (row) => whole(row.calls) },
              { label: 'Reserved', cell: (row) => money(row.reserveMicros) },
              { label: 'Settled', cell: (row) => money(row.costMicros) },
              { label: 'Settled / Reserved', cell: (row) => percent(row.ratio) },
            ]}
          />
        )}
      </UsageSection>

      <div className="grid gap-8 md:grid-cols-2">
        <UsageSection title="How Calls Ended">
          <RankedBars
            empty="No calls in this range"
            rows={report.endings.map((row) => ({ label: endingLabel(row.status), amount: row.calls, value: whole(row.calls) }))}
          />
        </UsageSection>
        <UsageSection title="Failure Causes">
          <RankedBars
            empty="No failures in this range"
            rows={report.failures.map((row) => ({ label: failureLabel(row.failure), amount: row.calls, value: whole(row.calls) }))}
          />
        </UsageSection>
      </div>

      <UsageSection title="Refusals">
        <RankedBars empty="No refusals in this range" rows={refusalRows(report)} />
        <Meta>{`${whole(report.refusals.budgetExhaustedAccounts)} Accounts Used Up Their Budget`}</Meta>
      </UsageSection>

      <UsageSection title="Slowest Calls">
        {report.slowest.length === 0 ? <Meta>No timed calls in this range</Meta> : (
          <FiguresTable
            label="Slowest Calls"
            minWidth="38rem"
            rows={report.slowest}
            rowKey={(row) => `${row.startedAt}-${row.promptType}-${row.firstTokenMs}-${row.maxGapMs}`}
            columns={[
              { label: 'Started', left: true, cell: (row) => instantLabel(row.startedAt) },
              { label: 'Type', left: true, cell: (row) => promptTypeLabel(row.promptType) },
              { label: 'First Token', cell: (row) => seconds(row.firstTokenMs) },
              { label: 'Longest Gap', cell: (row) => seconds(row.maxGapMs) },
              { label: 'Tokens/Sec', cell: (row) => whole(row.tokensPerSecond) },
              { label: 'Ended', left: true, cell: (row) => (row.failure ? failureLabel(row.failure) : endingLabel(row.status)) },
            ]}
          />
        )}
      </UsageSection>
    </div>
  );
}

function ClientsSection({ report }: { report: HostedUsageReport }) {
  return (
    <div className="grid gap-8">
      <UsageSection title="Client Versions">
        {report.clients.length === 0 ? <Meta>No versioned calls in this range</Meta> : (
          <FiguresTable
            label="Client Versions"
            minWidth="32rem"
            rows={report.clients}
            rowKey={(row) => row.clientVersion ?? 'none'}
            columns={[
              { label: 'Version', left: true, cell: (row) => clientLabel(row.clientVersion) },
              { label: 'Calls', cell: (row) => whole(row.calls) },
              { label: 'Turns', cell: (row) => whole(row.turns) },
              { label: 'Cost', cell: (row) => money(row.costMicros) },
              { label: 'Turns Without Narration', cell: (row) => whole(row.turnsWithoutNarration) },
            ]}
          />
        )}
      </UsageSection>

      <UsageSection title="Offer Steps">
        <RankedBars
          empty="No offer steps in this range"
          rows={report.offer.every((row) => row.count === 0) ? [] : report.offer.map((row, index) => {
            const previous = report.offer[index - 1]?.count;
            return {
              label: offerLabel(row.step),
              amount: row.count,
              value: previous ? `${whole(row.count)} (${percent(row.count / previous)})` : whole(row.count),
            };
          })}
        />
      </UsageSection>
    </div>
  );
}

function ReportView({ report, days, section }: { report: HostedUsageReport; days: Range; section: Section }) {
  if (section === 'accounts') return <AccountsSection report={report} />;
  if (section === 'performance') return <PerformanceSection report={report} days={days} />;
  if (section === 'clients') return <ClientsSection report={report} />;
  return <OverviewSection report={report} days={days} />;
}

/** Reads the report for a range and draws it. The range's last answer stays on screen until the next one lands. */
export function UsagePanel({ active, api }: { active: boolean; api: UsageApi }) {
  const [range, setRange] = useState<Range>('14');
  const [section, setSection] = useState<Section>('overview');
  const [report, setReport] = useState<{ range: Range; data: HostedUsageReport } | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!active) return;
    let current = true;
    setUnreadable(false);
    api.fetchUsageReport(Number(range))
      .then((data) => { if (current && mounted.current) setReport({ range, data }); })
      .catch((error: unknown) => {
        if (!current || !mounted.current) return;
        setUnreadable(true);
        toastError(error, 'Failed to read the usage report');
      });
    return () => { current = false; };
  }, [active, api, range, mounted]);

  const week = report?.data.week;

  return (
    <div className="py-4 min-w-0 grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-title font-semibold">Formamorph AI Usage</h2>
          <Hint>All days and times are UTC</Hint>
        </div>
        {section === 'accounts' ? (
          <Meta as="p" className="tabular-nums">
            {week ? `Budget Week ${dayLabel(week.since.slice(0, 10))} To ${dayLabel(week.resetAt.slice(0, 10))}` : NO_VALUE}
          </Meta>
        ) : (
          <div className="w-full sm:w-72">
            <OptionSwitcher ariaLabel="Range" value={range} onChange={setRange} options={RANGES} />
          </div>
        )}
      </div>
      <Tabs value={section} onValueChange={(value) => setSection(value as Section)}>
        <TabsList aria-label="Usage Sections" className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          {SECTIONS.map((entry) => <TabsTrigger key={entry.value} value={entry.value}>{entry.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {report ? <ReportView report={report.data} days={report.range} section={section} /> : unreadable ? <Meta>The usage report could not be read</Meta> : <Skeleton className="h-32 w-full" />}
    </div>
  );
}

/** Admin Panel, Usage tab. */
export function UsageTab({ active }: { active: boolean }) {
  // DEV: `fixture=usage` swaps the report route for canned figures.
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'adminPanel' && devRoute.tab === 'usage' && devRoute.fixture === 'usage';
  const [devApi, setDevApi] = useState<UsageApi | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || !devFixture || devApi) return;
    let current = true;
    void import('@/lib/devUsageSample').then((loaded) => { if (current) setDevApi(loaded.createDevUsageApi()); });
    return () => { current = false; };
  }, [devFixture, devApi]);

  const api = import.meta.env.DEV && devFixture ? devApi : HostedAiAdminService;

  return api ? <UsagePanel active={active} api={api} /> : null;
}
