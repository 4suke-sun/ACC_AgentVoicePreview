import { afterEach, describe, expect, it, vi } from 'vitest';
import { logEvent } from '../src/lib/logger';

describe('logEvent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('イベント名とフィールドをJSONで出力する', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('START_PREVIEW_SUCCEEDED', { contactId: 'abc', textLength: 12 });
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(logged).toEqual({
      event: 'START_PREVIEW_SUCCEEDED',
      contactId: 'abc',
      textLength: 12,
    });
  });

  it('入力文章に相当するキーは出力しない(memo.txt 11.2)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('START_PREVIEW_REQUESTED', {
      text: '個人情報を含む文章',
      previewText: '個人情報を含む文章',
      body: '{"text":"..."}',
      textLength: 9,
    });
    const raw = spy.mock.calls[0]?.[0] as string;
    expect(raw).not.toContain('個人情報');
    const logged = JSON.parse(raw);
    expect(logged).toEqual({ event: 'START_PREVIEW_REQUESTED', textLength: 9 });
  });
});
