import csv, json
from pathlib import Path

src = Path("docs/system_wordbook.csv")
out = Path("docs/words.js")
rows = []
with src.open("r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader, start=1):
        word = (row.get("単語") or row.get("word") or "").strip()
        meaning = (row.get("意味") or row.get("meaning") or "").strip()
        if word and meaning:
            rows.append({"id": i, "word": word, "meaning": meaning})
out.write_text("window.WORDBOOK = " + json.dumps(rows, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
print(f"generated: {out} ({len(rows)} words)")
