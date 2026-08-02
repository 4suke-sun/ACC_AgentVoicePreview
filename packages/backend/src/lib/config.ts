export interface BackendConfig {
  /** Amazon Connect インスタンスID */
  instanceId: string;
  /** 論理voiceId → ContactFlowId のマッピング(CDKが環境変数として注入する) */
  voiceFlowMap: Record<string, string>;
}

/**
 * 環境変数から設定を読み込む。
 * ContactFlowId はブラウザから受け取らず、必ずこのマップ経由で解決する(memo.txt 8.2)。
 */
export function getConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const instanceId = env.CONNECT_INSTANCE_ID;
  if (!instanceId) {
    throw new Error('環境変数 CONNECT_INSTANCE_ID が設定されていません');
  }

  const rawMap = env.VOICE_FLOW_MAP;
  if (!rawMap) {
    throw new Error('環境変数 VOICE_FLOW_MAP が設定されていません');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error('環境変数 VOICE_FLOW_MAP がJSONとして不正です');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('環境変数 VOICE_FLOW_MAP はオブジェクトである必要があります');
  }

  const voiceFlowMap: Record<string, string> = {};
  for (const [voiceId, flowId] of Object.entries(parsed)) {
    if (typeof flowId !== 'string' || flowId === '') {
      throw new Error(`VOICE_FLOW_MAP の ${voiceId} が不正です`);
    }
    voiceFlowMap[voiceId] = flowId;
  }

  return { instanceId, voiceFlowMap };
}
