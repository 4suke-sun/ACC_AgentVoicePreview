export interface AppConfig {
  /** バックエンドAPIのベースURL(末尾スラッシュなし) */
  apiBaseUrl: string;
}

/**
 * 配信オリジン直下の config.json から設定を読み込む。
 * デプロイ時はCDKの BucketDeployment が実際のAPIエンドポイントを書き込んだ
 * config.json をS3へ配置する。ローカル開発時は public/config.json を用意する
 * (public/config.example.json 参照)。
 */
export async function loadConfig(
  fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<AppConfig> {
  let response: Response;
  try {
    response = await fetchFn('./config.json');
  } catch {
    throw new Error('config.json を取得できませんでした。');
  }
  if (!response.ok) {
    throw new Error(`config.json を取得できませんでした(HTTP ${response.status})。`);
  }

  const data: unknown = await response.json();
  const apiBaseUrl =
    data !== null && typeof data === 'object' && 'apiBaseUrl' in data
      ? (data as { apiBaseUrl: unknown }).apiBaseUrl
      : undefined;
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl === '') {
    throw new Error('config.json の apiBaseUrl が不正です。');
  }

  return { apiBaseUrl: apiBaseUrl.replace(/\/+$/, '') };
}
