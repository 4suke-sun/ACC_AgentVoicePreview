import { describe, expect, it } from 'vitest';
import { countTextLength, MAX_TEXT_LENGTH, validatePreviewText } from '../src/text';

describe('validatePreviewText', () => {
  it('通常の日本語文章を許可する', () => {
    const result = validatePreviewText(
      'お電話ありがとうございます。本日の営業時間は午後6時までです。',
    );
    expect(result.ok).toBe(true);
  });

  it('改行・タブを含む文章を許可する', () => {
    expect(validatePreviewText('1行目\n2行目\r\n3行目\tタブ').ok).toBe(true);
  });

  it('英数字・記号を含む文章を許可する', () => {
    expect(validatePreviewText('営業時間は 9:00-18:00 (平日) です。TEL 03-1234-5678').ok).toBe(
      true,
    );
  });

  it('文字列以外を拒否する', () => {
    for (const value of [undefined, null, 123, {}, []]) {
      const result = validatePreviewText(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_TEXT');
    }
  });

  it('空文字・空白のみを拒否する', () => {
    for (const value of ['', '   ', '\n\n', '　']) {
      const result = validatePreviewText(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_TEXT');
    }
  });

  it('NULなどの制御文字を拒否する', () => {
    const result = validatePreviewText('こんにちは\u0000世界');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_TEXT');
  });

  it('最大文字数ちょうどを許可する', () => {
    expect(validatePreviewText('あ'.repeat(MAX_TEXT_LENGTH)).ok).toBe(true);
  });

  it('最大文字数超過を拒否する', () => {
    const result = validatePreviewText('あ'.repeat(MAX_TEXT_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TEXT_TOO_LONG');
  });

  it('サロゲートペアを1文字として数える', () => {
    expect(countTextLength('𩸽')).toBe(1);
    expect(validatePreviewText('𩸽'.repeat(MAX_TEXT_LENGTH)).ok).toBe(true);
  });
});
