(() => {
  "use strict";

  const STORAGE_KEY = "system-wordbook-quiz-v1";
  const FALLBACK_SITE_URL = "https://sou553.github.io/word_quiz/";
  const $ = (id) => document.getElementById(id);

  const allWords = Array.isArray(window.WORDBOOK)
    ? window.WORDBOOK
    : (Array.isArray(window.words) ? window.words : []);

  const groups = Array.isArray(window.WORDBOOK_GROUPS)
    ? window.WORDBOOK_GROUPS
    : [{ id: "all", name: "全単語", count: allWords.length, rangeMax: allWords.length }];

  let printQueue = [];

  const els = {
    buildBtn: $("build-print-btn"),
    printBtn: $("print-quiz-btn"),
    printAnswerBtn: $("print-with-answer-btn"),
    preview: $("print-preview"),
    printArea: $("print-area"),
    status: $("print-status"),
    shuffle: $("print-shuffle"),
    showNo: $("print-show-no"),
    printQr: $("print-qr"),
    rangeStart: $("range-start"),
    rangeEnd: $("range-end"),
    wrongOnly: $("wrong-only"),
  };

  if (!els.buildBtn || !els.printBtn || !els.printAnswerBtn || !els.preview || !els.printArea) return;

  wireEvents();

  function wireEvents() {
    els.buildBtn.addEventListener("click", () => buildPrintQuiz(false));
    els.printBtn.addEventListener("click", () => printQuiz(false));
    els.printAnswerBtn.addEventListener("click", () => printQuiz(true));

    document.addEventListener("change", (event) => {
      if (!event.target.matches('input[name="group"], input[name="count"], input[name="mode"], #range-start, #range-end, #wrong-only, #print-shuffle, #print-show-no, #print-qr')) return;
      setPrintButtons(false);
      if (els.status) els.status.textContent = "設定が変更されました。必要なら小テストを作り直してください。";
    });
  }

  function buildPrintQuiz(showAnswers) {
    const settings = collectSettings();
    let pool = getActiveWords(settings.group).filter((item) => {
      const no = getQuestionNo(item, settings.group);
      return no >= settings.start && no <= settings.end;
    });

    if (settings.wrongOnly) {
      const stats = loadStats();
      pool = pool.filter((item) => getItemStats(item, stats).wrong > 0);
    }

    if (!pool.length) {
      alert("印刷する出題対象がありません。単語群・範囲・復習設定を確認してください。");
      return false;
    }

    const count = Math.min(settings.count, pool.length);
    const source = settings.shuffle ? shuffle(pool) : [...pool];
    printQueue = source.slice(0, count).map((item) => ({
      ...item,
      direction: resolveDirection(settings.mode),
    }));

    renderPrint(settings, showAnswers);
    setPrintButtons(true);
    if (els.status) {
      els.status.textContent = `${printQueue.length}問の小テストを作成しました。プレビューを確認して印刷できます。`;
    }
    return true;
  }

  function printQuiz(showAnswers) {
    if (!printQueue.length && !buildPrintQuiz(showAnswers)) return;
    const settings = collectSettings();
    renderPrint(settings, showAnswers);
    document.body.classList.add("printing");
    window.setTimeout(() => window.print(), 50);
  }

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing");
  });

  function collectSettings() {
    const group = document.querySelector('input[name="group"]:checked')?.value || groups[0]?.id || "all";
    const count = Number(document.querySelector('input[name="count"]:checked')?.value || 10);
    const mode = document.querySelector('input[name="mode"]:checked')?.value || "en-ja";
    const maxNo = getRangeMax(group);
    const rawStart = Number(els.rangeStart?.value || 1);
    const rawEnd = Number(els.rangeEnd?.value || maxNo);
    const start = clamp(rawStart, 1, maxNo);
    const end = clamp(rawEnd, 1, maxNo);

    return {
      group,
      count,
      mode,
      start: Math.min(start, end),
      end: Math.max(start, end),
      wrongOnly: Boolean(els.wrongOnly?.checked),
      shuffle: els.shuffle ? els.shuffle.checked : true,
      showNo: els.showNo ? els.showNo.checked : false,
      printQr: els.printQr ? els.printQr.checked : true,
    };
  }

  function renderPrint(settings, showAnswers) {
    const group = groups.find((g) => g.id === settings.group) || groups[0] || { name: "単語" };
    const now = new Date();
    const dateText = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
    const modeLabel = modeText(settings.mode);
    const note = settings.wrongOnly ? " / ミスだけ" : "";
    const siteUrl = getSiteUrl();
    const footer = buildFooter(siteUrl, dateText);

    const questionRows = printQueue.map((item, index) => {
      const isEnJa = item.direction === "en-ja";
      const q = isEnJa ? item.word : item.meaning;
      const no = getQuestionNo(item, settings.group);
      const label = isEnJa ? "英→日" : "日→英";
      const noBadge = settings.showNo ? `<span class="print-qno" title="No.${escapeHtml(no)}">No.${escapeHtml(no)}</span>` : "";

      return `
        <div class="print-question">
          <div class="print-no">${index + 1}</div>
          <div class="print-word"><span class="print-dir">${label}</span>${noBadge}<span class="print-word-text">${escapeHtml(q)}</span></div>
          <div class="print-blank"></div>
        </div>
      `;
    }).join("");

    const answerRows = printQueue.map((item, index) => {
      const isEnJa = item.direction === "en-ja";
      const q = isEnJa ? item.word : item.meaning;
      const a = isEnJa ? item.meaning : item.word;
      const no = getQuestionNo(item, settings.group);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${settings.showNo ? `No.${escapeHtml(no)} / ` : ""}${escapeHtml(q)}</td>
          <td>${escapeHtml(a)}</td>
        </tr>
      `;
    }).join("");

    const html = `
      <section class="print-sheet">
        <div class="print-header">
          <div>
            <h1>小テスト</h1>
            <p>${escapeHtml(group?.name || "単語")} / ${settings.start}〜${settings.end} / ${printQueue.length}問${note}</p>
            <p>出題形式：${escapeHtml(modeLabel)}</p>
          </div>
          <div class="print-meta">
            <p>日付：${dateText}</p>
            <p>名前：________________</p>
            <p>点数：______ / ${printQueue.length}</p>
          </div>
        </div>
        <div class="print-grid">${questionRows}</div>
        ${footer}
      </section>
      ${showAnswers ? `
        <section class="print-sheet answer-sheet">
          <h1>解答</h1>
          <table class="answer-table">
            <thead><tr><th>No.</th><th>問題</th><th>解答</th></tr></thead>
            <tbody>${answerRows}</tbody>
          </table>
          ${settings.printQr ? buildQrBlock(siteUrl) : ""}
          ${footer}
        </section>
      ` : ""}
    `;

    els.preview.innerHTML = html;
    els.preview.classList.remove("hidden");
    els.printArea.innerHTML = html;
  }

  function buildFooter(siteUrl, dateText) {
    return `
      <div class="print-footer">
        <span>単語トレーニング</span>
        <span>${escapeHtml(siteUrl)}</span>
        <span>作成日：${dateText}</span>
      </div>
    `;
  }


  function buildQrBlock(siteUrl) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=8&data=${encodeURIComponent(siteUrl)}`;
    return `
      <div class="answer-qr-block">
        <div>
          <p class="answer-qr-title">サイトQRコード</p>
          <p class="answer-qr-url">${escapeHtml(siteUrl)}</p>
        </div>
        <img class="answer-qr-img" src="${qrSrc}" alt="サイトURLのQRコード">
      </div>
    `;
  }

  function getSiteUrl() {
    const href = window.location.href || "";
    if (href.startsWith("http://") || href.startsWith("https://")) return href.split("#")[0];
    return FALLBACK_SITE_URL;
  }

  function setPrintButtons(enabled) {
    els.printBtn.disabled = !enabled;
    els.printAnswerBtn.disabled = !enabled;
  }

  function getActiveWords(groupId) {
    if (groupId === "all") return allWords;
    return allWords.filter((item) => item.groupId === groupId);
  }

  function getRangeMax(groupId) {
    const group = groups.find((g) => g.id === groupId);
    return Number(group?.rangeMax || group?.count || allWords.length || 1);
  }

  function getQuestionNo(item, groupId) {
    if (groupId === "all") return item.globalId || item.id || 0;
    return item.id || item.globalId || 0;
  }

  function resolveDirection(mode) {
    if (mode === "mixed") return Math.random() < 0.5 ? "en-ja" : "ja-en";
    return mode;
  }

  function modeText(mode) {
    if (mode === "en-ja") return "英語→日本語";
    if (mode === "ja-en") return "日本語→英語";
    return "両方ランダム";
  }

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function getItemStats(item, stats) {
    const uid = item.uid || `${item.groupId || "word"}:${item.id || item.globalId}`;
    return stats[uid] || (item.groupId === "system" ? stats[String(item.id)] : null) || { correct: 0, wrong: 0, last: null };
  }

  function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
