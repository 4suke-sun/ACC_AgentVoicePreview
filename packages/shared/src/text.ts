/**
 * プレビュー文章の検証(memo.txt 9.1)。
 * フロントエンドは事前チェックとして、バックエンドは正式な検証として同じロジックを使う。
 */

/** Play prompt の制限を考慮した最大文字数(コードポイント数) */
export const MAX_TEXT_LENGTH = 3000;

/** コンタクト属性(合計32KB)を考慮した previewText の最大UTF-8バイト数 */
export const MAX_TEXT_BYTES = 12000;

/** 改行(\n, \r)とタブ以外の制御文字は不許可 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字の除外が目的
const FORBIDDEN_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export type TextValidationFailure = {
  ok: false;
  code: 'INVALID_TEXT' | 'TEXT_TOO_LONG';
  reason: string;
};

export type TextValidationResult = { ok: true; text: string } | TextValidationFailure;

export function countTextLength(text: string): number {
  return [...text].length;
}

export function validatePreviewText(text: unknown): TextValidationResult {
  if (typeof text !== 'string') {
    return { ok: false, code: 'INVALID_TEXT', reason: '文章が指定されていません。' };
  }
  if (text.trim().length === 0) {
    return { ok: false, code: 'INVALID_TEXT', reason: '文章を入力してください。' };
  }
  if (FORBIDDEN_CONTROL_CHARS.test(text)) {
    return { ok: false, code: 'INVALID_TEXT', reason: '使用できない制御文字が含まれています。' };
  }
  if (countTextLength(text) > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      code: 'TEXT_TOO_LONG',
      reason: `文章は最大${MAX_TEXT_LENGTH}文字までです。`,
    };
  }
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
    return {
      ok: false,
      code: 'TEXT_TOO_LONG',
      reason: '文章のデータサイズが大きすぎます。',
    };
  }
  return { ok: true, text };
}
