import { useEffect, useState, type ReactNode } from "react";
import { toastError } from "@/lib/linkToast";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentSwatch, SegmentedBar } from "@/components/ui/segmented-bar";
import { Hint, Meta } from "@/components/ui/typography";
import { CollapsingToggleGroup } from "@/components/ui/collapsing-toggle-group";
import { DayChart, FiguresTable, Tile, UsageSection } from "@/components/menu/UsageTab";
import { useDevRoute } from "@/lib/devRouter";
import { useMountedRef } from "@/lib/useMountedRef";
import { useIsMobile } from "@/lib/useIsMobile";
import { NO_VALUE, bytes, dayLabel, instantLabel, percent, whole } from "@/lib/usageReport";
import {
  type BucketRow, bucketRows, bucketSegments, databaseDisk, diskLabel, diskSegments, diskUsedOn, partLabel, r2TotalOn, staleHours,
  tableParts,
} from "@/lib/storageReport";
import { describeError } from "@/lib/errorDetails";
import StorageReportService, { type StorageDisk, type StorageReport, type StorageReportApi, type StorageReportDay } from "@/services/StorageReportService";

const RANGES = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: '365', label: '365 Days' },
] as const;
type Range = (typeof RANGES)[number]['value'];
/** Tailwind's `sm`. */
const SM_BREAKPOINT = 640;
/** The server fits its forecast to this many days, whatever range it reports. */
const FORECAST_DAYS = 30;

const levelsLabel = (levels: readonly number[]) => levels.map((level) => percent(level)).join(' And ');

function DiskView({ disk, report, heading, vacuum }: { disk: StorageDisk; report: StorageReport; heading: boolean; vacuum: boolean }) {
  const daysUntilFull = report.forecast[disk.id]?.daysUntilFull ?? null;
  const tiles = (
    <div className={`grid grid-cols-2 gap-2 ${vacuum ? 'min-[1000px]:grid-cols-4' : 'min-[1000px]:grid-cols-3'}`}>
      <Tile label="Used" value={percent(disk.usedFraction)} meta={`${bytes(disk.used)} Of ${bytes(disk.total)}`} />
      <Tile label="Free" value={bytes(disk.free)} meta={disk.alertLevels.length > 0 ? `Admins Get Mail At ${levelsLabel(disk.alertLevels)} Used` : 'No Alert Mail'} />
      <Tile
        label="Days Until Full"
        value={daysUntilFull === null ? NO_VALUE : whole(daysUntilFull)}
        meta={daysUntilFull === null ? 'Not Enough Growth To Estimate' : `From The Last ${FORECAST_DAYS} Days`}
      />
      {vacuum && (
        <Tile
          label="Vacuum"
          value={report.vacuumFits ? 'Fits' : 'Does Not Fit'}
          meta="Needs Free Space Of Twice The Database"
        />
      )}
    </div>
  );
  const bar = (
    <SegmentedBar
      label={heading ? `${diskLabel(disk)} Contents` : 'Disk Contents'}
      scale={disk.total}
      segments={diskSegments(disk, report.parts)}
      marks={disk.alertLevels.map((level) => ({ at: level, label: percent(level) }))}
      format={bytes}
    />
  );
  return heading
    ? <UsageSection title={diskLabel(disk)}>{tiles}{bar}</UsageSection>
    : <div className="grid gap-6 min-w-0">{tiles}{bar}</div>;
}

function MeasuredCell({ iso, now, verb }: { iso: string; now: number; verb: 'Measured' | 'Checked' }) {
  const hours = staleHours(iso, now);
  return (
    <>
      {instantLabel(iso)}
      {hours !== null && <Meta as="div">{`Not ${verb} For ${hours} Hours`}</Meta>}
    </>
  );
}

function R2View({ r2, now }: { r2: NonNullable<StorageReport['r2']>; now: number }) {
  const rows = bucketRows(r2);
  const segments = bucketSegments(rows);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const over = total - r2.freeTierBytes;
  // A bucket never checked has a size, so the measured buckets are a floor.
  const atLeast = rows.some((row) => row.bucket === null) ? 'at least ' : '';
  return (
    <>
      <Meta as="p" className="tabular-nums">
        {over > 0
          ? `R2 holds ${atLeast}${bytes(total)}, ${atLeast}${bytes(over)} over the ${bytes(r2.freeTierBytes)} free tier`
          : `R2 holds ${atLeast}${bytes(total)} of the ${bytes(r2.freeTierBytes)} free tier`}
      </Meta>
      <SegmentedBar label="R2 Buckets" legend={false} scale={r2.freeTierBytes} segments={segments} format={bytes} />
      <FiguresTable
        label="R2 Buckets"
        minWidth="32rem"
        rows={rows}
        rowKey={(row) => row.name}
        columns={[
          { label: 'Bucket', left: true, cell: (row: BucketRow) => (
            <span className="inline-flex items-center gap-2">
              <SegmentSwatch color={row.color} />
              {row.name}
            </span>
          ) },
          { label: 'Size', cell: (row) => bytes(row.bucket?.bytes ?? null) },
          { label: 'Objects', cell: (row) => whole(row.bucket?.objects ?? null) },
          { label: 'Checked', cell: (row) => (row.bucket ? <MeasuredCell iso={row.bucket.checkedAt} now={now} verb="Checked" /> : NO_VALUE) },
        ]}
      />
    </>
  );
}

function ChartBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 min-w-0">
      <h4 className="text-label font-medium">{title}</h4>
      {children}
    </div>
  );
}

function HistorySection({ report, range, onRangeChange }: { report: StorageReport; range: Range; onRangeChange: (range: Range) => void }) {
  const [diskId, setDiskId] = useState(report.disks[0]?.id ?? '');
  const disk = report.disks.find((candidate) => candidate.id === diskId) ?? report.disks[0];
  const several = report.disks.length > 1;
  const oldestFirst = [...report.days].reverse();
  const today = report.days[0]?.day;
  const buckets = report.r2 ? Object.keys(report.r2.buckets) : [];
  const alertLevel = disk?.alertLevels[0];
  const alertBytes = disk && alertLevel !== undefined ? alertLevel * disk.total : null;
  const sized = (value: number | null) => (value === null ? 'Not Measured' : bytes(value));
  // Four range labels do not fit beside the heading on a narrow screen.
  const narrow = useIsMobile(SM_BREAKPOINT);
  const ranges = <CollapsingToggleGroup aria-label="Range" className="sm:justify-end" value={range} onValueChange={onRangeChange} options={RANGES} />;

  return (
    <UsageSection title="History" action={narrow ? undefined : <div className="w-80">{ranges}</div>}>
      {narrow && ranges}
      {disk && (
        <ChartBlock title="Disk Used">
          {several && (
            <div className="w-full sm:w-[28rem]">
              <CollapsingToggleGroup
                aria-label="Disk"
                value={disk.id}
                onValueChange={setDiskId}
                options={report.disks.map((candidate) => ({ value: candidate.id, label: diskLabel(candidate) }))}
              />
            </div>
          )}
          {alertLevel !== undefined && (
            <Meta className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-3 bg-muted-foreground" />{`Alert Mail At ${percent(alertLevel)} Used`}
            </Meta>
          )}
          <DayChart
            days={oldestFirst}
            valueOf={(day) => diskUsedOn(day, disk)}
            tickOf={() => alertBytes}
            describe={(day) => `${dayLabel(day.day)}: ${sized(diskUsedOn(day, disk))}`}
            format={bytes}
          />
        </ChartBlock>
      )}

      <ChartBlock title="R2 Total">
        <DayChart
          days={oldestFirst}
          valueOf={(day) => r2TotalOn(day, buckets)}
          describe={(day) => `${dayLabel(day.day)}: ${sized(r2TotalOn(day, buckets))}`}
          format={bytes}
        />
      </ChartBlock>

      <ChartBlock title="Downloads">
        <Meta className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-primary opacity-40" />Today So Far
        </Meta>
        <DayChart
          days={oldestFirst}
          partialDay={today}
          valueOf={(day: StorageReportDay) => day.downloads}
          describe={(day) => `${day.day === today ? `${dayLabel(day.day)} So Far` : dayLabel(day.day)}: ${whole(day.downloads)} Downloads`}
          format={whole}
        />
      </ChartBlock>

      <FiguresTable
        label="Per Day"
        minWidth="30rem"
        rows={report.days}
        rowKey={(day) => day.day}
        columns={[
          { label: 'Day', left: true, cell: (day: StorageReportDay) => day.day },
          ...report.disks.map((column) => ({
            label: several ? `${diskLabel(column)} Used` : 'Disk Used',
            cell: (day: StorageReportDay) => bytes(diskUsedOn(day, column)),
          })),
          { label: 'R2 Total', cell: (day) => bytes(r2TotalOn(day, buckets)) },
          { label: 'Downloads', cell: (day) => (day.day === today ? `${whole(day.downloads)} (So Far)` : whole(day.downloads)) },
        ]}
      />
    </UsageSection>
  );
}

function ReportView({ report, range, onRangeChange }: { report: StorageReport; range: Range; onRangeChange: (range: Range) => void }) {
  const now = Date.now();
  const several = report.disks.length > 1;
  const vacuumDisk = databaseDisk(report);
  return (
    <div className="grid gap-8">
      {report.disks.map((disk) => (
        <DiskView key={disk.id} disk={disk} report={report} heading={several} vacuum={disk === vacuumDisk} />
      ))}

      <UsageSection title="What Uses The Disk">
        <FiguresTable
          label="What Uses The Disk"
          minWidth="32rem"
          rows={tableParts(report)}
          rowKey={(row) => row.name}
          columns={[
            { label: 'Part', left: true, cell: (row) => partLabel(row.name) },
            { label: 'Size', cell: (row) => bytes(row.part?.bytes ?? null) },
            { label: 'Files', cell: (row) => whole(row.part?.files ?? null) },
            { label: 'Measured', cell: (row) => (row.part ? <MeasuredCell iso={row.part.measuredAt} now={now} verb="Measured" /> : NO_VALUE) },
          ]}
        />
        <Hint><strong>System And App</strong> on the bar is the disk space outside these parts</Hint>
      </UsageSection>

      <UsageSection title="R2">
        {report.r2 ? <R2View r2={report.r2} now={now} /> : <Meta as="p">The server has no R2 access</Meta>}
      </UsageSection>

      <HistorySection report={report} range={range} onRangeChange={onRangeChange} />
    </div>
  );
}

/** Reads the storage report for a range and draws it. The last report stays on screen until the next one lands. */
export function StoragePanel({ active, api }: { active: boolean; api: StorageReportApi }) {
  const [range, setRange] = useState<Range>('30');
  const [report, setReport] = useState<StorageReport | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setFailure(null);
    api.fetchStorageReport(Number(range), controller.signal)
      .then((data) => { if (!controller.signal.aborted && mounted.current) setReport(data); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !mounted.current) return;
        setFailure(describeError(error, 'Failed to read the storage report').message);
        toastError(error, 'Failed to read the storage report');
      });
    return () => controller.abort();
  }, [active, api, range, mounted]);

  return (
    <div className="py-4 min-w-0 grid gap-6">
      <div className="min-w-0">
        <h2 className="text-title font-semibold">Storage</h2>
        <Hint>All times are UTC. The server measures every hour.</Hint>
      </div>
      {failure !== null && <Meta role="alert">{`The storage report could not be read: ${failure}`}</Meta>}
      {report ? <ReportView report={report} range={range} onRangeChange={setRange} /> : failure === null && <Skeleton className="h-32 w-full" />}
    </div>
  );
}

/** Admin Panel, Storage tab. */
export function StorageTab({ active }: { active: boolean }) {
  // DEV: `fixture=storage` swaps the report route for canned figures.
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'adminPanel' && devRoute.tab === 'storage' && devRoute.fixture === 'storage';
  const [devApi, setDevApi] = useState<StorageReportApi | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || !devFixture || devApi) return;
    let current = true;
    void import('@/lib/devStorageSample').then((loaded) => { if (current) setDevApi(loaded.createDevStorageApi()); });
    return () => { current = false; };
  }, [devFixture, devApi]);

  const api = import.meta.env.DEV && devFixture ? devApi : StorageReportService;

  return api ? <StoragePanel active={active} api={api} /> : null;
}
