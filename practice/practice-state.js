/* ==========================================================================
   DYNANCA MATHEMATICS FOR COMPUTING — Practice State (localStorage)
   -------------------------------------------------------------------------
   Stores per-question attempt state keyed by questionId.
   Status: "unanswered" | "answered_correct" | "answered_wrong"

   If localStorage is broken/unavailable, the system keeps working with an
   in-memory fallback (state is lost on reload, but nothing crashes).

   Storage keys use the "dynanca-mfc-" namespace (Mathematics for Computing),
   replacing the earlier Python-practice-era "gp-" namespace. On first load
   this module migrates any existing "gp-practice-v1" record into the new
   key rather than silently discarding it, then removes the old key so the
   migration only runs once.
   ========================================================================== */
(function () {
  "use strict";

  const PRACTICE_SCOPE = (typeof window !== "undefined" && window.DynancaPracticeId) ? String(window.DynancaPracticeId) : "default";
  const STORAGE_KEY = "dynanca-mcq-" + PRACTICE_SCOPE + "-v2";
  const LEGACY_STORAGE_KEY = "gp-practice-v1"; // pre-migration (Python-practice era) key
  const SESSION_KEY = "dynanca-mcq-session-" + PRACTICE_SCOPE + "-v2"; // separate key: "where am I", not attempt data
  const VALID_STATUSES = ["unanswered", "answered_correct", "answered_wrong"];

  // In-memory fallback. Always present, even if localStorage is dead.
  let memory = Object.create(null);

  // Session/queue position — kept in its own storage key (not mixed into
  // `memory`, which is keyed by questionId) so a question id can never
  // collide with session bookkeeping. Powers "resume where I left off",
  // the engine's spaced-repetition-of-mistakes pacing, and (via
  // historyStack) the "Previous question" navigation trail surviving a
  // reload/re-entry.
  let session = { currentId: null, stepsSinceReview: 0, historyStack: [] };
  const MAX_PERSISTED_HISTORY = 50; // defensive cap, independent of any caller

  /* ---------- Load / Save ---------- */
  function safeParse(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (err) { /* fall through */ }
    return null;
  }

  function migrateLegacyIfNeeded() {
    try {
      const already = localStorage.getItem(STORAGE_KEY);
      if (already) return; // new key already has data — never overwrite it
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyRaw) return;
      const legacy = safeParse(legacyRaw);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
      }
      // Only remove the legacy key once we've safely copied (or found nothing
      // usable) — we never want to destroy a learner's progress silently.
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (err) {
      // localStorage unavailable — nothing to migrate, in-memory fallback handles it.
    }
  }

  function load() {
    migrateLegacyIfNeeded();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? safeParse(raw) : null;
      memory = Object.assign(Object.create(null), parsed || {});
    } catch (err) {
      // Corrupt / blocked — start fresh in-memory, don't crash the site.
      memory = Object.create(null);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch (err) {
      // Quota exceeded / private mode / blocked — silently keep in-memory only.
    }
  }

  load();

  /* ---------- Session (queue position) load / save ---------- */
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const parsed = raw ? safeParse(raw) : null;
      if (parsed && typeof parsed.currentId === "string") {
        session.currentId = parsed.currentId;
      }
      if (parsed && Number.isSafeInteger(parsed.stepsSinceReview) && parsed.stepsSinceReview >= 0) {
        session.stepsSinceReview = parsed.stepsSinceReview;
      }
      if (parsed && Array.isArray(parsed.historyStack)) {
        session.historyStack = parsed.historyStack
          .filter(id => typeof id === "string" && id)
          .slice(-MAX_PERSISTED_HISTORY);
      }
    } catch (err) {
      // localStorage unavailable — session stays in-memory only.
    }
  }

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      // Quota exceeded / private mode / blocked — silently keep in-memory only.
    }
  }

  loadSession();

  /* ---------- Record helpers ---------- */
  function normalizeRecord(rec, questionId) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return null;
    if (!VALID_STATUSES.includes(rec.status)) return null;
    if (rec.status === "unanswered") return null;
    if (typeof rec.selectedLabel !== "string" || !rec.selectedLabel.trim()) return null;
    let status = rec.status;
    const engine = typeof window !== "undefined" && window.PracticeEngine;
    const q = engine && typeof engine.getQuestion === "function" ? engine.getQuestion(questionId) : null;
    if (q && engine.optionList && engine.optionIsCorrect) {
      const opts = engine.optionList(q);
      if (opts.length) {
        const selected = opts.find(o => o.label === rec.selectedLabel);
        if (!selected) return null;
        status = engine.optionIsCorrect(q, selected) ? "answered_correct" : "answered_wrong";
      } else if (rec.selectedLabel !== "__answer__") return null;
    }
    return {
      status: status,
      selectedLabel: rec.selectedLabel,
      isCorrect: status === "answered_correct",
      answeredAt: Number.isFinite(rec.answeredAt) && rec.answeredAt > 0 ? rec.answeredAt : null,
      category: typeof rec.category === "string" ? rec.category : null
    };
  }

  function allQuestions() {
    if (typeof window !== "undefined" && window.PracticeEngine && typeof window.PracticeEngine.getAllQuestions === "function") {
      return window.PracticeEngine.getAllQuestions();
    }
    return (typeof PRACTICES !== "undefined") ? PRACTICES : [];
  }

  // Set of question ids that actually exist in the CURRENTLY loaded bank.
  // `memory` is keyed by questionId under a single storage key per quiz, so
  // if a bank is edited between visits (a question removed or its id
  // renamed), old attempt records for ids that no longer exist can linger
  // in that same storage key. Stats/mistake-review must only ever count
  // against the active bank's real question set, never those stale
  // leftovers — otherwise "X / total answered" can overcount, and a
  // removed/renamed question could still show up in "Review N mistakes".
  function activeQuestionIdSet() {
    const set = new Set();
    allQuestions().forEach(q => { if (q && q.id != null) set.add(String(q.id)); });
    return set;
  }

  /* ---------- Public API ---------- */
  const PracticeState = {
    getStatus(questionId) {
      const rec = normalizeRecord(memory[questionId], questionId);
      return rec ? rec.status : "unanswered";
    },

    getRecord(questionId) {
      return normalizeRecord(memory[questionId], questionId);
    },

    saveAttempt(questionId, selectedLabel, isCorrect, category) {
      if (!questionId || typeof selectedLabel !== "string" || !selectedLabel.trim()) return;
      memory[questionId] = {
        status: isCorrect ? "answered_correct" : "answered_wrong",
        selectedLabel: selectedLabel,
        answeredAt: Date.now(),
        category: category || (memory[questionId] && memory[questionId].category) || null
      };
      save();
    },

    reset(questionId) {
      if (memory[questionId]) {
        delete memory[questionId];
        save();
      }
    },

    resetAll() {
      memory = Object.create(null);
      save();
    },

    getStats() {
      const activeIds = activeQuestionIdSet();
      const total = activeIds.size;
      let correct = 0, wrong = 0;
      for (const id in memory) {
        if (!activeIds.has(String(id))) continue; // stale/removed/renamed question — never counted
        const rec = normalizeRecord(memory[id], id);
        if (!rec) continue;
        if (rec.status === "answered_correct") correct++;
        else if (rec.status === "answered_wrong") wrong++;
      }
      return {
        total,
        answered: correct + wrong,
        correct,
        wrong,
        unanswered: Math.max(0, total - correct - wrong)
      };
    },

    getAllRecords() {
      const out = {};
      for (const id in memory) {
        const rec = normalizeRecord(memory[id], id);
        if (rec) out[id] = rec;
      }
      return out;
    },

    /**
     * IDs of every question currently answered incorrectly — the learner's
     * "mistakes to review" list.
     */
    getMistakeIds() {
      const activeIds = activeQuestionIdSet();
      const out = [];
      for (const id in memory) {
        if (!activeIds.has(String(id))) continue; // stale/removed/renamed question — never surfaced for review
        const rec = normalizeRecord(memory[id], id);
        if (rec && rec.status === "answered_wrong") out.push(id);
      }
      return out;
    },

    /**
     * Per-category performance: attempts, correct count, and accuracy —
     * used to power "weak area" practice. Categories with no attempts are
     * omitted (there's nothing yet to call weak or strong).
     */
    getCategoryPerformance() {
      const byCategory = {};
      allQuestions().forEach(q => {
        const rec = normalizeRecord(memory[q.id], q.id);
        if (!rec) return;
        const cat = q.category || "Uncategorized";
        if (!byCategory[cat]) byCategory[cat] = { attempts: 0, correct: 0 };
        byCategory[cat].attempts++;
        if (rec.isCorrect) byCategory[cat].correct++;
      });
      const out = {};
      Object.keys(byCategory).forEach(cat => {
        const { attempts, correct } = byCategory[cat];
        out[cat] = { attempts, correct, accuracy: attempts ? correct / attempts : 0 };
      });
      return out;
    },

    /**
     * Categories where the learner has attempted at least `minAttempts`
     * questions and their accuracy is below `threshold` (default 0.7) —
     * sorted weakest first.
     */
    getWeakCategories(threshold, minAttempts) {
      threshold = typeof threshold === "number" ? threshold : 0.7;
      minAttempts = typeof minAttempts === "number" ? minAttempts : 3;
      const perf = this.getCategoryPerformance();
      return Object.keys(perf)
        .filter(cat => perf[cat].attempts >= minAttempts && perf[cat].accuracy < threshold)
        .sort((a, b) => perf[a].accuracy - perf[b].accuracy)
        .map(cat => Object.assign({ category: cat }, perf[cat]));
    },

    /* ---------- Session / queue position ----------
       Where the learner currently is in the continuous question stream, so
       a refresh resumes on the same question instead of restarting. This
       is deliberately separate from per-question attempt records above. */
    getCurrentQuestionId() {
      return session.currentId;
    },

    setCurrentQuestionId(questionId) {
      if (!questionId) return;
      session.currentId = questionId;
      saveSession();
    },

    /**
     * A simple counter the engine uses to pace how often a due mistake is
     * interleaved back into the main stream (lightweight spaced
     * repetition), so the pacing survives a page refresh mid-session.
     */
    getReviewStep() {
      return session.stepsSinceReview;
    },

    incrementReviewStep() {
      session.stepsSinceReview += 1;
      saveSession();
    },

    resetReviewStep() {
      session.stepsSinceReview = 0;
      saveSession();
    },

    /**
     * Persisted "Previous question" navigation trail. Stored (capped) so
     * the trail survives a reload/re-entry instead of resetting the moment
     * practice-engine.js's in-memory historyStack is recreated. The engine
     * owns *when* to read/write this (advance/goBack/mode switches); this
     * module only validates shape and persists it.
     */
    getHistoryStack() {
      return session.historyStack.slice();
    },

    setHistoryStack(stack) {
      if (!Array.isArray(stack)) return;
      session.historyStack = stack
        .filter(id => typeof id === "string" && id)
        .slice(-MAX_PERSISTED_HISTORY);
      saveSession();
    }
  };

  if (typeof window !== "undefined") {
    window.PracticeState = PracticeState;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PracticeState;
  }
})();
