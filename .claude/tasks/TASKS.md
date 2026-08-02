# タスク管理

作業を開始したら `[ ]` → `[~]`、完了したら `[x]` に更新する。完了条件は memo.txt 21章。

## Phase A: リポジトリ基盤(完了)

- [x] 調査: Agentic voiceの実態・簡易プレビュー方法の有無・構成改善案の提案
- [x] モノレポ構成(npm workspaces / Biome / Vitest / tsconfig)
- [x] shared: 音声定義・テキスト検証・API型
- [x] backend: Lambdaハンドラ(start / stop / voices)+ テスト
- [x] infra: CDKスタック(フロー / Lambda / HTTP API / S3+CloudFront)+ テスト
- [x] frontend: 状態機械 / APIクライアント / Chime SDKセッション / UI + テスト
- [x] CLAUDE.md / .claude(skills, agents, settings)/ README

## Phase B: デプロイと疎通(完了)

- [x] デプロイ成功・ブラウザから日本語再生を確認(AIKO / REN / YUMIKO)
- [x] フローJSONのAgentic voiceパラメータをジェネレーターへ反映
  (`TextToSpeechEngine: "connect:agentic"`。公式リファレンス未記載のためエクスポートが一次情報)
- [x] **動的Set Voiceの実機検証**(2026-08-02): フローログで
  `SetVoice.GlobalVoice` = AIKO / REN / YUMIKO、`PlayPrompt.Voice` も一致、全件Successを確認
- [x] **一本化リファクタ**(2026-08-02): 音声固定フローを廃止し、ロケールごとの動的フロー1本に統合。
  `useDynamicFlow` フラグ削除。音声追加は voices.ts 1行(新ロケール時のみフロー+1)

## 確定した運用方針(2026-08-02 ユーザー決定)

- **フローログは有効のまま**(実音声名の追跡を優先)。previewTextが平文でCloudWatch Logsに残るため、
  「実験用・機密入力禁止・本番利用禁止」をREADME冒頭に明記して運用でカバー
- **認証は非搭載のまま**。本番利用者には「フォークして Cognito認証・IP制限(WAF)等を追加」を
  README冒頭で案内(3Pアプリ埋め込み/SAMLブローカー型Cognitoの検討記録は会話ログ参照)

## Phase C: 今後の候補(必要になったら)

- [ ] 英語音声の追加(voices.ts に locale: en-US のエントリを追加するだけ。フローは自動生成)
- [ ] Agent Workspace 3Pアプリとしての埋め込み(到達制御をConnectセキュリティプロファイルに寄せる)
- [ ] CloudWatch Alarm・コスト監視(memo.txt 18章)
- [ ] 音声制御タグの許可リスト対応(memo.txt 9.2、現状はプレーンテキストのみ)
- [ ] 音声品質テスト(memo.txt 19.3)の実施と記録
- [ ] (フォーク先向け)Cognito認証 + stop APIの所有者チェック + CORS絞り込み + フローログ無効化
