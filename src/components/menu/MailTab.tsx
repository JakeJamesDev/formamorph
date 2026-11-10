import { useEffect, useState } from "react";
import { toastError } from "@/lib/linkToast";
import { OptionSwitcher } from "@/components/SettingsRows";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint, Meta } from "@/components/ui/typography";
import { FiguresTable, Tile, UsageSection } from "@/components/menu/UsageTab";
import { useDevRoute } from "@/lib/devRouter";
import { useMountedRef } from "@/lib/useMountedRef";
import { NO_VALUE, instantLabel, whole } from "@/lib/usageReport";
import { describeError } from "@/lib/errorDetails";
import MailReportService, { type MailRate, type MailReport, type MailReportApi } from "@/services/MailReportService";

const RANGES = [
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days' },
] as const;
type Range = (typeof RANGES)[number]['value'];

/** A fraction as a percent, with the places a 0.1% limit needs. */
const rateLabel = (fraction: number) => `${Number((fraction * 100).toFixed(2))}%`;

const STATUS_LABELS: Record<string, string> = { HEALTHY: 'Healthy', PROBATION: 'Under Review', SHUTDOWN: 'Paused' };

/** The SES account as words: a status the reader can read without color. Null until the health job has run. */
function sesStatus(ses: MailReport['ses']): { value: string; meta: string } {
  if (!ses) return { value: 'Not Read Yet', meta: 'Read Every Hour' };
  const status = ses.enforcementStatus === null ? 'Unknown' : STATUS_LABELS[ses.enforcementStatus] ?? ses.enforcementStatus.charAt(0) + ses.enforcementStatus.slice(1).toLowerCase();
  const sendingOff = ses.sendingEnabled === false;
  const healthy = ses.enforcementStatus === 'HEALTHY' && !sendingOff;
  return {
    value: sendingOff && ses.enforcementStatus === 'HEALTHY' ? 'Sending Off' : status,
    meta: `${healthy ? 'Checked' : 'Needs Attention, Checked'} ${instantLabel(ses.checkedAt)}${sendingOff && ses.enforcementStatus !== 'HEALTHY' ? ', Sending Off' : ''}`,
  };
}

function RateTile({ label, rate, report }: { label: string; rate: MailRate; report: MailReport }) {
  const { measured, minVolume, volume } = report.rates;
  return (
    <Tile
      label={`${label} (${report.rates.windowDays} Days)`}
      value={measured && rate.rate !== null ? rateLabel(rate.rate) : 'Not Yet Measured'}
      meta={`Amazon Reviews At ${rateLabel(rate.limits.review)}${measured ? '' : `. ${whole(volume)} Of ${whole(minVolume)} Mails Needed`}`}
    />
  );
}

function ReportView({ report, days }: { report: MailReport; days: Range }) {
  const sum = (key: 'sent' | 'delivered' | 'hardBounced' | 'softBounced' | 'complained') => report.days.reduce((total, day) => total + day[key], 0);
  const status = sesStatus(report.ses);
  const last24 = report.last24Hours;

  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-2 gap-2 min-[1000px]:grid-cols-4">
        <Tile label="Sent" value={whole(sum('sent'))} meta={`Last ${days} Days`} />
        <Tile label="Delivered" value={whole(sum('delivered'))} meta={`Last ${days} Days`} />
        <Tile label="Bounced" value={whole(sum('hardBounced'))} meta={`Hard Bounces, ${whole(sum('softBounced'))} Soft`} />
        <Tile label="Complaints" value={whole(sum('complained'))} meta={`Last ${days} Days`} />
        <RateTile label="Bounce Rate" rate={report.rates.bounce} report={report} />
        <RateTile label="Complaint Rate" rate={report.rates.complaint} report={report} />
        <Tile label="SES Status" value={status.value} meta={status.meta} />
        <Tile
          label="Quota Used"
          value={last24 ? `${whole(last24.sent)} Of ${whole(last24.quota)}` : NO_VALUE}
          meta="Last 24 Hours"
        />
      </div>

      <UsageSection title="Per Day">
        <FiguresTable
          label="Per Day"
          minWidth="40rem"
          rows={report.days}
          rowKey={(day) => day.day}
          columns={[
            { label: 'Day', left: true, cell: (day) => day.day },
            { label: 'Sent', cell: (day) => whole(day.sent) },
            { label: 'Delivered', cell: (day) => whole(day.delivered) },
            { label: 'Delayed', cell: (day) => whole(day.delayed) },
            { label: 'Hard Bounced', cell: (day) => whole(day.hardBounced) },
            { label: 'Soft Bounced', cell: (day) => whole(day.softBounced) },
            { label: 'Complaints', cell: (day) => whole(day.complained) },
          ]}
        />
        <Hint>Each mail counts on the day it was sent, under its latest result.</Hint>
      </UsageSection>
    </div>
  );
}

/** Reads the mail report for a range and draws it. A failed read replaces the report with its reason. */
export function MailPanel({ active, api }: { active: boolean; api: MailReportApi }) {
  const [range, setRange] = useState<Range>('14');
  const [report, setReport] = useState<{ range: Range; data: MailReport } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setFailure(null);
    api.fetchMailReport(Number(range), controller.signal)
      .then((data) => { if (!controller.signal.aborted && mounted.current) setReport({ range, data }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !mounted.current) return;
        setFailure(describeError(error, 'Failed to read the mail report').message);
        toastError(error, 'Failed to read the mail report');
      });
    return () => controller.abort();
  }, [active, api, range, mounted]);

  return (
    <div className="py-4 min-w-0 grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-title font-semibold">Mail</h2>
          <Hint>All days and times are UTC. Rates cover the last 7 days whatever the range.</Hint>
        </div>
        <div className="w-full sm:w-72">
          <OptionSwitcher ariaLabel="Range" value={range} onChange={setRange} options={RANGES} />
        </div>
      </div>
      {failure !== null
        ? <Meta role="alert">{`The mail report could not be read: ${failure}`}</Meta>
        : report ? <ReportView report={report.data} days={report.range} /> : <Skeleton className="h-32 w-full" />}
    </div>
  );
}

/** Admin Panel, Mail tab. */
export function MailTab({ active }: { active: boolean }) {
  // DEV: `fixture=mail` or `fixture=mailReview` swaps the report route for canned figures.
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'adminPanel' && devRoute.tab === 'mail'
    && (devRoute.fixture === 'mail' || devRoute.fixture === 'mailReview') ? devRoute.fixture : null;
  const [devApi, setDevApi] = useState<{ fixture: string; api: MailReportApi } | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || !devFixture || devApi?.fixture === devFixture) return;
    let current = true;
    void import('@/lib/devMailSample').then((loaded) => {
      if (current) setDevApi({ fixture: devFixture, api: loaded.createDevMailApi(devFixture === 'mailReview') });
    });
    return () => { current = false; };
  }, [devFixture, devApi]);

  const api = import.meta.env.DEV && devFixture ? (devApi?.fixture === devFixture ? devApi.api : null) : MailReportService;

  return api ? <MailPanel active={active} api={api} /> : null;
}
