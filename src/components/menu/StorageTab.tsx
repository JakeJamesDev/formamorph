import { useEffect, useState } from "react";
import { toastError } from "@/lib/linkToast";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { Hint, Meta } from "@/components/ui/typography";
import { FiguresTable, Tile, UsageSection } from "@/components/menu/UsageTab";
import { useDevRoute } from "@/lib/devRouter";
import { useMountedRef } from "@/lib/useMountedRef";
import { NO_VALUE, bytes, instantLabel, percent, whole } from "@/lib/usageReport";
import { databaseDisk, diskLabel, diskSegments, partLabel, staleHours, tableParts } from "@/lib/storageReport";
import { describeError } from "@/lib/errorDetails";
import StorageReportService, { type StorageDisk, type StorageReport, type StorageReportApi } from "@/services/StorageReportService";

const DAYS = 30;
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

function MeasuredCell({ iso, now }: { iso: string; now: number }) {
  const hours = staleHours(iso, now);
  return (
    <>
      {instantLabel(iso)}
      {hours !== null && <Meta as="div">{`Not Measured For ${hours} Hours`}</Meta>}
    </>
  );
}

function ReportView({ report }: { report: StorageReport }) {
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
            { label: 'Measured', cell: (row) => (row.part ? <MeasuredCell iso={row.part.measuredAt} now={now} /> : NO_VALUE) },
          ]}
        />
        <Hint><strong>System And App</strong> on the bar is the disk space outside these parts</Hint>
      </UsageSection>
    </div>
  );
}

/** Reads the storage report and draws it. A failed read replaces the report with its reason. */
export function StoragePanel({ active, api }: { active: boolean; api: StorageReportApi }) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setFailure(null);
    api.fetchStorageReport(DAYS, controller.signal)
      .then((data) => { if (!controller.signal.aborted && mounted.current) setReport(data); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !mounted.current) return;
        setFailure(describeError(error, 'Failed to read the storage report').message);
        toastError(error, 'Failed to read the storage report');
      });
    return () => controller.abort();
  }, [active, api, mounted]);

  return (
    <div className="py-4 min-w-0 grid gap-6">
      <div className="min-w-0">
        <h2 className="text-title font-semibold">Storage</h2>
        <Hint>All times are UTC. The server measures every hour.</Hint>
      </div>
      {failure !== null && <Meta role="alert">{`The storage report could not be read: ${failure}`}</Meta>}
      {report ? <ReportView report={report} /> : failure === null && <Skeleton className="h-32 w-full" />}
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
