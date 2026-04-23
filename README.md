# イベントカレンダー（共有版）

この版はブラウザの `localStorage` ではなく、`server.py` のAPI経由でデータを保存します。  
同じサーバーURLにアクセスしているユーザー間で、追加・編集・削除が共有されます。

## 起動方法

```bash
cd "/Users/ishiifumiko/イベントカレンダー"
python3 server.py
```

ブラウザで `http://localhost:4173` を開いてください。

## 共有について

- 同一サーバーに接続していれば、全員同じイベントデータを見ます
- データは `data/events.json` に保存されます
- クライアント共有時は、このフォルダをサーバー環境に配置して `server.py` を実行してください

## Render で常時公開する

1. このフォルダを GitHub リポジトリに push する  
2. Render ダッシュボードで `New +` → `Blueprint` を選ぶ  
3. 対象リポジトリを選ぶ（`render.yaml` を自動検出）  
4. そのまま `Apply` してデプロイ  
5. 発行された `https://...onrender.com` をクライアントへ共有

### 注意

- 無料枠ではスリープや再起動があり、`data/events.json` は消える可能性があります
- 長期で安定運用する場合は DB（Supabase など）への移行を推奨します
