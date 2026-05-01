import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"

SOURCES = [
    {"id": "system", "name": "システム英単語", "csv": "system_wordbook.csv"},
    {"id": "pass_pre1", "name": "英検準1級", "csv": "pass_pre1_words_meanings.csv"},
]

all_words = []
groups = []
global_id = 1

for source in SOURCES:
    path = DOCS / source["csv"]
    rows = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            word = (row.get("単語") or row.get("word") or "").strip()
            meaning = (row.get("意味") or row.get("meaning") or "").strip()
            if not word or not meaning:
                continue
            local_no = len(rows) + 1
            rows.append({
                "uid": f"{source['id']}-{local_no}",
                "groupId": source["id"],
                "groupName": source["name"],
                "id": local_no,
                "globalId": global_id,
                "word": word,
                "meaning": meaning,
            })
            global_id += 1
    groups.append({"id": source["id"], "name": source["name"], "count": len(rows), "rangeMax": len(rows)})
    all_words.extend(rows)

groups.append({"id": "all", "name": "全単語", "count": len(all_words), "rangeMax": len(all_words)})

content = "window.WORDBOOK_GROUPS = " + json.dumps(groups, ensure_ascii=False, indent=2) + ";\n\n"
content += "window.WORDBOOK = " + json.dumps(all_words, ensure_ascii=False, indent=2) + ";\n"
(DOCS / "words.js").write_text(content, encoding="utf-8")
print(f"generated: {len(all_words)} words / {len(groups)} groups")
