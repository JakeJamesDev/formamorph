import AuthService from './AuthService';
import type { ServerEvent, ServerEventDraft } from '@/types';

/** Server error envelope: this API answers with `error`, older handlers read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/**
 * Timed community events — contests and announcements the whole player base sees. Reads a public
 * endpoint, so it works signed out; the token rides along when there is one so the server can tell
 * staff-visible rows apart.
 *
 * Default-exported as one shared instance, matching `AuthService` and `MessageService`.
 */
class EventService {
  private get apiUrl() {
    return AuthService.API_URL;
  }

  /** A bearer header only when signed in — the read surface is public, so an anonymous call is normal. */
  private authHeaders(): HeadersInit {
    return AuthService.token ? { Authorization: `Bearer ${AuthService.token}` } : {};
  }

  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      throw new Error(body.error || body.message || fallback);
    }
    return (await response.json()) as T;
  }

  /** A JSON body with the caller's token — every write below needs one. */
  private writeHeaders(): HeadersInit {
    return { 'Content-Type': 'application/json', ...this.authHeaders() };
  }

  /** Every event currently running, of every type. Empty on a server that has no events layer. */
  async fetchActive(): Promise<ServerEvent[]> {
    const response = await fetch(`${this.apiUrl}/events/active`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: ServerEvent[] }>(response, 'Failed to load events');
    return body.data ?? [];
  }

  /**
   * Every event that has started, the ones already over included — what the contest archives are read
   * from. Staff additionally see what is still scheduled, which is why the token rides along.
   */
  async fetchList(): Promise<ServerEvent[]> {
    const response = await fetch(`${this.apiUrl}/events`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: ServerEvent[] }>(response, 'Failed to load events');
    return body.data ?? [];
  }

  /**
   * Schedule an event. Administrator only; the server posts its opening announcement itself.
   *
   * @param draft - The authored fields, with the window as ISO instants
   */
  async create(draft: ServerEventDraft): Promise<ServerEvent> {
    const response = await fetch(`${this.apiUrl}/events`, {
      method: 'POST',
      headers: this.writeHeaders(),
      body: JSON.stringify(draft),
    });
    return (await this.unwrap<{ data: ServerEvent }>(response, 'Failed to create the event')).data;
  }

  /**
   * Rewrite an event. Nothing is re-announced: the notices already sent are ordinary broadcasts, edited
   * under Broadcasts. A started event's start cannot move, and a type never changes.
   *
   * @param draft - The fields to change; a key left out is a field left alone, which is how an edit
   *                to a started event avoids naming the start it may no longer move
   */
  async update(id: string, draft: Partial<ServerEventDraft>): Promise<ServerEvent> {
    const response = await fetch(`${this.apiUrl}/events/${id}`, {
      method: 'PUT',
      headers: this.writeHeaders(),
      body: JSON.stringify(draft),
    });
    return (await this.unwrap<{ data: ServerEvent }>(response, 'Failed to save the event')).data;
  }

  /** Call an event off — the answer for anything already announced. Releases a contest's entries. */
  async cancel(id: string): Promise<ServerEvent> {
    const response = await fetch(`${this.apiUrl}/events/${id}/cancel`, {
      method: 'POST',
      headers: this.writeHeaders(),
    });
    return (await this.unwrap<{ data: ServerEvent }>(response, 'Failed to cancel the event')).data;
  }

  /** Remove an event nobody was told about. The server refuses one that has started. */
  async remove(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/events/${id}`, {
      method: 'DELETE',
      headers: this.writeHeaders(),
    });
    await this.unwrap<{ success: boolean }>(response, 'Failed to delete the event');
  }

  /** Name a contest's winner. Any staff; the server refuses the picker's own entry and a quarantined one. */
  async pickWinner(id: string, worldId: string): Promise<ServerEvent> {
    const response = await fetch(`${this.apiUrl}/events/${id}/winner`, {
      method: 'PUT',
      headers: this.writeHeaders(),
      body: JSON.stringify({ worldId }),
    });
    return (await this.unwrap<{ data: ServerEvent }>(response, 'Failed to announce the winner')).data;
  }
}

export default new EventService();
