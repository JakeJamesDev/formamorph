import { toast } from 'react-toastify';

/**
 * Run an encode pass behind a non-blocking progress toast — the work lives in a worker, so the app stays
 * usable while it runs. `fn` reports images finished via `tick`; the toast's bar fills toward `total` and
 * is dismissed when `fn` settles. Every optimize surface (prompts, batch imports, restore) reports through
 * this so the feedback can't drift between call sites.
 */
export async function withOptimizeProgress<T>(
  total: number,
  fn: (tick: (done: number) => void) => Promise<T>,
  label = 'Optimizing images',
): Promise<T> {
  const render = (done: number) => `${label}… ${done}/${total}`;
  const id = toast(render(0), { autoClose: false, progress: 0 });
  try {
    return await fn((done) => toast.update(id, { render: render(done), progress: done / total }));
  } finally {
    toast.dismiss(id);
  }
}
