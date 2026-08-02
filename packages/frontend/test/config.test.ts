import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('loadConfig', () => {
  it('config.jsonからapiBaseUrlを読み込む', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { apiBaseUrl: 'https://api.example.com' }));
    await expect(loadConfig(fetchMock)).resolves.toEqual({
      apiBaseUrl: 'https://api.example.com',
    });
    expect(fetchMock).toHaveBeenCalledWith('./config.json');
  });

  it('末尾スラッシュを除去する', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { apiBaseUrl: 'https://api.example.com/' }));
    await expect(loadConfig(fetchMock)).resolves.toEqual({
      apiBaseUrl: 'https://api.example.com',
    });
  });

  it('取得失敗でエラーを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    await expect(loadConfig(fetchMock)).rejects.toThrow(/config\.json/);
  });

  it('apiBaseUrl欠落でエラーを投げる', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await expect(loadConfig(fetchMock)).rejects.toThrow(/apiBaseUrl/);
  });

  it('ネットワークエラーでエラーを投げる', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(loadConfig(fetchMock)).rejects.toThrow(/config\.json/);
  });
});
