// Build signature baked at release time. Do not edit by hand.
declare global {
  interface Window {
    /** Build signature (release integrity). */
    __fmb?: string;
  }
}

// Release signature (reversed base64).
const SIG =
  '==Qfi4ycyV3b5BCdv5GIzlGI0lGIsI3boRXdhBCdv5GIklGZgU3b5BSew92YgEGIulGIzlGa0ByZulGZhVmcgUmchBSdvlHImlEIusmch1GIlNmbh5WZ29mcwBicvhGd1FWLsFmbpdWay9GIUCo4ggGcy9Wbh1mcvZkI6IibiwiI0ATL3ATL2IDMyIiOiQmIsIyN5YWZmFWM1YDZ4gTLjdTMh1CZlFGNtMmN1kTL3QmYxQTOjJjI6ICZpJCLigGcy9Wbh1mcvZ2L2VGRzVWbhpUZrFmSv02bj5iY1hGdpdmI6IiciwiIXZ0UONXZtFmSltWYK9SbvNmLu9WZyRXYwJiOigmIsIycl1WYKBSZrFmSiojIhJye';

/** Decode the build signature (used by release/integrity tooling). */
export function buildSignature(): string {
  try {
    return atob(SIG.split('').reverse().join(''));
  } catch {
    return '';
  }
}

// Publish it so it survives the build (an otherwise-unused constant would be tree-shaken out).
if (typeof window !== 'undefined') window.__fmb = SIG;
