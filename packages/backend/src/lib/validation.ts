import { type ApiErrorCode, findVoice, validatePreviewText } from '@avp/shared';

export type ParseStartResult =
  | { ok: true; text: string; voiceId: string }
  | { ok: false; statusCode: number; code: ApiErrorCode; message: string };

/**
 * プレビュー開始リクエストのボディを検証する(memo.txt 9章)。
 */
export function parseStartRequest(
  rawBody: string | undefined,
  isBase64Encoded: boolean,
): ParseStartResult {
  if (!rawBody) {
    return invalid('INVALID_REQUEST', 'リクエストボディが指定されていません。');
  }

  let bodyText = rawBody;
  if (isBase64Encoded) {
    try {
      bodyText = Buffer.from(rawBody, 'base64').toString('utf-8');
    } catch {
      return invalid('INVALID_REQUEST', 'リクエストボディを読み取れませんでした。');
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return invalid('INVALID_REQUEST', 'リクエストボディがJSONとして不正です。');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return invalid('INVALID_REQUEST', 'リクエストボディがJSONオブジェクトではありません。');
  }

  const { text, voiceId } = body as { text?: unknown; voiceId?: unknown };

  const textResult = validatePreviewText(text);
  if (!textResult.ok) {
    return invalid(textResult.code, textResult.reason);
  }

  if (typeof voiceId !== 'string' || !findVoice(voiceId)) {
    return invalid('INVALID_VOICE', '許可されていない音声IDです。');
  }

  return { ok: true, text: textResult.text, voiceId };
}

const CONTACT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidContactId(contactId: string | undefined): contactId is string {
  return typeof contactId === 'string' && CONTACT_ID_PATTERN.test(contactId);
}

function invalid(code: ApiErrorCode, message: string): ParseStartResult {
  return { ok: false, statusCode: 400, code, message };
}
