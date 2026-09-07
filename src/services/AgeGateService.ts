import AuthService from './AuthService';

interface AccountAgeGateState {
  accepted: boolean;
  requiredVersion: number;
  acceptedAt: string | null;
}

interface ErrorBody {
  error?: string;
  message?: string;
}

async function readResponse(response: Response, fallback: string): Promise<AccountAgeGateState> {
  const body = (await response.json().catch(() => ({}))) as AccountAgeGateState & ErrorBody;
  if (!response.ok) throw new Error(body.error || body.message || fallback);
  return body;
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
