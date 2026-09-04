import { PRIVACY_REQUIRED } from '@/services/PolicyService';
import { urlOf } from '@/lib/fetchTarget';

/** What a refused request answers with; only `code` decides anything here. */
interface RefusalBody {
  code?: string;
}

/**
 * Watch every reply from the community server for the Privacy Policy refusal.
 *
 * The refusal can answer any authenticated route, and the client reaches that server from a dozen
 * services that each call `fetch` directly — so this wraps `fetch` itself rather than asking every
 * caller to recognize one status code. Requests to anywhere else are passed straight through.
 *
 * The response is returned untouched and its body is read from a clone, because the caller still has
 * to read it: an older build shows the server's `error` sentence verbatim, and consuming the stream
 * here would leave it with nothing to show.
 *
 * @param apiUrl - The community server's base URL; only replies from it are inspected
 * @param onRefusal - Run once per refused request
 * @returns A function restoring the previous `fetch`
 */
export function watchPrivacyRefusals(apiUrl: string, onRefusal: () => void): () => void {
  const previous = window.fetch;

  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await previous(...args);

    if (response.status === 403 && urlOf(args[0]).startsWith(apiUrl)) {
      const body = (await response.clone().json().catch(() => null)) as RefusalBody | null;
      if (body?.code === PRIVACY_REQUIRED) onRefusal();
    }

    return response;
  };

  return () => { window.fetch = previous; };
}
