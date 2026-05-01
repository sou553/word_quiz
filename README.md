# 単語テストサイト（GitHub Pages対応）

CSVから作成した四択形式の単語テストサイトです。

## 内容

- `docs/index.html`：サイト本体
- `docs/style.css`：デザイン
- `docs/app.js`：クイズ処理
- `docs/words.js`：単語データ（1200語）
- `docs/system_wordbook.csv`：元CSVのコピー

## 機能

- 問題数：10 / 30 / 50
- 出題方向：英語→日本語 / 日本語→英語 / 両方
- 四択問題
- 最初は選択肢を非表示
- 出題範囲指定
- ミスだけ再テスト
- ブラウザ内に学習履歴を保存
- ダークモード
- キーボード操作
  - Space：選択肢表示
  - 1〜4：回答
  - Enter：次へ

## GitHub Pagesで公開する方法

1. リポジトリにこのフォルダ内の `docs` フォルダを置く。
2. GitHubの `Settings` → `Pages` を開く。
3. Sourceを `Deploy from a branch` にする。
4. Branchを `main`、Folderを `/docs` にする。
5. 保存後、表示されたURLにアクセスする。

## データを差し替える場合

`system_wordbook.csv` を差し替えたあと、`words.js` を再生成する必要があります。
CSV列名は以下を想定しています。

```csv
単語,意味
follow,～に続く
consider,～を考慮する
```
