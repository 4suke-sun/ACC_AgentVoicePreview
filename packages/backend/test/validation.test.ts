import { MAX_TEXT_LENGTH } from '@avp/shared';
import { describe, expect, it } from 'vitest';
import { isValidContactId, parseStartRequest } from '../src/lib/validation';
import { VALID_VOICE_ID } from './helpers';

function jsonBody(body: unknown): string {
  return JSON.stringify(body);
}

describe('parseStartRequest', () => {
  it('正常なリクエストを受理する', () => {
    const result = parseStartRequest(
      jsonBody({ text: 'こんにちは。', voiceId: VALID_VOICE_ID }),
      false,
    );
    expect(result).toEqual({ ok: true, text: 'こんにちは。', voiceId: VALID_VOICE_ID });
  });

  it('base64エンコードされたボディを受理する', () => {
    const raw = Buffer.from(jsonBody({ text: 'テスト', voiceId: VALID_VOICE_ID })).toString(
      'base64',
    );
    const result = parseStartRequest(raw, true);
    expect(result.ok).toBe(true);
  });

  it('ボディなしを拒否する', () => {
    const result = parseStartRequest(undefined, false);
    expect(result).toMatchObject({ ok: false, statusCode: 400, code: 'INVALID_REQUEST' });
  });

  it('不正なJSONを拒否する', () => {
    const result = parseStartRequest('{not-json', false);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
  });

  it('JSONオブジェクト以外(配列・文字列)を拒否する', () => {
    for (const raw of ['[]', '"text"', 'null']) {
      expect(parseStartRequest(raw, false)).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    }
  });

  it('空文章を拒否する', () => {
    const result = parseStartRequest(jsonBody({ text: '  ', voiceId: VALID_VOICE_ID }), false);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_TEXT' });
  });

  it('最大文字数超過を拒否する', () => {
    const result = parseStartRequest(
      jsonBody({ text: 'あ'.repeat(MAX_TEXT_LENGTH + 1), voiceId: VALID_VOICE_ID }),
      false,
    );
    expect(result).toMatchObject({ ok: false, code: 'TEXT_TOO_LONG' });
  });

  it('許可されていない音声IDを拒否する', () => {
    const result = parseStartRequest(jsonBody({ text: 'テスト', voiceId: 'evil-flow-id' }), false);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_VOICE' });
  });

  it('voiceId未指定を拒否する', () => {
    const result = parseStartRequest(jsonBody({ text: 'テスト' }), false);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_VOICE' });
  });
});

describe('isValidContactId', () => {
  it('UUID形式を受理する', () => {
    expect(isValidContactId('8e9ec480-0c2c-4a08-b9e0-0123456789ab')).toBe(true);
  });

  it('UUID以外を拒否する', () => {
    for (const value of [undefined, '', 'abc', '../etc/passwd', 'A'.repeat(36)]) {
      expect(isValidContactId(value as string | undefined)).toBe(false);
    }
  });
});
