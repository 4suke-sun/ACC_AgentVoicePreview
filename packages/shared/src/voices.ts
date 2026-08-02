/**
 * プレビューで選択できる音声の定義。
 *
 * - `id` はアプリ内の論理ID。フロントエンド⇔バックエンド間ではこのIDのみをやり取りし、
 *   ContactFlowId をブラウザから直接受け取らない(memo.txt 8.2)。
 * - コンタクトフローは音声ごとではなく**ロケールごとに1本**(動的フロー)。音声名は
 *   Lambdaがコンタクト属性 previewVoice として渡し、フローのSet Voiceブロックが
 *   動的に解決する(2026-08-02 フローログで実機検証済み)。
 * - `connectVoiceId` は Agentic voice の音声名。公式リファレンスに一覧がないため、
 *   コンソールのSet Voiceブロックで確認する(AIKO/REN/YUMIKO は実機確認済み)。
 * - 音声の追加はこの配列に1エントリ足すだけ(`/add-voice` スキル参照)。
 *   新しいロケールを追加した場合のみ、デプロイでフローが1本増える。
 */
export interface PreviewVoice {
  /** アプリ内論理ID */
  id: string;
  /** 画面に表示する名前 */
  displayName: string;
  /** Set Voice ブロックへ動的に渡す音声名 */
  connectVoiceId: string;
  /** ロケール(ロケールごとの動的フローに対応する) */
  locale: string;
}

export const PREVIEW_VOICES: readonly PreviewVoice[] = [
  {
    id: 'ja-jp-aiko',
    displayName: '日本語・AIKO',
    connectVoiceId: 'AIKO',
    locale: 'ja-JP',
  },
  {
    id: 'ja-jp-ren',
    displayName: '日本語・REN',
    connectVoiceId: 'REN',
    locale: 'ja-JP',
  },
  {
    id: 'ja-jp-yumiko',
    displayName: '日本語・YUMIKO',
    connectVoiceId: 'YUMIKO',
    locale: 'ja-JP',
  },
] as const;

export function findVoice(id: string): PreviewVoice | undefined {
  return PREVIEW_VOICES.find((voice) => voice.id === id);
}
