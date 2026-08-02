---
name: add-voice
description: プレビューで選択できるAgentic voiceの音声を追加・変更する手順
---

# 音声の追加手順

コンタクトフローは**ロケールごとに1本の動的フロー**(Set Voiceが `$.Attributes.previewVoice` を
動的解決)。単一情報源は `packages/shared/src/voices.ts` で、既存ロケールへの音声追加なら
フローは増えない。新ロケール追加時のみCDKがフローを1本自動生成する。

## 手順

1. `packages/shared/src/voices.ts` の `PREVIEW_VOICES` にエントリを追加する
   - `id`: 論理ID。`^[a-z0-9-]+$` 形式(例: `ja-jp-hana`, `en-us-matthew`)。**既存IDの変更は互換性が壊れるため注意**
   - `displayName`: 画面表示名(例: `日本語・HANA`)
   - `connectVoiceId`: Agentic voice の音声名。**公式リファレンスに一覧がない**ため、
     Connectコンソールのフローエディタで Set Voice ブロック → Voice provider
     「Amazon Connect agentic voice」を選んだときの音声一覧から正確な名前を確認する
     (AIKO / REN / YUMIKO は実機検証済み)
   - `locale`: 例 `ja-JP`, `en-US`。新しいロケールの場合、その言語がAgentic voiceで
     利用可能なリージョンか確認すること
2. `npm run verify` を実行する(テストは `PREVIEW_VOICES` を動的に検証するため、通常は修正不要)
3. ユーザーへ伝える: デプロイ(`cdk deploy`)は人間が実施。デプロイ後、画面の音声プルダウンに自動で追加される
4. デプロイ後の確認方法: 再生してフローログ(`/aws/connect/<エイリアス>`)で
   `ContactFlowModuleType = "SetVoice"` の `GlobalVoice` が意図した音声名になっているか確認できる

## 注意

- ContactFlowId をフロントエンドや音声定義に直接書かない(CDKが解決する)
- 音声名が誤っていると Set Voice がエラーブランチ→即切断となり**無音で終わる**(これが誤設定のシグナル)
- ロケールを削除する場合、対応するフローもCloudFormationが削除する。進行中のコンタクトがないことを確認してから人間がデプロイする
