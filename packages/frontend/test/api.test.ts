import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ApiClient', () => {
  it('startPreview が正しいリクエストを送る', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        previewId: 'p-1',
        contactId: 'c-1',
        connectionData: { meeting: {}, attendee: {} },
      }),
    );
    const client = new ApiClient('https://api.example.com/', fetchMock);

    const result = await client.startPreview('こんにちは', 'ja-jp-voice-a');

    expect(result.contactId).toBe('c-1');
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/preview-contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'こんにちは', voiceId: 'ja-jp-voice-a' }),
    });
  });

  it('stopPreview がcontactIdをURLエンコードして送る', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { contactId: 'c 1', status: 'STOPPED' }));
    const client = new ApiClient('https://api.example.com', fetchMock);

    await client.stopPreview('c 1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/preview-contacts/c%201/stop',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('getVoices が音声一覧を返す', async () => {
    const voices = [{ id: 'a', displayName: 'A', locale: 'ja-JP' }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { voices }));
    const client = new ApiClient('https://api.example.com', fetchMock);

    await expect(client.getVoices()).resolves.toEqual({ voices });
  });

  it('APIエラーレスポンスをApiErrorへ変換する(memo.txt 12.1)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'TEXT_TOO_LONG', message: '文章は最大3000文字までです。' },
      }),
    );
    const client = new ApiClient('https://api.example.com', fetchMock);

    const error = await client.startPreview('...', 'a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    if (error instanceof ApiError) {
      expect(error.code).toBe('TEXT_TOO_LONG');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('文章は最大3000文字までです。');
    }
  });

  it('JSONでないエラーレスポンスは汎用メッセージにする', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }));
    const client = new ApiClient('https://api.example.com', fetchMock);

    const error = await client.getVoices().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    if (error instanceof ApiError) {
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.statusCode).toBe(502);
    }
  });

  it('ネットワークエラーをApiErrorへ変換する', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = new ApiClient('https://api.example.com', fetchMock);

    const error = await client.getVoices().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    if (error instanceof ApiError) {
      expect(error.code).toBe('NETWORK_ERROR');
    }
  });
});
