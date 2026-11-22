import type { LocalInstalledModel } from '@/lib/imageGen/desktop';

/** localStorage key for the user's manual ordering of the Installed list (model refs, in order). */
const INSTALLED_ORDER_KEY = 'formamorph:installedModelOrder';

/** Sort installed models by the saved manual order; unranked (new) files keep their input order at the end. */
export function applyInstalledOrder(list: LocalInstalledModel[]): LocalInstalledModel[] {
  let order: unknown = [];
  try { order = JSON.parse(localStorage.getItem(INSTALLED_ORDER_KEY) || '[]'); } catch { /* ignore */ }
  const ids = Array.isArray(order) ? order : [];
  const rank = (id: string) => { const i = ids.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id));
}

/** Save the Installed list's manual order. */
export function saveInstalledOrder(list: LocalInstalledModel[]): void {
  try { localStorage.setItem(INSTALLED_ORDER_KEY, JSON.stringify(list.map((m) => m.id))); } catch { /* ignore */ }
}
