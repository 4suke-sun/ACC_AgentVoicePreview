import { describe, expect, it } from 'vitest';
import { getConfig } from '../src/lib/config';

describe('getConfig', () => {
  const validEnv = {
    CONNECT_INSTANCE_ID: 'instance-id',
    VOICE_FLOW_MAP: JSON.stringify({ 'ja-jp-voice-a': 'flow-a' }),
  } as NodeJS.ProcessEnv;

  it('正常な環境変数を読み込む', () => {
    expect(getConfig(validEnv)).toEqual({
      instanceId: 'instance-id',
      voiceFlowMap: { 'ja-jp-voice-a': 'flow-a' },
    });
  });

  it('CONNECT_INSTANCE_ID 未設定でエラー', () => {
    expect(() => getConfig({ VOICE_FLOW_MAP: '{}' } as NodeJS.ProcessEnv)).toThrow(
      /CONNECT_INSTANCE_ID/,
    );
  });

  it('VOICE_FLOW_MAP 未設定でエラー', () => {
    expect(() => getConfig({ CONNECT_INSTANCE_ID: 'x' } as NodeJS.ProcessEnv)).toThrow(
      /VOICE_FLOW_MAP/,
    );
  });

  it('VOICE_FLOW_MAP が不正なJSONでエラー', () => {
    expect(() =>
      getConfig({ CONNECT_INSTANCE_ID: 'x', VOICE_FLOW_MAP: '{bad' } as NodeJS.ProcessEnv),
    ).toThrow(/JSON/);
  });

  it('VOICE_FLOW_MAP の値が文字列以外でエラー', () => {
    expect(() =>
      getConfig({
        CONNECT_INSTANCE_ID: 'x',
        VOICE_FLOW_MAP: JSON.stringify({ a: 1 }),
      } as NodeJS.ProcessEnv),
    ).toThrow(/不正/);
  });
});
