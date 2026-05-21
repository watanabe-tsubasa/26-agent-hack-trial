今わかっていることを整理すると、

```text
- Blob には画像が登録されている
- Blob URL を直接開くと画像は見える
- ローカルで作成した report のデータを本番環境から見ても画像は表示される
- ローカル Worker は env を読み込めば画像URL付きで処理できる
- 本番環境で新規作成した場合だけ、画像を読みに行っていないように見える
```

なので、Blob権限やフロント表示の問題ではなく、かなり高確率で **本番側 Worker の処理経路** の問題です。

ありそうなのはこのあたりです。

```text
- 本番 Worker の env が不足している
- 本番 Worker が古い revision のまま動いている
- 本番 Worker のイメージが最新化されていない
- 本番 Worker 側で searchCameraFrames ではなく古い mock-camera 経路が動いている
- 本番で作成した report の occurredAt / summary / location が seed の検索条件に合っていない
- queue を処理している Worker が想定と違うコンテナ・revision
```

ただ、**この機能を本番では最終的に使わない** なら、ここでAzure Container Appsのrevision/env沼を掘るより、次に進むのが正解寄りです。ハッカソンの時間配分としても、いまは「Blob + frame_assets + 写真台帳の導線は確認済み」として扱ってよいと思います。

## 次に進む前の最低限メモ

あとで戻れるように、今の状態だけ `docs/phase2/tasks.md` かメモに残しておくとよさそうです。

```md
## Phase 2 camera frame status

- Blob Storage `frames` container にサンプル画像登録済み
- `frame_assets` に4シナリオ分のメタデータ登録済み
- Blob URL 直開きで画像表示確認済み
- ローカル Worker では `.env.local` 読み込み後、画像URL付きドラフト生成を確認済み
- ローカル生成データは本番Webからも画像表示可能
- 本番Webから新規作成した場合は、Worker側で画像検索経路に入っていない可能性あり
- 本番機能としては将来 AI / video-frame-extractor 側で再設計予定のため、現時点では深追いしない
```

## いまの完了扱い

Phase 2 は、こういうステータスで切ってよさそうです。

```text
Phase 2:
  Blob / frame_assets / seed / ローカルWorker連携までは完了
  本番Workerの画像検索反映は既知課題として保留
```

次に進むなら、優先度はたぶんこちらです。

```text
Phase 3:
  Azure OpenAI / Foundry Models による報告書JSON生成
  ただし最初は structured output の形だけ作る
```

そのとき、今回の画像周りはこう扱えばいいです。

```text
- frame_assets は「将来AIに渡す画像候補」の保存先として残す
- 今は AI入力に `photos` が空でも動くようにする
- 画像がある場合だけ photoLedger に反映する
- 本番Workerの画像取得は、AI画像解析を入れるタイミングで一緒に整える
```

ここで止まり続けるより、次に行った方がいいです。
Blob直URLとローカルWorkerで導線が確認できているので、Phase 2としては十分な前進です。
