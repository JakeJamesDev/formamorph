// Normalize a tag so formatting variants collapse to one value for matching:
// fold accents (NFKD + strip combining marks), lowercase, treat any run of non-alphanumerics
// as a single space -- except '/', which is kept (often used as "this/that"; spacing around it is
// normalized so "a / b" == "a/b"), then trim. '' for junk-only input.
export const sanitizeTag = (tag: string): string =>
  String(tag ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .replace(/\s*\/+\s*/g, '/')
    .trim();
