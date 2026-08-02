import { describe, expect, it } from 'vitest';
import {
  AGENTIC_VOICE_ENGINE,
  buildPreviewFlowContent,
  previewFlowName,
} from '../lib/contact-flow';

interface FlowAction {
  Identifier: string;
  Type: string;
  Parameters: Record<string, unknown>;
  Transitions: {
    NextAction?: string;
    Errors?: Array<{ NextAction: string; ErrorType: string }>;
  };
}

interface Flow {
  Version: string;
  StartAction: string;
  Metadata: { ActionMetadata: Record<string, Record<string, unknown>> };
  Actions: FlowAction[];
}

function parseFlow(locale = 'ja-JP'): Flow {
  return JSON.parse(buildPreviewFlowContent(locale));
}

function findAction(flow: Flow, type: string): FlowAction | undefined {
  return flow.Actions.find((action) => action.Type === type);
}

describe('buildPreviewFlowContent(ロケール別・動的フロー)', () => {
  it('有効なJSONを生成し、StartActionが実在するアクションを指す', () => {
    const flow = parseFlow();
    const ids = flow.Actions.map((action) => action.Identifier);
    expect(ids).toContain(flow.StartAction);
  });

  it('Set Voiceが previewVoice 属性を動的参照する(2026-08-02 実機検証済み)', () => {
    const setVoice = findAction(parseFlow(), 'UpdateContactTextToSpeechVoice');
    expect(setVoice?.Parameters.TextToSpeechVoice).toBe('$.Attributes.previewVoice');
    expect(setVoice?.Parameters.TextToSpeechEngine).toBe(AGENTIC_VOICE_ENGINE);
    expect(AGENTIC_VOICE_ENGINE).toBe('connect:agentic');
  });

  it('言語属性をロケールで上書きする(Set Voiceブロックのペア構成)', () => {
    const flow = parseFlow();
    const setLanguage = findAction(flow, 'UpdateContactData');
    expect(setLanguage?.Parameters.LanguageCode).toBe('ja-JP');
    const setVoice = findAction(flow, 'UpdateContactTextToSpeechVoice');
    expect(setVoice?.Transitions.NextAction).toBe(setLanguage?.Identifier);
  });

  it('ロケールを切り替えられる(多言語対応)', () => {
    const setLanguage = findAction(parseFlow('en-US'), 'UpdateContactData');
    expect(setLanguage?.Parameters.LanguageCode).toBe('en-US');
  });

  it('previewText属性を読み上げる(memo.txt 5.4)', () => {
    const play = findAction(parseFlow(), 'MessageParticipant');
    expect(play?.Parameters.Text).toBe('$.Attributes.previewText');
  });

  it('再生成功時に切断する(memo.txt 5.5)', () => {
    const flow = parseFlow();
    const play = findAction(flow, 'MessageParticipant');
    const disconnect = findAction(flow, 'DisconnectParticipant');
    expect(disconnect).toBeDefined();
    expect(play?.Transitions.NextAction).toBe(disconnect?.Identifier);
  });

  it('どのブロックがエラーでも必ず切断する(デフォルト音声での誤プレビュー防止, memo.txt 5.6)', () => {
    const flow = parseFlow();
    const disconnect = findAction(flow, 'DisconnectParticipant');
    // 切断ブロック自身と、エラーブランチを持たないフロー制御ブロックは対象外
    const actionsWithErrors = flow.Actions.filter(
      (action) =>
        action.Type !== 'DisconnectParticipant' && action.Type !== 'UpdateFlowLoggingBehavior',
    );
    expect(actionsWithErrors.length).toBeGreaterThan(0);
    for (const action of actionsWithErrors) {
      const errorTargets = action.Transitions.Errors?.map((error) => error.NextAction);
      expect(errorTargets, `${action.Identifier} のエラーブランチ`).toContain(
        disconnect?.Identifier,
      );
    }
  });

  it('フローログを有効化する(実音声の追跡用。previewTextが平文で残る点はREADME参照)', () => {
    const logging = findAction(parseFlow(), 'UpdateFlowLoggingBehavior');
    expect(logging?.Parameters.FlowLoggingBehavior).toBe('Enabled');
  });

  it('Metadataがコンソール表示用のAgentic voice設定を含む', () => {
    const flow = parseFlow();
    const setVoiceMeta = flow.Metadata.ActionMetadata['set-voice'];
    expect(setVoiceMeta?.overrideConsoleVoice).toBe(true);
    expect(setVoiceMeta?.parameters).toEqual({
      TextToSpeechVoice: { languageCode: 'ja-JP' },
      TextToSpeechEngine: { voiceProvider: 'connect:agentic' },
    });
  });
});

describe('previewFlowName', () => {
  it('ロケールを含むフロー名を生成する', () => {
    expect(previewFlowName('ja-JP')).toBe('AgenticVoicePreviewFlow-ja-JP');
  });
});
