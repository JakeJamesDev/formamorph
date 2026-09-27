import AuthService from './AuthService';
import { responseError } from './responseError';

interface AccountAgeGateState {
  accepted: boolean;
  requiredVersion: number;
  acceptedAt: string | null;
}

async function readResponse(response: Response, fallback: string): Promise<AccountAgeGateState> {
  if (!response.ok) throw await responseError(response, fallback);
  return (await response.json().catch(() => ({}))) as AccountAgeGateState;
}

class AgeGateService {
  async read(): Promise<AccountAgeGateState> {
    const response = await fetch(`${AuthService.API_URL}/policies/age-gate`, {
      headers: { Authorization: `Bearer ${AuthService.token}` },
    });
    return readResponse(response, 'Failed to check your content-warning answer');
  }

  async accept(acceptanceVersion: number): Promise<AccountAgeGateState> {
    const response = await fetch(`${AuthService.API_URL}/policies/age-gate/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AuthService.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ acceptanceVersion }),
    });
    return readResponse(response, 'Failed to record your answer');
  }
}

export default new AgeGateService();
