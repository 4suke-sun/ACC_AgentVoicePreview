# ACC_AgenticVoicePreview

Amazon Connect **Agentic Voice** を、電話番号への架電なしにブラウザで即時試聴する社内向けプレビュー画面。
要件と設計の原典は `memo.txt`(設計書)。実装は「再生ボタン1回 = StartWebRTCContact で新規コンタクト1件」方式。

## 絶対的なルール

- **このリポジトリに閉じない操作は禁止。** AWSアカウントへの操作(`aws` CLI、`cdk deploy/destroy/bootstrap`)は行わない。デプロイは人間が実施する。
- リンター/フォーマッターは **Biome**、テストは **Vitest**。Jestは使わない。
- CDK + TypeScript で実装する。CloudFormation テンプレートの直書きはしない。
- 入力された試聴文章(previewText)を**Lambdaのアプリケーションログに出力しない**(文字数のみ記録)。`packages/backend/src/lib/logger.ts` の redact 機構を経由すること。
  ※ 例外として**コンタクトフローログは意図的に有効**(実音声名の追跡用)で、previewTextが平文で残る。これは実験用ツールとしての確定判断(README冒頭の注意参照)。勝手に無効化しない。
- ブラウザへ ContactFlowId・AWS認証情報を渡さない。フロントは論理 `voiceId` のみ扱う。
- 認証は意図的に非搭載(実験用)。本番利用者にはフォーク+認証追加を案内する方針(README冒頭)。

## コマンド(ルートで実行)

| コマンド | 内容 |
|---|---|
| `npm run verify` | lint + typecheck + test を一括実行(変更後は必ず実行) |
| `npm run lint` / `npm run lint:fix` | Biome チェック / 自動修正 |
| `npm run typecheck` | 全ワークスペースの `tsc --noEmit` |
| `npm run test` | 全ワークスペースの Vitest |
| `npm run build -w @avp/frontend` | フロントエンドのビルド(CDKデプロイの前提) |
| `npm run synth` | CDK synth(`-c connectInstanceId=...` が必要) |

## 構成

```
packages/
  shared/    音声定義(voices.ts)・入力検証(text.ts)・API型。全パッケージの単一情報源
  backend/   Lambdaハンドラ(HTTP API v2)。StartWebRTCContact / StopContact
  infra/     CDK。コンタクトフロー(音声ごと)・Lambda・HTTP API・S3+CloudFront
  frontend/  Vite + vanilla TS。状態機械(state.ts)+ Chime SDK JS(audio.ts)
```

依存方向: `shared` ← backend / infra / frontend。相互依存させない。

## 設計上の重要事項

- **音声の追加**は `packages/shared/src/voices.ts` に1エントリ追加するだけ(`/add-voice` スキル参照)。コンタクトフローは**ロケールごとに1本の動的フロー**で、音声名はコンタクト属性 `previewVoice` として渡し Set Voice ブロックが動的解決する(2026-08-02 フローログで実機検証済み)。CDKはロケール別フローを生成し `VOICE_FLOW_MAP` 環境変数としてLambdaへ注入する。
- **冪等性**: `StartWebRTCContact` の `ClientToken` に `previewId` を必ず渡す(重複コンタクト防止)。
- **状態遷移**は `frontend/src/state.ts` の純粋関数 `reduce` に閉じ込める。UI都合のロジックをここへ足すときは必ずテストを先に書く。
- **コンタクトフローJSON**(`infra/lib/contact-flow.ts`)の Agentic voice 固有パラメータ(`TextToSpeechEngine: "connect:agentic"`、音声名 AIKO/REN/YUMIKO)は**公式リファレンスに記載がなく**、実機フローのエクスポートとフローログが一次情報。仕様変更を疑う場合はコンソールから再エクスポートして照合する。フローログ上のブロック名は `SetVoice`(パラメータは `GlobalVoice` / `GlobalEngine`)。
- エラーコード体系は memo.txt 12.2 に準拠(`shared/src/api-types.ts` の `ApiErrorCode`)。

## タスク管理

進行中の作業と残タスクは `.claude/tasks/TASKS.md` で管理する。作業を開始・完了したら更新すること。

## スキル / エージェント

- `/verify` — lint + typecheck + test の一括検証手順
- `/add-voice` — プレビュー音声の追加手順
- `cdk-reviewer` エージェント — インフラ変更時のセキュリティレビュー
- `connect-docs-researcher` エージェント — Connect API・フロー言語の公式ドキュメント調査
