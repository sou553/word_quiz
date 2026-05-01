(() => {
  "use strict";

  const STORAGE_KEY = "system-wordbook-quiz-v1";
  const words = Array.isArray(window.WORDBOOK) ? window.WORDBOOK : [];

  const $ = (id) => document.getElementById(id);
  const state = {
    settings: { count: 10, mode: "en-ja", start: 1, end: words.length, wrongOnly: false, autoNext: true, hideChoices: true },
    queue: [],
    index: 0,
    score: 0,
    skipped: 0,
    streak: 0,
    bestStreak: 0,
    answered: false,
    currentChoices: [],
    wrongItems: [],
    retrySource: null,
    timer: null,
    stats: loadStats(),
  };

  const els = {
    totalWords: $("total-words"),
    rangeStart: $("range-start"),
    rangeEnd: $("range-end"),
    wrongOnly: $("wrong-only"),
    autoNext: $("auto-next"),
    hideChoices: $("hide-choices"),
    setupCard: $("setup-card"),
    quizCard: $("quiz-card"),
    resultCard: $("result-card"),
    startBtn: $("start-btn"),
    resetStatsBtn: $("reset-stats-btn"),
    themeToggle: $("theme-toggle"),
    modeLabel: $("mode-label"),
    progressLabel: $("progress-label"),
    progressBar: $("progress-bar"),
    scoreNow: $("score-now"),
    streakNow: $("streak-now"),
    directionPill: $("direction-pill"),
    questionText: $("question-text"),
    questionSub: $("question-sub"),
    choicesCover: $("choices-cover"),
    showChoicesBtn: $("show-choices-btn"),
    choices: $("choices"),
    feedback: $("feedback"),
    nextBtn: $("next-btn"),
    skipBtn: $("skip-btn"),
    quitBtn: $("quit-btn"),
    resultTitle: $("result-title"),
    resultMessage: $("result-message"),
    resultRate: $("result-rate"),
    metricCorrect: $("metric-correct"),
    metricWrong: $("metric-wrong"),
    metricSkip: $("metric-skip"),
    metricBestStreak: $("metric-best-streak"),
    reviewWrap: $("review-wrap"),
    reviewList: $("review-list"),
    retryWrongBtn: $("retry-wrong-btn"),
    backSetupBtn: $("back-setup-btn"),
  };

  init();

  function init() {
    els.totalWords.textContent = String(words.length);
    els.rangeEnd.value = String(words.length);
    els.rangeEnd.max = String(words.length);
    els.rangeStart.max = String(words.length);
    restoreTheme();
    wireEvents();
    updateWrongOnlyAvailability();
  }

  function wireEvents() {
    els.startBtn.addEventListener("click", () => startQuiz());
    els.showChoicesBtn.addEventListener("click", showChoices);
    els.nextBtn.addEventListener("click", nextQuestion);
    els.skipBtn.addEventListener("click", skipQuestion);
    els.quitBtn.addEventListener("click", finishQuiz);
    els.backSetupBtn.addEventListener("click", showSetup);
    els.retryWrongBtn.addEventListener("click", retryWrong);
    els.resetStatsBtn.addEventListener("click", resetStats);
    els.themeToggle.addEventListener("click", toggleTheme);

    document.addEventListener("keydown", (event) => {
      if (els.quizCard.classList.contains("hidden")) return;
      if (event.key === " " && !state.answered) {
        event.preventDefault();
        showChoices();
      }
      if (/^[1-4]$/.test(event.key) && !state.answered && !els.choices.classList.contains("hidden")) {
        const i = Number(event.key) - 1;
        const btn = els.choices.querySelectorAll("button")[i];
        if (btn) btn.click();
      }
      if (event.key === "Enter" && state.answered && !els.nextBtn.classList.contains("hidden")) {
        nextQuestion();
      }
    });
  }

  function collectSettings() {
    const count = Number(document.querySelector('input[name="count"]:checked')?.value || 10);
    const mode = document.querySelector('input[name="mode"]:checked')?.value || "en-ja";
    const start = clamp(Number(els.rangeStart.value || 1), 1, words.length);
    const end = clamp(Number(els.rangeEnd.value || words.length), 1, words.length);
    state.settings = {
      count,
      mode,
      start: Math.min(start, end),
      end: Math.max(start, end),
      wrongOnly: els.wrongOnly.checked,
      autoNext: els.autoNext.checked,
      hideChoices: els.hideChoices.checked,
    };
  }

  function startQuiz(customSource = null) {
    clearTimeout(state.timer);
    collectSettings();

    let pool = customSource || words.filter(item => item.id >= state.settings.start && item.id <= state.settings.end);
    if (state.settings.wrongOnly && !customSource) {
      const wrongIds = new Set(Object.entries(state.stats).filter(([, v]) => v.wrong > 0).map(([k]) => Number(k)));
      pool = pool.filter(item => wrongIds.has(item.id));
    }

    if (pool.length < 1) {
      alert("出題対象がありません。出題範囲または設定を変更してください。");
      return;
    }

    const neededFields = state.settings.mode === "mixed" ? ["word", "meaning"] : [state.settings.mode === "en-ja" ? "meaning" : "word"];
    const lacksChoices = neededFields.some(field => uniqueChoiceCount(words, field) < 4);
    if (lacksChoices) {
      alert("四択問題を作るには、単語帳全体に4種類以上の選択肢が必要です。");
      return;
    }

    const count = Math.min(state.settings.count, pool.length);
    state.queue = shuffle(pool).slice(0, count).map(item => ({ ...item, direction: resolveDirection(state.settings.mode) }));
    state.index = 0;
    state.score = 0;
    state.skipped = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.wrongItems = [];
    state.retrySource = customSource;

    els.setupCard.classList.add("hidden");
    els.resultCard.classList.add("hidden");
    els.quizCard.classList.remove("hidden");
    renderQuestion();
  }

  function resolveDirection(mode) {
    if (mode === "mixed") return Math.random() < 0.5 ? "en-ja" : "ja-en";
    return mode;
  }

  function renderQuestion() {
    clearTimeout(state.timer);
    const item = state.queue[state.index];
    state.answered = false;
    const total = state.queue.length;
    const currentNo = state.index + 1;
    const isEnJa = item.direction === "en-ja";
    const answer = isEnJa ? item.meaning : item.word;
    const distractorField = isEnJa ? "meaning" : "word";

    state.currentChoices = makeChoices(answer, distractorField, item.id);

    els.modeLabel.textContent = modeText(item.direction);
    els.progressLabel.textContent = `${currentNo} / ${total}`;
    els.progressBar.style.width = `${((currentNo - 1) / total) * 100}%`;
    els.scoreNow.textContent = String(state.score);
    els.streakNow.textContent = String(state.streak);
    els.directionPill.textContent = isEnJa ? "英語を日本語に" : "日本語を英語に";
    els.questionText.textContent = isEnJa ? item.word : item.meaning;
    els.questionText.classList.toggle("japanese", !isEnJa);
    els.questionSub.textContent = `No.${item.id}`;
    els.feedback.className = "feedback hidden";
    els.feedback.textContent = "";
    els.nextBtn.classList.add("hidden");
    els.skipBtn.disabled = false;

    renderChoices();
    if (state.settings.hideChoices) {
      els.choices.classList.add("hidden");
      els.choicesCover.classList.remove("hidden");
    } else {
      els.choices.classList.remove("hidden");
      els.choicesCover.classList.add("hidden");
    }
  }

  function renderChoices() {
    els.choices.innerHTML = "";
    state.currentChoices.forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.innerHTML = `<span class="num">${index + 1}</span>${escapeHtml(choice.label)}`;
      btn.dataset.correct = choice.correct ? "1" : "0";
      btn.addEventListener("click", () => answerQuestion(choice, btn));
      els.choices.appendChild(btn);
    });
  }

  function showChoices() {
    if (state.answered) return;
    els.choicesCover.classList.add("hidden");
    els.choices.classList.remove("hidden");
  }

  function answerQuestion(choice, clickedButton) {
    if (state.answered) return;
    state.answered = true;
    els.skipBtn.disabled = true;

    const item = state.queue[state.index];
    const correctText = item.direction === "en-ja" ? item.meaning : item.word;
    const buttons = [...els.choices.querySelectorAll("button")];
    buttons.forEach(btn => {
      const isCorrect = btn.dataset.correct === "1";
      btn.disabled = true;
      if (isCorrect) btn.classList.add("correct");
      if (btn === clickedButton && !isCorrect) btn.classList.add("wrong");
      if (!isCorrect && btn !== clickedButton) btn.classList.add("dim");
    });

    if (choice.correct) {
      state.score += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      updateItemStats(item.id, true);
      showFeedback(true, "正解", item);
      if (state.settings.autoNext) {
        state.timer = setTimeout(() => nextQuestion(), 700);
      } else {
        els.nextBtn.classList.remove("hidden");
      }
    } else {
      state.streak = 0;
      updateItemStats(item.id, false);
      state.wrongItems.push({ ...item, selected: choice.label, correct: correctText });
      showFeedback(false, `不正解：正解は「${correctText}」`, item);
      els.nextBtn.classList.remove("hidden");
    }
    els.scoreNow.textContent = String(state.score);
    els.streakNow.textContent = String(state.streak);
    updateWrongOnlyAvailability();
  }

  function showFeedback(ok, message, item) {
    els.feedback.className = `feedback ${ok ? "ok" : "bad"}`;
    els.feedback.innerHTML = `${escapeHtml(message)}<small>${escapeHtml(item.word)}：${escapeHtml(item.meaning)}</small>`;
  }

  function skipQuestion() {
    if (state.answered) return;
    const item = state.queue[state.index];
    const correctText = item.direction === "en-ja" ? item.meaning : item.word;
    state.answered = true;
    state.skipped += 1;
    state.streak = 0;
    els.skipBtn.disabled = true;
    updateItemStats(item.id, false);
    state.wrongItems.push({ ...item, selected: "スキップ", correct: correctText });
    showChoices();
    [...els.choices.querySelectorAll("button")].forEach(btn => {
      const isCorrect = btn.dataset.correct === "1";
      btn.disabled = true;
      if (isCorrect) btn.classList.add("correct");
      if (!isCorrect) btn.classList.add("dim");
    });
    showFeedback(false, `スキップ：正解は「${correctText}」`, item);
    els.nextBtn.classList.remove("hidden");
    els.scoreNow.textContent = String(state.score);
    els.streakNow.textContent = String(state.streak);
    updateWrongOnlyAvailability();
  }

  function nextQuestion() {
    clearTimeout(state.timer);
    if (state.index < state.queue.length - 1) {
      state.index += 1;
      renderQuestion();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    clearTimeout(state.timer);
    if (!state.queue.length) return showSetup();
    els.quizCard.classList.add("hidden");
    els.resultCard.classList.remove("hidden");
    const total = state.queue.length;
    const wrongCount = state.wrongItems.length;
    const rate = total ? Math.round((state.score / total) * 100) : 0;
    els.resultTitle.textContent = `${state.score} / ${total}`;
    els.resultMessage.textContent = resultMessage(rate);
    els.resultRate.textContent = String(rate);
    els.metricCorrect.textContent = String(state.score);
    els.metricWrong.textContent = String(Math.max(0, wrongCount - state.skipped));
    els.metricSkip.textContent = String(state.skipped);
    els.metricBestStreak.textContent = String(state.bestStreak);
    els.retryWrongBtn.disabled = wrongCount === 0;
    renderReview();
  }

  function renderReview() {
    els.reviewList.innerHTML = "";
    if (state.wrongItems.length === 0) {
      els.reviewWrap.classList.add("hidden");
      return;
    }
    els.reviewWrap.classList.remove("hidden");
    state.wrongItems.forEach(item => {
      const row = document.createElement("div");
      row.className = "review-item";
      row.innerHTML = `<span>No.${item.id}</span><b>${escapeHtml(item.word)}</b><em>${escapeHtml(item.meaning)}</em>`;
      els.reviewList.appendChild(row);
    });
  }

  function retryWrong() {
    if (!state.wrongItems.length) return;
    const unique = Array.from(new Map(state.wrongItems.map(item => [item.id, words.find(w => w.id === item.id) || item])).values());
    startQuiz(unique);
  }

  function showSetup() {
    clearTimeout(state.timer);
    els.resultCard.classList.add("hidden");
    els.quizCard.classList.add("hidden");
    els.setupCard.classList.remove("hidden");
    updateWrongOnlyAvailability();
  }

  function makeChoices(answer, field, excludeId) {
    // 選択肢は「出題範囲」ではなく、単語帳全体から作成する。
    // これにより、No.1〜1 のような狭い範囲でも四択問題を作成できる。
    const seen = new Set([answer]);
    const distractors = [];
    const candidates = shuffle(words.filter(item => item.id !== excludeId));
    for (const item of candidates) {
      const value = item[field];
      if (!value || seen.has(value)) continue;
      distractors.push({ label: value, correct: false });
      seen.add(value);
      if (distractors.length === 3) break;
    }
    return shuffle([{ label: answer, correct: true }, ...distractors]);
  }

  function uniqueChoiceCount(source, field) {
    return new Set(source.map(item => item[field]).filter(Boolean)).size;
  }

  function updateItemStats(id, correct) {
    const key = String(id);
    const current = state.stats[key] || { correct: 0, wrong: 0, last: null };
    if (correct) {
      current.correct += 1;
      if (current.wrong > 0) current.wrong -= 1;
    } else {
      current.wrong += 1;
    }
    current.last = new Date().toISOString();
    state.stats[key] = current;
    saveStats();
  }

  function updateWrongOnlyAvailability() {
    const wrongCount = Object.values(state.stats).filter(v => v.wrong > 0).length;
    els.wrongOnly.disabled = wrongCount === 0;
    if (wrongCount === 0) els.wrongOnly.checked = false;
    const label = els.wrongOnly.closest("label");
    if (label) label.title = wrongCount ? `${wrongCount}語が復習対象です` : "復習対象のミスはまだありません";
  }

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
  }

  function resetStats() {
    if (!confirm("保存済みのミス・正解履歴を削除しますか？")) return;
    state.stats = {};
    saveStats();
    updateWrongOnlyAvailability();
  }

  function toggleTheme() {
    const isDark = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = isDark ? "" : "dark";
    localStorage.setItem("word-quiz-theme", isDark ? "light" : "dark");
    els.themeToggle.textContent = isDark ? "ダーク" : "ライト";
  }

  function restoreTheme() {
    const saved = localStorage.getItem("word-quiz-theme");
    if (saved === "dark") {
      document.documentElement.dataset.theme = "dark";
      els.themeToggle.textContent = "ライト";
    }
  }

  function modeText(direction) {
    return direction === "en-ja" ? "英語→日本語" : "日本語→英語";
  }

  function resultMessage(rate) {
    if (rate >= 90) return "かなり安定しています。ミスだけ再テストで定着確認するとよいです。";
    if (rate >= 70) return "基礎は取れています。復習リストの単語を重点的に確認してください。";
    return "未定着の単語が多めです。10問単位で短く繰り返すのが向いています。";
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
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
