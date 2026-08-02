/**
 * 構造化ログ出力。
 *
 * 入力された文章そのものは絶対にログへ出力しない(memo.txt 11.2)。
 * 誤って渡された場合に備え、本文に相当するキーは常に除外する。
 */
const REDACTED_KEYS = new Set(['text', 'previewText', 'body']);

export type LogEventName =
  | 'START_PREVIEW_REQUESTED'
  | 'START_PREVIEW_SUCCEEDED'
  | 'START_PREVIEW_FAILED'
  | 'STOP_PREVIEW_REQUESTED'
  | 'STOP_PREVIEW_SUCCEEDED'
  | 'STOP_PREVIEW_FAILED'
  | 'VALIDATION_FAILED'
  | 'UNHANDLED_ERROR';

export function logEvent(event: LogEventName, fields: Record<string, unknown> = {}): void {
  const safeFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!REDACTED_KEYS.has(key)) {
      safeFields[key] = value;
    }
  }
  console.log(JSON.stringify({ event, ...safeFields }));
}
