---
name: verify
description: リポジトリ全体の検証(Biome lint、TypeScript typecheck、Vitest)を実行し、失敗があれば修正して再実行する
---

# 検証手順

ルートディレクトリで以下を順に実行する。

1. `npm run lint` — Biomeによるlint + format検査。自動修正可能な指摘は `npm run lint:fix` で直す
2. `npm run typecheck` — 全ワークスペースの `tsc --noEmit`
3. `npm run test` — 全ワークスペースの Vitest

## ルール

- 3つすべてが通るまで修正と再実行を繰り返す
- テストを通すためにテスト側の期待値を安易に変えない。仕様(memo.txt)と照らして実装側の誤りを疑う
- lintの無効化コメント(`biome-ignore`)は理由を書けるときのみ使用する
- 完了したら3つの結果(pass/fail、テスト件数)を報告する
