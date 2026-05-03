# 小テスト印刷機能 v5

## 変更点

- 解答付き印刷時、解答表の下にサイトQRコードを表示するオプションを追加
- QRコードはサイトURLを元に生成
- 単語No.表示はデフォルトOFFに変更

## 反映方法

GitHub の `docs` フォルダに以下を上書き・追加してください。

- `docs/index.html`
- `docs/style.css`
- `docs/print.js`

既存の `app.js`、`words.js`、CSVはそのままで動作します。
