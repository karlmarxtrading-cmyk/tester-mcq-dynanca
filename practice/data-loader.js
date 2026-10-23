/* ==========================================================================
   DYNANCA — practice page data loader
   -------------------------------------------------------------------------
   Resolves ?quiz=<manifest entry id> to a question bank and hands it to the
   practice engine.

   The resolution rules are unchanged and deliberately strict:
     - the id is looked up EXACTLY as given, through the shared traversal
       (assets/js/manifest.js) the catalog also uses;
     - the entry's path must be a safe questions/-relative path;
     - the bank must contain a non-empty "questions" array.

   What this file adds around those rules is only the page's status layer:
   every way loading can fail ends in a real, readable state — a proper
   heading (never a permanent "Loading…"), a link back to the catalog, and
   a "Try again" button where trying again can actually help.
   ========================================================================== */
(function () {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var quizId = params.get("quiz");
  window.DynancaPracticeId = quizId || "unknown";

  var FETCH_TIMEOUT_MS = 30000;
  var CATALOG_RETURN_KEY = "dynanca-catalog-return-v1";

  /* ---------- Back to the catalog ----------
     The landing page stores its last search / filter / page query in
     sessionStorage (its own namespace), so "back" returns to the same
     catalog view. Only a plain query string is ever accepted from storage;
     anything else falls back to the catalog's default view. */
  function catalogHref() {
    var query = "";
    try {
      var stored = window.sessionStorage.getItem(CATALOG_RETURN_KEY);
      if (typeof stored === "string" && /^\?[A-Za-z0-9%&=._~!*'()+-]{0,600}$/.test(stored)) query = stored;
    } catch (err) {
      /* storage blocked: default catalog view */
    }
    return "../" + query + "#catalog";
  }

  function initBackLink() {
    var link = document.getElementById("backToCatalog");
    if (link) link.setAttribute("href", catalogHref());
  }
  initBackLink();

  /* ---------- Failure states ---------- */
  var FAILURES = {
    "no-quiz": {
      title: "No practice bank selected",
      lead: "This address does not name a practice bank.",
      body: "Open the catalog and choose a bank to start practising.",
      retry: false
    },
    "not-found": {
      title: "Practice bank not found",
      lead: "No bank in the catalog matches this address.",
      body: "The link may be mistyped or out of date. Every bank that can be opened is listed in the catalog.",
      retry: false
    },
    "unavailable": {
      title: "Not available in this release",
      lead: "This bank is listed in the catalog, but its questions are not included in this release.",
      body: "Nothing was lost: choose another bank from the catalog.",
      retry: false
    },
    "catalog-unreachable": {
      title: "Practice could not be loaded",
      lead: "The practice catalog could not be reached.",
      body: "The connection may be slow or interrupted. Check your internet connection, then try again.",
      retry: true
    },
    "bank-unreachable": {
      title: "Practice could not be loaded",
      lead: "This bank's questions could not be downloaded.",
      body: "The connection may be slow or interrupted. Check your internet connection, then try again.",
      retry: true
    },
    "bank-damaged": {
      title: "This practice bank could not be opened",
      lead: "Its question file arrived incomplete or damaged.",
      body: "Try again in a moment. If it keeps happening, choose another bank from the catalog.",
      retry: true
    },
    "bank-empty": {
      title: "This practice bank has no questions",
      lead: "There is nothing to practise in this bank yet.",
      body: "Choose another bank from the catalog.",
      retry: false
    },
    "misconfigured": {
      title: "This practice bank could not be opened",
      lead: "The bank is set up incorrectly on the site.",
      body: "Choose another bank from the catalog.",
      retry: false
    }
  };

  function setText(selector, text) {
    var node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function fail(kind, technicalMessage, bankName) {
    console.error("[Dynanca Practice]", technicalMessage);
    var info = FAILURES[kind] || FAILURES["catalog-unreachable"];

    // The hero stops saying "Loading…" and states what happened.
    document.title = info.title + " | Dynanca";
    setText(".hero__eyebrow", "DYNANCA");
    setText(".hero__title", info.title);
    setText(".hero__lead", bankName ? "“" + bankName + "” — " + info.lead : info.lead);

    // Progress controls have nothing to act on in a failed state.
    var reset = document.querySelector(".dynanca-reset-progress");
    if (reset) reset.hidden = true;

    var el = document.getElementById("practiceContainer");
    if (el) {
      el.textContent = "";
      el.setAttribute("data-practice-state", "error");
      el.setAttribute("data-error-kind", kind);

      var box = document.createElement("div");
      box.className = "practice-error practice-status";
      box.setAttribute("role", "alert");

      var heading = document.createElement("strong");
      heading.className = "practice-status__title";
      heading.textContent = info.title + ".";
      box.appendChild(heading);

      var body = document.createElement("p");
      body.className = "practice-status__text";
      body.textContent = info.body;
      box.appendChild(body);

      var actions = document.createElement("div");
      actions.className = "practice-status__actions";
      if (info.retry) {
        var retry = document.createElement("button");
        retry.type = "button";
        retry.className = "practice-status__retry";
        retry.textContent = "Try again";
        retry.addEventListener("click", function () {
          retry.disabled = true;
          retry.textContent = "Trying again…";
          // A clean reload re-runs the whole boot sequence (state, engine,
          // MathJax queue) exactly as a first visit would.
          window.location.reload();
        });
        actions.appendChild(retry);
      }
      var back = document.createElement("a");
      back.className = "practice-status__link";
      back.href = catalogHref();
      back.textContent = "Back to the catalog";
      actions.appendChild(back);
      box.appendChild(actions);

      el.appendChild(box);
    }

    var error = new Error(technicalMessage);
    error.dynancaKind = kind;
    throw error;
  }

  /* ---------- Fetch with a real deadline ---------- */
  function fetchWithTimeout(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var options = { cache: "no-cache", credentials: "same-origin" };
    if (controller) options.signal = controller.signal;
    var timer = null;
    var deadline = new Promise(function (resolve, reject) {
      timer = window.setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error("timed out after " + FETCH_TIMEOUT_MS + " ms"));
      }, FETCH_TIMEOUT_MS);
    });
    function done() { window.clearTimeout(timer); }
    var request = fetch(url, options).then(function (res) {
      // The body is read inside the deadline too, so a stalled download
      // cannot hang the page after the headers arrived.
      return res.text().then(function (text) {
        return { ok: res.ok, status: res.status, type: res.headers.get("content-type") || "", text: text };
      });
    });
    return Promise.race([request, deadline]).then(
      function (value) { done(); return value; },
      function (err) { done(); throw err; }
    );
  }

  window.DynancaPracticeReady = (async function () {
    if (!quizId) {
      fail("no-quiz", "No ?quiz= id in the URL.");
    }

    var manifestRes = null;
    var manifestProblem = null;
    try {
      manifestRes = await fetchWithTimeout("../master-manifest.json");
    } catch (err) {
      manifestProblem = err.message;
    }
    if (!manifestRes || !manifestRes.ok) {
      fail("catalog-unreachable", "Could not load master-manifest.json: " + (manifestProblem || "HTTP " + manifestRes.status));
    }
    var manifest = null;
    try {
      manifest = JSON.parse(manifestRes.text);
    } catch (err) {
      fail("catalog-unreachable", "master-manifest.json is not valid JSON: " + err.message);
    }
    if (!manifest || !Array.isArray(manifest.subjects)) {
      fail("catalog-unreachable", "master-manifest.json is malformed (missing subjects array).");
    }

    // Shared canonical traversal (assets/js/manifest.js) — the exact same
    // lookup the homepage catalog uses, so a card's link id always
    // resolves the same way here as it did when the card was rendered.
    var entry = window.DynancaManifest.findPracticeFile(manifest.subjects, quizId);
    if (!entry) {
      fail("not-found", 'Quiz "' + quizId + '" is not registered in master-manifest.json.');
    }
    if (!window.DynancaManifest.isSafeRelativePath(entry.path)) {
      fail("misconfigured", 'Manifest path "' + entry.path + '" for "' + quizId + '" is not a safe questions/-relative path.', entry.name);
    }

    var dataRes = null;
    var dataProblem = null;
    try {
      dataRes = await fetchWithTimeout("../" + entry.path.split("/").map(encodeURIComponent).join("/"));
    } catch (err) {
      dataProblem = err.message;
    }
    if (!dataRes) {
      fail("bank-unreachable", "Could not load quiz JSON at " + entry.path + ": " + dataProblem, entry.name);
    }
    if (dataRes.status === 404 || dataRes.status === 410) {
      // Listed in the manifest, file not shipped in this build.
      fail("unavailable", "Quiz JSON at " + entry.path + " is not included in this release (HTTP " + dataRes.status + ").", entry.name);
    }
    if (!dataRes.ok) {
      fail("bank-unreachable", "Could not load quiz JSON at " + entry.path + ": HTTP " + dataRes.status, entry.name);
    }
    var data = null;
    try {
      data = JSON.parse(dataRes.text);
    } catch (err) {
      // Some static hosts answer unknown paths with an HTML page and
      // HTTP 200 instead of a 404: that is still "not shipped".
      if (/text\/html/i.test(dataRes.type)) {
        fail("unavailable", "Quiz JSON at " + entry.path + " was answered with an HTML page, not a question file.", entry.name);
      }
      fail("bank-damaged", "Quiz JSON at " + entry.path + " is not valid JSON: " + err.message, entry.name);
    }
    if (!data || !Array.isArray(data.questions) || !data.questions.length) {
      fail("bank-empty", "Quiz JSON at " + entry.path + " has no valid questions array.", entry.name);
    }
    var bankProblem = window.PracticeEngine.validateBank(data);
    if (bankProblem) fail("bank-damaged", "Invalid bank at " + entry.path + ": " + bankProblem, entry.name);

    window.DynancaPracticeMeta = data;
    window.PRACTICES = data.questions;
    document.title = (data.title || entry.name || "Practice") + " | Dynanca";
    var eyebrow = document.querySelector(".hero__eyebrow");
    var title = document.querySelector(".hero__title");
    var lead = document.querySelector(".hero__lead");
    if (eyebrow) eyebrow.textContent = data.category || "DYNANCA";
    if (title) title.textContent = data.title || entry.name || "Practice";
    if (lead) lead.textContent = data.description || "";
    return data;
  })();

  // The failure is already shown on the page and logged above; this only
  // keeps the browser from additionally reporting an "unhandled rejection".
  // Consumers that chain on DynancaPracticeReady still see the rejection.
  window.DynancaPracticeReady.catch(function () {});
})();
