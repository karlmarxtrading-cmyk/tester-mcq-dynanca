/* ==========================================================================
   DYNANCA MATHEMATICS FOR COMPUTING — Unlimited Practice — Shell
   -------------------------------------------------------------------------
   UI layer only. Responsible for: starting the theme module, measuring the sticky header so
   scrolling never hides content behind it, the small "review mistakes"
   affordance, and the progress line.

   Deliberately NOT here: which question is shown, question ordering,
   pedagogy, or anything touching localStorage practice data — all of that
   lives in PracticeEngine / PracticeState. This file never re-implements
   answer handling and never renders chapter/category/topic navigation.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Theme (light / dark / system) ----------
     The theme lives in its own standalone module, assets/js/theme.js
     (window.DynancaTheme), loaded in <head>. It has no dependency on the
     practice engine or on the question data, so it is initialised here
     BEFORE — and independently of — the engine boot: the theme buttons
     work even when a bank fails to load. The storage key is unchanged
     ("dynanca-mfc-theme-mode"). */
  function initTheme() {
    if (window.DynancaTheme && typeof window.DynancaTheme.init === "function") {
      window.DynancaTheme.init();
    }
  }

  /* ---------- Header height measurement ----------
     The header is sticky, but its height isn't a fixed number — it wraps
     differently at different zoom levels, viewport widths, and font sizes.
     Rather than hardcoding a pixel offset (the old bug), measure the real
     header on load/resize and publish it as a CSS custom property. Every
     scroll target (`.practice-question`) uses `scroll-margin-top: var(...)`
     so it can never end up hidden underneath the sticky header, regardless
     of how tall that header actually is right now. */
  var ROOT_STYLE = document.documentElement.style;

  function publishHeaderHeight() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var h = Math.ceil(header.getBoundingClientRect().height);
    ROOT_STYLE.setProperty("--dmc-header-h", h + "px");
  }

  function initHeaderOffset() {
    publishHeaderHeight();
    if (typeof ResizeObserver === "function") {
      var header = document.querySelector(".site-header");
      if (header) {
        var ro = new ResizeObserver(function () { publishHeaderHeight(); });
        ro.observe(header);
      }
    }
    // Fallback / belt-and-suspenders for browsers or test environments
    // without ResizeObserver, and for viewport changes (rotation, browser
    // zoom) that don't always trigger a header resize event.
    window.addEventListener("resize", publishHeaderHeight);
    window.addEventListener("orientationchange", publishHeaderHeight);
  }

  /* ---------- Progress summary ---------- */
  var progressEl = document.getElementById("progressSummary");

  function renderProgress() {
    if (!progressEl || typeof PracticeState === "undefined") return;
    var stats = PracticeState.getStats();
    if (!stats.total) {
      progressEl.textContent = "";
      return;
    }
    progressEl.innerHTML =
      "<strong>" + stats.answered + " / " + stats.total + "</strong> done &middot; " +
      "<strong>" + stats.correct + "</strong> correct";
  }

  /* ---------- Review-mistakes affordance ----------
     Deliberately small and secondary — a single, quiet toggle, never a bar
     of filter chips. It only exists at all once there's something to
     review, and it's the only "navigation" the practice UI has. */
  var reviewEl = document.getElementById("reviewControl");

  function renderReviewControl() {
    if (!reviewEl || typeof PracticeState === "undefined" || typeof PracticeEngine === "undefined") return;
    var mode = PracticeEngine.getMode();

    if (mode === "review") {
      reviewEl.innerHTML =
        '<button type="button" class="review-toggle review-toggle--active" data-action="exit-review">' +
        "&larr; Back to practice</button>";
      return;
    }

    var mistakeCount = PracticeState.getMistakeIds().length;
    if (mistakeCount === 0) {
      reviewEl.innerHTML = "";
      return;
    }
    reviewEl.innerHTML =
      '<button type="button" class="review-toggle" data-action="enter-review">' +
      "Review " + mistakeCount + (mistakeCount === 1 ? " mistake" : " mistakes") +
      "</button>";
  }

  function initReviewControl() {
    if (!reviewEl) return;
    reviewEl.addEventListener("click", function (event) {
      var btn = event.target.closest("button[data-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      if (action === "enter-review") {
        PracticeEngine.enterReviewMode();
      } else if (action === "exit-review") {
        PracticeEngine.exitReviewMode();
      }
      renderReviewControl();
    });
  }

  /* ---------- React to the engine's own events ----------
     The engine tells us (via the container) when an answer was recorded or
     the stream advanced — that's all the shell needs to keep progress and
     the review affordance current. It never reaches into PracticeState to
     pick or filter questions itself. */
  function initEngineListeners() {
    var container = document.getElementById("practiceContainer");
    if (!container) return;
    container.addEventListener("practice:answered", function () {
      renderProgress();
      renderReviewControl();
    });
    container.addEventListener("practice:advanced", function () {
      renderReviewControl();
    });
  }

  /* ---------- Boot ----------
     Two independent stages:
       1. the shell itself (theme + sticky-header measurement) — always
          runs, needs no data, and must survive a failed load;
       2. the practice engine — runs only once the question bank is ready.
     Previously both were one function that returned early (or never ran)
     when the data was missing, which left the theme switch dead on every
     error page. */
  var shellStarted = false;

  function bootShell() {
    if (shellStarted) return;
    shellStarted = true;
    initTheme();
    initHeaderOffset();
  }

  function bootEngine() {
    if (typeof PracticeEngine === "undefined" || typeof PracticeState === "undefined") {
      console.error("[Shell] PracticeEngine/PracticeState not loaded yet.");
      return;
    }
    PracticeEngine.init("practiceContainer");
    PracticeEngine.start();
    renderProgress();
    renderReviewControl();
    initReviewControl();
    initEngineListeners();
  }

  function bootWhenReady() {
    bootShell();
    if (window.DynancaPracticeReady && typeof window.DynancaPracticeReady.then === "function") {
      window.DynancaPracticeReady.then(bootEngine).catch(function () {
        // Nothing to do here: data-loader.js has already logged the
        // technical cause and put a readable error state on the page.
      });
    } else {
      bootEngine();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWhenReady);
  } else {
    bootWhenReady();
  }
})();
