/** StartWebRTCContact で渡すコンタクト属性のキー(memo.txt 2章) */
export const PREVIEW_TEXT_ATTRIBUTE = 'previewText';

/** Set Voice ブロックが動的に参照する音声名のコンタクト属性キー(Lambdaが常に送信する) */
export const PREVIEW_VOICE_ATTRIBUTE = 'previewVoice';

/**
 * Agentic voice を示す TextToSpeechEngine の値。
 * 公式のフロー言語リファレンスには未記載で、コンソールで作成したフローの
 * エクスポート(2026-07-31 実機確認)から取得した値。
 */
export const AGENTIC_VOICE_ENGINE = 'connect:agentic';

export function previewFlowName(locale: string): string {
  return `AgenticVoicePreviewFlow-${locale}`;
}

/**
 * プレビュー用コンタクトフロー(ロケールごとに1本の動的フロー)。
 *
 * [開始] → [ログ設定] → [音声を設定(動的)] → [言語を設定] → [プロンプトの再生] → [切断]
 * どのブロックがエラーになっても必ず切断する(デフォルト音声での誤プレビューを防ぐ)。
 *
 * - Set Voice は `$.Attributes.previewVoice` を動的に解決する。動的設定自体は
 *   公式サポート(set-voice.html)で、Agentic voice との組み合わせは
 *   2026-08-02 にフローログで実機検証済み(AIKO/REN/YUMIKO)。
 * - Agentic voice 固有の値(TextToSpeechEngine: 'connect:agentic')は公式リファレンス
 *   未記載のため、実機フローのエクスポートが一次情報。
 *
 * ⚠️ フローログは意図的に有効化している(検証・デモ用ツールとしての判断)。
 *    PlayPromptブロックのログに previewText が**平文で** CloudWatch Logs に残るため、
 *    機密情報・個人情報を入力しない運用が前提。本番利用時の注意は README を参照。
 *
 * Metadata はコンソールのフローエディタ表示用(座標は2026-08-02のエクスポート準拠)で、
 * 実行時の動作には影響しない。
 */
export function buildPreviewFlowContent(locale: string): string {
  const flow = {
    Version: '2019-10-30',
    StartAction: 'set-logging',
    Metadata: {
      entryPointPosition: { x: -5.6, y: 39.2 },
      ActionMetadata: {
        'set-logging': { position: { x: 101.6, y: 89.6 } },
        'set-voice': {
          position: { x: 340, y: 84.8 },
          children: ['set-language'],
          parameters: {
            TextToSpeechVoice: { languageCode: locale },
            TextToSpeechEngine: { voiceProvider: AGENTIC_VOICE_ENGINE },
          },
          overrideConsoleVoice: true,
          fragments: { SetContactData: 'set-language' },
          overrideLanguageAttribute: true,
        },
        'set-language': {
          position: { x: 340, y: 84.8 },
          dynamicParams: [],
        },
        'play-preview-text': { position: { x: 580, y: 84.8 } },
        disconnect: { position: { x: 860, y: 96 } },
      },
      Annotations: [],
    },
    Actions: [
      {
        // フローログ有効化: Set Voiceの解決値(=実際に使われる音声名)を追跡できるようにする。
        // 引き換えに previewText もログへ平文で残る(上記の注意書き参照)。
        Identifier: 'set-logging',
        Type: 'UpdateFlowLoggingBehavior',
        Parameters: { FlowLoggingBehavior: 'Enabled' },
        Transitions: { NextAction: 'set-voice' },
      },
      {
        Identifier: 'set-voice',
        Type: 'UpdateContactTextToSpeechVoice',
        Parameters: {
          TextToSpeechVoice: `$.Attributes.${PREVIEW_VOICE_ATTRIBUTE}`,
          TextToSpeechEngine: AGENTIC_VOICE_ENGINE,
        },
        Transitions: {
          NextAction: 'set-language',
          Errors: [{ NextAction: 'disconnect', ErrorType: 'NoMatchingError' }],
        },
      },
      {
        Identifier: 'set-language',
        Type: 'UpdateContactData',
        Parameters: {
          LanguageCode: locale,
        },
        Transitions: {
          NextAction: 'play-preview-text',
          Errors: [{ NextAction: 'disconnect', ErrorType: 'NoMatchingError' }],
        },
      },
      {
        Identifier: 'play-preview-text',
        Type: 'MessageParticipant',
        Parameters: {
          Text: `$.Attributes.${PREVIEW_TEXT_ATTRIBUTE}`,
        },
        Transitions: {
          NextAction: 'disconnect',
          Errors: [{ NextAction: 'disconnect', ErrorType: 'NoMatchingError' }],
        },
      },
      {
        Identifier: 'disconnect',
        Type: 'DisconnectParticipant',
        Parameters: {},
        Transitions: {},
      },
    ],
  };
  return JSON.stringify(flow);
}
