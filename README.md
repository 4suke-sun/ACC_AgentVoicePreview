# ACC_AgentVoicePreview

Amazon Connect **Agentic Voice** の社内向け音声プレビュー画面。
任意の文章をブラウザで入力し、電話番号への架電・コンタクトフローの都度更新なしに、その場で試聴できる。

<img width="722" height="462" alt="image" src="https://github.com/user-attachments/assets/d5e8ac95-b696-425a-ab92-4a0facd74f4d" />

設計書: [`memo.txt`](./memo.txt) / 開発規約: [`CLAUDE.md`](./CLAUDE.md)

> ## ⚠️ 利用上の注意(実験・検証用ツールです)
>
> - **入力した文章はCloudWatch Logsに平文で保存されます。** 読み上げテキスト
>   (previewText)がフローログにそのまま記録されます。
>   **機密情報・個人情報を含む文章は入力しないでください。**
> - **認証はありません。** 画面のURLとAPIエンドポイントを知っていれば誰でも利用できます
>   (悪用された場合、Connectの従量課金が発生します)。
> - **このまま本番・常設環境で運用は非推奨です。** 本番相当で利用する場合は、
>   本リポジトリをフォークした上で、認証やIP制限等をご検討ください。

## 仕組み

再生ボタン1回につき `StartWebRTCContact` で新規WebRTCコンタクトを1件作成し、
入力文章を `previewText`、音声名を `previewVoice` としてコンタクト属性で渡す。
ロケールごとに1本のプレビュー用フロー(Set Voiceブロックが `$.Attributes.previewVoice` を
動的解決)が Agentic voice で読み上げ、再生完了後に自動切断する。

```
ブラウザ(テキスト入力 / Chime SDK JSで再生)
  → CloudFront + S3(フロントエンド配信)
  → API Gateway(HTTP API) → Lambda → StartWebRTCContact / StopContact
  → Amazon Connect(音声ごとのプレビューフロー: previewText読み上げ → 切断)
  → WebRTC(Chime)でブラウザのスピーカーへ
```

## リポジトリ構成

| パッケージ | 内容 |
|---|---|
| `packages/shared` | 音声定義・テキスト検証・API型(単一情報源) |
| `packages/backend` | Lambda(プレビュー開始 / 停止 / 音声一覧) |
| `packages/infra` | CDK(コンタクトフロー、Lambda、HTTP API、S3+CloudFront) |
| `packages/frontend` | Vite + TypeScript + Amazon Chime SDK JS |

## 開発

```bash
npm ci            # 依存関係のインストール
npm run verify    # lint(Biome) + typecheck + test(Vitest)
```

ローカルでフロントエンドを動かす場合(デプロイ済みAPIに接続):

```bash
cp packages/frontend/public/config.example.json packages/frontend/public/config.json
# config.json の apiBaseUrl をデプロイ済みのAPIエンドポイントに書き換える
npm run dev -w @avp/frontend   # http://localhost:5173
```

※ `http://localhost:5173` はデプロイ時に `-c additionalCorsOrigins=http://localhost:5173` を
指定した場合のみAPIへアクセスできる。

## 前提条件

- Agentic voice が利用できる Amazon Connect インスタンス
  (**Amazon Connect Customer(次世代Connect)が有効**であること)
- 利用リージョンで Agentic voice の日本語音声が提供されていること
- Node.js 20以上 / CDK bootstrap 済みのAWSアカウント

## デプロイ前チェックリスト

1. `packages/shared/src/voices.ts` の音声定義を確認する。`AIKO` / `REN` / `YUMIKO`(ja-JP)は
   実機検証済み(2026-08-02、フローログで実音声を確認)。音声を追加する場合はコンソールの
   Set Voiceブロックで正確な音声名を確認する(音声名は公式リファレンスに記載がない)
2. フロントエンドをビルドする: `npm run build -w @avp/frontend`
   (未ビルドの場合、synth時に警告が出てフロントエンド資産はデプロイされない)

## デプロイ

```bash
npm run build -w @avp/frontend
cd packages/infra
npx cdk deploy \
  -c connectInstanceId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  -c additionalCorsOrigins=http://localhost:5173   # ローカル開発しない場合は省略
```

出力される `WebUrl` がプレビュー画面、`ApiEndpoint` がAPIのURL。

## デプロイ後の確認

フローJSONの Agentic voice 固有パラメータ(`TextToSpeechEngine: "connect:agentic"`)や
音声名は**公式のフロー言語リファレンスに記載がない**ため、実機フローのエクスポートと
フローログが一次情報。動的Set Voice(`$.Attributes.previewVoice`)を含め 2026-08-02 に
実機検証済みだが、挙動を疑う場合は以下で確認する:

1. ブラウザで `WebUrl` を開き、各音声で再生できるか確認
2. 実際に使われた音声名の確認: CloudWatch Logs のロググループ
   `/aws/connect/<インスタンスエイリアス>` で Logs Insights を実行

   ```
   fields @timestamp, ContactId, Parameters.GlobalVoice, Parameters.GlobalEngine
   | filter ContactFlowModuleType = "SetVoice"
   | sort @timestamp desc
   ```

   (PlayPromptのログにも合成に使われた `Voice` が記録される)
3. 再生終了後にコンタクトが自動終了していることを確認(コンタクト検索で確認)

※ インスタンスの「フローログ」設定が有効である必要がある。

## セキュリティ上の整理

- **フローログ有効(意図的)**: 実音声の追跡と引き換えに、previewTextがフローログに平文で残る
  (冒頭の「利用上の注意」参照)。Lambdaのアプリケーションログには文字数のみで本文は残らない
- ブラウザにはWebRTC参加用の一時的な ConnectionData のみ渡る(AWS認証情報・ContactFlowIdは渡らない)
- APIはバックエンドの許可リスト(論理voiceId→フロー)経由でのみフローを起動する
- 認証は非搭載。本番利用時の要件は冒頭の「利用上の注意」を参照
