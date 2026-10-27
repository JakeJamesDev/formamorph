export interface OwnerTermViolation {
  line: number;
  term: 'bearer' | 'holder';
  text: string;
}

/** Lines where "bearer" means the HTTP scheme or a token, never an owner. */
const HTTP_BEARER = /Authorization|authHeaders|['"`]Bearer |scheme: 'Bearer'|the others are `Bearer`|toContain\('Bearer'\)|bearer (header|token)|Bearer (header|token)|secret-bearer-token/i;

/** Tree identifiers that keep "holder" in the parent sense, and English words that contain it. */
const ALLOWED_HOLDER = /\b(holderOf|holderId|activeHolderId)\b|account holder|stallholder|placeholder|placholder|palceholder/gi;

/** Files that read or write the saved `bearer` key on purpose. */
const LEGACY_KEY_FILES = new Set([
  'src/lib/version.ts',
  'src/lib/version.test.ts',
  'src/lib/fileShapeCompat.test.ts',
  'src/lib/statConditionCard.test.ts',
  'src/services/EntityStorageService.test.ts',
]);

/** Embedded image bytes, whose base64 can spell either word by chance. */
const DATA_URI = /data:[\w/+.-]+;base64,[A-Za-z0-9+/=]*/g;

/** Doc and glossary lines that name the old words to say they are gone. */
const NAMES_THE_OLD_WORD = /_Avoid_: bearer, holder|Older files name the owner under `bearer`/;

/** The lines of one file that use bearer or holder in the owner sense. `path` is repo-relative with `/`. */
export function checkOwnerTerm(text: string, path: string): OwnerTermViolation[] {
  const legacy = LEGACY_KEY_FILES.has(path);
  const found: OwnerTermViolation[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(DATA_URI, '');
    if (NAMES_THE_OLD_WORD.test(line)) return;
    const row = (term: OwnerTermViolation['term']) => ({ line: i + 1, term, text: line.trim().slice(0, 120) });
    if (!legacy && /bearer/i.test(line) && !HTTP_BEARER.test(line)) found.push(row('bearer'));
    else if (/holder/i.test(line.replace(ALLOWED_HOLDER, ''))) found.push(row('holder'));
  });
  return found;
}
