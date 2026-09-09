import type { ReactNode } from 'react';
import { Tip } from '@/components/ui/tooltip';
import { formatBytes } from '@/lib/imageOptim';
import type { VrmLicense } from '@/types';

/** One label/value row. `min-w-0` on the value cell lets a long value truncate rather than forcing the
 *  container wider (grid tracks default to `min-width: auto`). */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-meta font-medium text-muted-foreground">{label}</span>
      <span className="text-meta min-w-0">{children}</span>
    </div>
  );
}

/** Stands in wherever a model told us nothing — absent metadata is unknown, never permission. */
const Unknown = () => <span className="text-muted-foreground italic">Unknown</span>;

/** VRM 1.0's commercial-use options are finer than 0.0's allow/disallow; name each in the author's terms. */
const COMMERCIAL_LABELS: Record<NonNullable<VrmLicense['commercialUse']>, string> = {
  allow: 'Allowed',
  disallow: 'Not allowed',
  personalNonProfit: 'Personal, non-profit only',
  personalProfit: 'Personal, profit allowed',
  corporation: 'Allowed, including commercial',
};

const TONE_CLASS = { good: 'text-success', bad: 'text-destructive' } as const;

/** Yes/no/unknown flag. Each branch names its own tone, since which side is the good news differs per field:
 *  redistribution-not-allowed is a restriction (bad), but credit-not-required is a freedom (good). A missing
 *  flag reads as "unknown", never as a "no". */
function Flag({ value, yes, no }: {
  value?: boolean;
  yes: { label: string; tone?: keyof typeof TONE_CLASS };
  no: { label: string; tone?: keyof typeof TONE_CLASS };
}) {
  if (value === undefined) return <Unknown />;
  const { label, tone } = value ? yes : no;
  return <span className={tone && TONE_CLASS[tone]}>{label}</span>;
}

/**
 * What a VRM file says about itself: who made it, what format it is, and what it permits.
 *
 * Shared by every surface that shows a model's terms — the library's details panel, and a published
 * Avatar's listing — so one set of rows and one wording answers "what am I allowed to do with this?"
 * wherever the question is asked.
 *
 * @param license - The file's normalized license; absent while it is still being resolved
 * @param size - The file's size in bytes, on the surfaces that hold the file itself
 * @param children - Rows this surface adds after the file's own, such as a verdict about it
 */
export function VrmFileDetails({ license, size, children }: {
  license?: VrmLicense;
  size?: number;
  children?: ReactNode;
}) {
  const authors = license?.authors?.length ? license.authors.join(', ') : null;

  return (
    <div>
      <Row label="Author">{authors ?? <Unknown />}</Row>
      <Row label="Format">
        {license?.metaVersion === null
          ? 'glTF (no VRM data)'
          : `VRM ${license?.metaVersion === '0' ? '0.0' : '1.0'}`}
      </Row>
      {size !== undefined && <Row label="Size">{formatBytes(size)}</Row>}
      <Row label="License">
        {license?.licenseName ?? (license?.licenseUrl
          ? (
            <Tip tip={license.licenseUrl} labelsChild={false}>
              <a href={license.licenseUrl} target="_blank" rel="noopener noreferrer" className="block truncate underline hover:text-foreground">{license.licenseUrl}</a>
            </Tip>
          )
          : <Unknown />)}
      </Row>
      <Row label="Redistribution">
        <Flag value={license?.allowRedistribution} yes={{ label: 'Allowed', tone: 'good' }} no={{ label: 'Not allowed', tone: 'bad' }} />
      </Row>
      <Row label="Commercial use">
        {license?.commercialUse ? COMMERCIAL_LABELS[license.commercialUse] : <Unknown />}
      </Row>
      <Row label="Credit">
        <Flag value={license?.creditRequired} yes={{ label: 'Required' }} no={{ label: 'Not required', tone: 'good' }} />
      </Row>

      {children}

      {license?.metaVersion === null && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          A plain glTF file carries no license information, and isn&apos;t guaranteed to pose or morph like a VRM.
        </p>
      )}
      {license?.creditRequired && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          This model&apos;s author asks to be credited wherever it appears.
        </p>
      )}
    </div>
  );
}
