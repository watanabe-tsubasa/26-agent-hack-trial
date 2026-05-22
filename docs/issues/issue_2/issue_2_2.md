改善案 draft が複数表示される問題を修正してください。

方針:
- 同じ locationKey について、AI生成の draft は最新1件だけを有効表示する
- 古い draft は archived にする
- active は勝手に archived にしない
- active の切り替えは approve API のみで行う

実装要件:
1. lib/location-prompt-override-repository.ts に以下を追加
   - archiveOlderDraftLocationPromptOverrides({ locationKey, keepId })
   - 条件:
     location_key = locationKey
     source = 'ai_proposed'
     status = 'draft'
     id <> keepId

2. prompt improvement worker で新しい draft 作成後に呼ぶ
   - createDraftLocationPromptOverride の戻り値として newOverrideId を受け取る
   - archiveOlderDraftLocationPromptOverrides({ locationKey, keepId: newOverrideId })

3. app/admin/prompt-improvements/page.tsx
   - draft 一覧を複数表示しない
   - status=draft のうち createdAt が最新のものだけ表示
   - archived は表示しない
   - 必要なら「過去の draft は最新案生成時に自動 archived されます」と説明を追加

4. GET /api/location-prompt-overrides
   - 既存のままでもよいが、archived は UI 側で除外
   - 余裕があれば query で includeArchived=false を追加

5. 重複 run 対策も入れる
   - queued/running の run がある場合は新規 enqueue しない
   - 既存 run を返す
   - UI ボタンを disabled にする

6. 確認
   - npx tsc --noEmit
   - draft が2件以上ある状態から新しい改善案を生成
   - 最新 draft 以外が archived になる
   - UI には最新 draft だけ表示される
   - active は維持される