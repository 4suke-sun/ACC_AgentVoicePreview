import type {
  ApiErrorBody,
  StartPreviewResponse,
  StopPreviewResponse,
  VoicesResponse,
} from '@avp/shared';

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const GENERIC_MESSAGE = '通信に失敗しました。しばらく待ってから、もう一度お試しください。';

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(baseUrl: string, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchFn = fetchFn;
  }

  async getVoices(): Promise<VoicesResponse> {
    return this.request<VoicesResponse>('GET', '/v1/voices');
  }

  async startPreview(text: string, voiceId: string): Promise<StartPreviewResponse> {
    return this.request<StartPreviewResponse>('POST', '/v1/preview-contacts', { text, voiceId });
  }

  async stopPreview(contactId: string): Promise<StopPreviewResponse> {
    return this.request<StopPreviewResponse>(
      'POST',
      `/v1/preview-contacts/${encodeURIComponent(contactId)}/stop`,
    );
  }

  /** ブラウザ終了時のベストエフォート停止(memo.txt 15章) */
  stopBeacon(contactId: string): void {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(
        `${this.baseUrl}/v1/preview-contacts/${encodeURIComponent(contactId)}/stop`,
      );
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('NETWORK_ERROR', GENERIC_MESSAGE, 0);
    }

    if (!response.ok) {
      throw await this.toApiError(response);
    }
    return (await response.json()) as T;
  }

  private async toApiError(response: Response): Promise<ApiError> {
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body?.error?.code && body.error.message) {
        return new ApiError(body.error.code, body.error.message, response.status);
      }
    } catch {
      // JSONでないエラーレスポンスは汎用メッセージにする
    }
    return new ApiError('UNKNOWN_ERROR', GENERIC_MESSAGE, response.status);
  }
}
