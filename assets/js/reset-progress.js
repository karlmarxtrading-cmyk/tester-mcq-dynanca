/* ==========================================================================
   DYNANCA PRACTICE SHELL — Universal Reset Progress Utility
   -------------------------------------------------------------------------
   PURPOSE
   One vanilla-JS file, reusable as-is across every Dynanca practice site
   that shares this shell (practice-state.js / practice-engine.js /
   practices.js / assets/js/shell.js / index.html). It only clears the
   localStorage keys that belong to PRACTICE PROGRESS. It does not read or
   modify practices.js, practice-engine.js, CSS, theme preference, or any
   other site's data.

   WHAT THIS CLEARS
     dynanca-mcq-<quiz>-v2         — per-question attempt records for the
                                      quiz currently open (practice-state.js
                                      scopes storage per quiz id, read from
                                      window.DynancaPracticeId)
     dynanca-mcq-session-<quiz>-v2 — "where am I" queue position / review
                                      pacing for that same quiz
     gp-practice-v1                — legacy pre-migration key (backward-
                                      compat, harmless to remove if present)

   WHAT THIS NEVER TOUCHES
     - theme preference (e.g. "dynanca-mfc-theme-mode", owned by shell.js)
     - authentication data
     - any other localStorage key belonging to this site or any other site
     - practices.js content / question bank
     - practice-engine.js logic (scoring, answer checking, review mistakes)

   SCOPE NOTE — THIS IS A DESTRUCTIVE RESET, NOT A PERSISTENCE LAYER
   ---------------------------------------------------------------------
   practice-engine.js persists its "Previous" navigation trail through
   PracticeState.getHistoryStack()/setHistoryStack() (stored under the
   SESSION_KEY this file already clears), so a reload normally resumes
   with the same history. Calling resetAll() intentionally clears that
   key too — as part of a full progress reset the learner explicitly
   asked for, the navigation trail is supposed to go with it. This file
   has no other effect on navigation history; it never partially clears
   or rewrites it outside of a full resetAll().

   USAGE ON ANY DYNANCA SITE WITH THIS SHELL
   1. Copy this file to:  assets/js/reset-progress.js
   2. Add ONE script tag to index.html, after shell.js:
        <script src="assets/js/reset-progress.js"></script>
   3. Use window.DynancaPracticeReset from your own UI, e.g.:
        DynancaPracticeReset.mount("#resetProgressSlot");
      ...or drop a button anywhere in your HTML with the class
      "dynanca-reset-progress" and this file will bind it automatically:
        <button class="dynanca-reset-progress">Reset progress</button>

   PUBLIC API — window.DynancaPracticeReset
     resetAll(options)   Clears all practice storage keys. Reloads the page
                          by default so every in-memory module (PracticeState,
                          PracticeEngine) re-initializes cleanly. Pass
                          { reload: false } to skip the reload (advanced use).
                          Returns the array of keys that actually had data.
     getStorageKeys()    Returns the list of localStorage keys this utility
                          is responsible for (current + legacy).
     hasProgress()       Returns true if any of those keys currently hold
                          non-empty data.
     createButton(label) Returns a plain, unstyled <button class="dynanca-
                          reset-progress"> element (not yet in the DOM, not
                          yet bound) that you can insert wherever you like.
     mount(target)       Convenience helper: pass a selector string or a DOM
                          element. If the target itself already has the
                          "dynanca-reset-progress" class, it is bound as the
                          button. Otherwise a button is created via
                          createButton() and appended inside the target.
                          Safe to call more than once — the click handler is
                          bound at most once per button.

   SAFETY
     - Every localStorage access is wrapped in try/catch. If localStorage is
       unavailable, blocked, or throws (private browsing, quota, disabled
       storage, etc.), this file degrades to a harmless no-op instead of
       throwing.
     - hasProgress()/resetAll() never assume localStorage exists.
     - Click binding uses a small per-element flag so re-running mount() or
       having the class present at multiple init times never double-attaches
       a listener and never leaks handlers.
     - resetAll() reloads the page exactly once per call — it does not loop,
       poll, or re-reload itself.
   ========================================================================== */
(function () {
  "use strict";

  // practice-state.js scopes its storage key per quiz (window.DynancaPracticeId,
  // set by data-loader.js from the "?quiz=" URL param, falling back to
  // "default" when absent). This must compute the SAME key or "Reset
  // progress" silently clears keys nothing ever wrote to.
  var PRACTICE_SCOPE = (typeof window !== "undefined" && window.DynancaPracticeId) ? String(window.DynancaPracticeId) : "default";
  var STORAGE_KEY = "dynanca-mcq-" + PRACTICE_SCOPE + "-v2";
  var SESSION_KEY = "dynanca-mcq-session-" + PRACTICE_SCOPE + "-v2";
  var LEGACY_KEYS = ["gp-practice-v1"];
  var BUTTON_CLASS = "dynanca-reset-progress";
  var BOUND_FLAG = "__dynancaResetBound__";

  /* ---------- Safe localStorage helpers ---------- */
  function isStorageAvailable() {
    try {
      var probeKey = "__dynanca_reset_probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      return true;
    } catch (err) {
      return false;
    }
  }

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* blocked/unavailable — nothing to do, never throw */
    }
  }

  /* ---------- Public read helpers ---------- */
  function getStorageKeys() {
    // Fresh array each call so callers can't mutate our internal list.
    return [STORAGE_KEY, SESSION_KEY].concat(LEGACY_KEYS);
  }

  function hasProgress() {
    if (!isStorageAvailable()) return false;
    return getStorageKeys().some(function (key) {
      var value = safeGet(key);
      return !!value && value !== "{}" && value !== "null";
    });
  }

  /* ---------- Core reset ---------- */
  function resetAll(options) {
    var opts = options || {};
    var removedKeys = [];

    if (isStorageAvailable()) {
      getStorageKeys().forEach(function (key) {
        if (safeGet(key) !== null) removedKeys.push(key);
        safeRemove(key);
      });
    }
    // If storage isn't available there was nothing persisted to clear —
    // resetAll() still returns an empty array rather than throwing.

    if (opts.reload !== false) {
      // Exactly one reload per resetAll() call. This is deliberate: it's
      // the simplest reliable way to also clear practice-engine.js's
      // in-memory historyStack/currentId without touching that file.
      window.location.reload();
    }

    return removedKeys;
  }

  /* ---------- Optional lightweight UI ---------- */
  function createButton(label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = BUTTON_CLASS;
    btn.textContent = label || "Reset progress";
    return btn;
  }

  function bindClick(btn) {
    if (!btn || btn[BOUND_FLAG]) return; // never attach twice
    btn[BOUND_FLAG] = true;
    btn.addEventListener("click", function () {
      var confirmed = window.confirm(
        "Reset all practice progress on this page? This cannot be undone."
      );
      if (!confirmed) return;

      btn.disabled = true;
      var originalLabel = btn.textContent;
      btn.textContent = "Resetting…";

      var removed = resetAll(); // reloads by default; code after this line
                                 // only matters if the caller passed
                                 // { reload: false } via a custom handler.
      // `removed` is always an array (possibly empty), which is always
      // truthy in JS — checking `if (removed)` alone never distinguishes
      // "there was progress to clear" from "there was nothing to clear".
      // With the default reload this branch is moot (the page reloads
      // immediately after), but it matters for the documented advanced
      // `{ reload: false }` usage, where this button text is the only
      // feedback the caller gets.
      if (removed.length > 0) {
        btn.textContent = "Progress reset ✓";
      } else {
        btn.textContent = originalLabel;
        btn.disabled = false;
      }
    });
  }

  function mount(target) {
    var el = null;
    if (typeof target === "string") {
      el = document.querySelector(target);
    } else if (target && target.nodeType === 1) {
      el = target;
    }
    if (!el) return null;

    var btn;
    if (el.classList && el.classList.contains(BUTTON_CLASS)) {
      btn = el; // caller already supplied their own button element
    } else {
      btn = createButton();
      el.appendChild(btn);
    }
    bindClick(btn);
    return btn;
  }

  // Auto-bind any button already in the markup with the reset class, so a
  // site can just drop <button class="dynanca-reset-progress"> in its HTML
  // with zero JS wiring. Safe to run alongside manual mount() calls.
  function autoBindExisting() {
    var run = function () {
      var buttons = document.querySelectorAll("." + BUTTON_CLASS);
      for (var i = 0; i < buttons.length; i++) bindClick(buttons[i]);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }
  if (typeof document !== "undefined") autoBindExisting();

  /* ---------- Export ---------- */
  var DynancaPracticeReset = {
    resetAll: resetAll,
    getStorageKeys: getStorageKeys,
    hasProgress: hasProgress,
    createButton: createButton,
    mount: mount
  };

  if (typeof window !== "undefined") {
    window.DynancaPracticeReset = DynancaPracticeReset;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = DynancaPracticeReset;
  }
})();
