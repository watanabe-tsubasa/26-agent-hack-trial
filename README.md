# 26-agent-hack-trial

## サンプルシナリオ

- エスカレーター2階から1階の途中にある三角部ガード板が落下
- ショッピングセンター内での天板の落下
- 2階テナント内の間接照明器具の脱落
- ADグループ会社清掃員（男性30代）がポリッシャーで冷ケースガラスに接触し破損

## run-prompt-improvement

```sh
curl -X POST "https://agent-hack-trial.victoriousflower-29957f8a.japaneast.azurecontainerapps.io/api/admin/run-prompt-improvement" \
  -H "Content-Type: application/json" \
  -d '{"locationKey":"store-001"}'
```

## location-prompt-overrides

```sh
curl "https://agent-hack-trial.victoriousflower-29957f8a.japaneast.azurecontainerapps.io/api/location-prompt-overrides?locationKey=store-001"
```

- approve

```sh
curl -X POST "https://agent-hack-trial.victoriousflower-29957f8a.japaneast.azurecontainerapps.io/api/location-prompt-overrides/override_024c9360-8523-48e1-9a95-fea7b78b163f/approve"
```