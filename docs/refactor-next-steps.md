# Refactor Next Steps (post current merge)

## 1) 区切りとしてこのチャットをアーカイブしてOK
現在の分割（UIコンポーネント化、`lib` DI化、`worker` ハンドラ分離、最低限のユニットテスト追加）で、
「大型改修の第1段」は十分に完了しています。

## 2) 次コンテキストで最初にやると安全なこと
- `pnpm build` をCIと同等条件で再実行（typecheckの最終確認）
- `pnpm test` の対象を増やしすぎず、段階的に拡張
- PR粒度は「1責務 = 1PR」を維持（競合回避）

## 3) 次の優先タスク（推奨順）
1. `worker/report-worker.ts` の受信ループの異常系テスト追加
2. `lib/prompt-improvement-processor.ts` の失敗分岐（AI失敗/DB失敗）追加
3. `app/admin/prompt-improvements` の表示コンポーネントに最小スナップショット/DOMテスト追加
4. `package.json` の `test` と `test:coverage` の責務整理（実行対象の明示）

## 4) 完了条件（DoD）
- 追加した pure utils は最低1つ以上のテストを持つ
- 既存機能の挙動変更なし（UI/文言差分は意図ありのみ）
- `pnpm test` がローカルで安定して再現可能

