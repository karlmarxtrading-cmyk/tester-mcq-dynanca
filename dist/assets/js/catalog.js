/* ==========================================================================
   DYNANCA — landing page catalog controller
   -------------------------------------------------------------------------
   UI layer for index.html. It:

     - fetches exactly two small static files (master-manifest.json and
       assets/data/bank-index.json) — never a question bank, never a probe
       per bank, never MathJax or the practice engine;
     - builds the read-only view model (assets/js/catalog-model.js);
     - renders at most one page of cards (24) at a time;
     - keeps search / filters / page in the URL, so Back, Forward, reload,
       "open in new tab" and returning from a practice page all restore
       the same view.

   Storage:
     - READS  localStorage "dynanca-mcq-<id>-v2" (attempt records written
              by practice/practice-state.js) to show saved progress.
              It never writes, migrates or removes those keys.
     - WRITES only its own sessionStorage keys, in a separate namespace:
              "dynanca-catalog-return-v1"  last catalog query (read by the
                                           practice page's back link)
              "dynanca-catalog-scroll-v1"  scroll position for Back/Forward
     Every storage access is wrapped; a blocked or corrupt store never
     breaks the page.

   All catalog text is written with textContent / DOM APIs — manifest
   strings are never parsed as HTML.
   ========================================================================== */
(function () {
  "use strict";

  var Model = window.DynancaCatalogModel;
  var Traversal = window.DynancaManifest;
  var doc = document;
  var root = doc.documentElement;

  var MANIFEST_URL = "master-manifest.json";
  var INDEX_URL = "assets/data/bank-index.json";
  var LOAD_TIMEOUT_MS = 15000;
  var SEARCH_DEBOUNCE_MS = 140;
  var CONTINUE_LIMIT = 3;
  var RETURN_KEY = "dynanca-catalog-return-v1";
  var SCROLL_KEY = "dynanca-catalog-scroll-v1";

  function $(id) { return doc.getElementById(id); }

  var els = {
    head: $("siteHead"),
    facts: $("facts"),
    continueSection: $("continue"),
    continueList: $("continueList"),
    collectionsSection: doc.querySelector(".collections"),
    collectionGrid: $("collectionGrid"),
    catalog: $("catalog"),
    scope: $("catalogScope"),
    form: $("filters"),
    q: $("q"),
    qClear: $("qClear"),
    collection: $("collection"),
    topicField: $("topicField"),
    topic: $("topic"),
    showAvailable: $("showAvailable"),
    showAll: $("showAll"),
    countAvailable: $("countAvailable"),
    countAll: $("countAll"),
    summary: $("resultSummary"),
    resultsBar: doc.querySelector(".results-bar"),
    reset: $("resetFilters"),
    note: $("resultsNote"),
    panel: $("catalogPanel"),
    grid: $("bankGrid"),
    pager: $("pager")
  };

  if (!els.grid || !els.summary || !els.q) return; // not the landing page

  var catalog = null;
  var state = null;
  var progressById = Object.create(null);
  var recentProgress = [];
  var loadToken = 0;
  var activeController = null;
  var searchTimer = null;

  /* ---------- Small helpers ---------- */

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function formatNumber(n) {
    try { return Number(n).toLocaleString("en-US"); } catch (err) { return String(n); }
  }

  function plural(n, one, many) {
    return formatNumber(n) + " " + (n === 1 ? one : many);
  }

  function formatDate(timestamp) {
    try {
      return new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (err) {
      return "";
    }
  }

  function getLocalStorage() {
    try { return window.localStorage; } catch (err) { return null; }
  }

  function sessionGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (err) { return null; }
  }

  function sessionSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (err) { /* storage refused: ignore */ }
  }

  function setControlsDisabled(disabled) {
    [els.q, els.collection, els.topic, els.showAvailable, els.showAll].forEach(function (control) {
      if (control) control.disabled = disabled;
    });
  }

  /* ---------- Sticky header offset ---------- */

  function publishHeaderHeight() {
    if (!els.head) return;
    var sticky = window.getComputedStyle(els.head).position === "sticky";
    var h = sticky ? Math.ceil(els.head.getBoundingClientRect().height) : 0;
    root.style.setProperty("--catalog-header-h", h + "px");
  }

  function initHeaderOffset() {
    publishHeaderHeight();
    if (typeof ResizeObserver === "function" && els.head) {
      new ResizeObserver(publishHeaderHeight).observe(els.head);
    }
    window.addEventListener("resize", publishHeaderHeight);
  }

  /* ---------- Loading ---------- */

  function failure(kind, detail) {
    var err = new Error(detail || kind);
    err.kind = kind;
    return err;
  }

  function fetchJson(url, signal) {
    var options = { cache: "no-cache", credentials: "same-origin" };
    if (signal) options.signal = signal;
    return fetch(url, options).then(function (res) {
      if (!res.ok) throw failure("http", url + " responded with HTTP " + res.status);
      return res.text();
    }, function (err) {
      throw failure("network", url + " could not be fetched: " + (err && err.message));
    }).then(function (text) {
      try {
        return JSON.parse(text);
      } catch (err) {
        throw failure("parse", url + " is not valid JSON: " + err.message);
      }
    });
  }

  function load() {
    var token = ++loadToken;
    if (activeController) {
      try { activeController.abort(); } catch (err) { /* ignore */ }
    }
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    activeController = controller;
    var timedOut = false;
    var settled = false;

    showLoading();

    var timer = window.setTimeout(function () {
      timedOut = true;
      if (controller) controller.abort();
      else finish(failure("timeout", "Loading the catalog exceeded " + LOAD_TIMEOUT_MS + " ms."));
    }, LOAD_TIMEOUT_MS);

    function finish(err, built) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      // A newer load() (retry) owns the page now: drop this result.
      if (token !== loadToken) return;
      activeController = null;
      if (err) showLoadError(timedOut ? failure("timeout", err.message) : err);
      else showCatalog(built);
    }

    var signal = controller ? controller.signal : undefined;
    Promise.all([fetchJson(MANIFEST_URL, signal), fetchJson(INDEX_URL, signal)])
      .then(function (results) {
        return Model.buildCatalog(results[0], results[1], Traversal);
      })
      .then(function (built) { finish(null, built); }, function (err) { finish(err); });
  }

  /** Search/filter form + result line: shown while loading and when ready,
      removed in the failed / empty-catalog states where they cannot act. */
  function setCatalogToolsHidden(hidden) {
    els.form.hidden = hidden;
    if (els.resultsBar) els.resultsBar.hidden = hidden;
  }

  function showLoading() {
    catalog = null;
    setControlsDisabled(true);
    setCatalogToolsHidden(false);
    clear(els.panel);
    els.summary.textContent = "Loading the practice catalog…";
    els.reset.hidden = true;
    els.note.hidden = true;
    els.pager.hidden = true;
    clear(els.pager);
    clear(els.grid);
    for (var i = 0; i < 6; i++) {
      var sk = el("li", "skeleton skeleton--bank");
      sk.setAttribute("aria-hidden", "true");
      els.grid.appendChild(sk);
    }
    els.grid.setAttribute("aria-busy", "true");
  }

  function clearDataSections() {
    clear(els.grid);
    els.grid.removeAttribute("aria-busy");
    clear(els.pager);
    els.pager.hidden = true;
    els.note.hidden = true;
    els.reset.hidden = true;
    clear(els.facts);
    els.scope.textContent = "";
    if (els.collectionsSection) els.collectionsSection.hidden = true;
    if (els.continueSection) els.continueSection.hidden = true;
  }

  function buildPanel(kind, title, text) {
    var panel = el("div", "panel" + (kind ? " panel--" + kind : ""));
    panel.appendChild(el("h3", "panel__title", title));
    if (text) panel.appendChild(el("p", "panel__text", text));
    var actions = el("div", "panel__actions");
    panel.appendChild(actions);
    panel.actions = actions;
    return panel;
  }

  function addAction(panel, label, className, handler) {
    var button = el("button", "btn " + className, label);
    button.type = "button";
    button.addEventListener("click", handler);
    panel.actions.appendChild(button);
    return button;
  }

  function showLoadError(err) {
    // Technical detail is for maintainers; the page itself stays human.
    console.error("[Dynanca Catalog] " + (err && err.kind ? err.kind + ": " : "") + (err && err.message ? err.message : err));
    clearDataSections();
    setControlsDisabled(true);

    var kind = err && (err.kind || err.code);
    var title = "The practice catalog could not be loaded";
    var text = "Check your internet connection, then try again.";
    if (kind === "timeout") {
      title = "The practice catalog is taking too long to load";
      text = "The connection may be slow or interrupted. Try again in a moment.";
    } else if (kind === "parse" || kind === "malformed-manifest" || kind === "malformed-index" || kind === "missing-traversal") {
      title = "The practice catalog did not load correctly";
      text = "The catalog data arrived incomplete or damaged. Try again in a moment; if it keeps happening, the site may be in the middle of an update.";
    }

    // The alert below is the announcement; the (now hidden) result line is
    // cleared so nothing is announced twice.
    els.summary.textContent = "";
    setCatalogToolsHidden(true);
    var panel = buildPanel("error", title, text);
    panel.setAttribute("role", "alert");
    addAction(panel, "Try again", "btn--primary", function () {
      load();
      focusWithoutScroll(els.summary);
    });
    clear(els.panel);
    els.panel.appendChild(panel);
  }

  function showEmptyCatalog() {
    clearDataSections();
    setControlsDisabled(true);
    var title = "No practice banks are listed yet";
    els.summary.textContent = "";
    setCatalogToolsHidden(true);
    var panel = buildPanel("", title, "The catalog is empty at the moment, so there is nothing to open.");
    panel.setAttribute("role", "status");
    addAction(panel, "Check again", "btn--ghost", function () {
      load();
      focusWithoutScroll(els.summary);
    });
    clear(els.panel);
    els.panel.appendChild(panel);
  }

  /* ---------- First render after a successful load ---------- */

  function showCatalog(built) {
    catalog = built;
    if (catalog.indexMismatch) {
      console.warn(
        "[Dynanca Catalog] assets/data/bank-index.json does not match master-manifest.json " +
          "(run `npm run build:index`):", catalog.indexMismatch
      );
    }
    if (!catalog.entries.length) {
      showEmptyCatalog();
      return;
    }

    clear(els.panel);
    els.grid.removeAttribute("aria-busy");
    setCatalogToolsHidden(false);
    if (els.collectionsSection) els.collectionsSection.hidden = false;

    readProgress();
    state = Model.normalizeState(Model.parseQuery(window.location.search), catalog);

    renderFacts();
    renderContinue();
    renderCollectionOptions();
    setControlsDisabled(false);
    renderResults();
    syncUrl("replace", true);
    restoreViewport();
  }

  function readProgress() {
    progressById = Object.create(null);
    recentProgress = [];
    var all = Model.readSavedProgress(getLocalStorage(), catalog);
    all.forEach(function (item) {
      var entry = catalog.byId[item.id];
      if (!entry || !entry.available) return;
      progressById[item.id] = item;
      recentProgress.push(item);
    });
  }

  function renderFacts() {
    clear(els.facts);
    var totals = catalog.totals;
    [
      [formatNumber(totals.available), totals.available === 1 ? "bank ready to open" : "banks ready to open"],
      [formatNumber(totals.verifiedQuestions), "questions in those banks"],
      [formatNumber(totals.collections), totals.collections === 1 ? "collection" : "collections"]
    ].forEach(function (fact) {
      var item = el("div", "facts__item");
      item.appendChild(el("dt", "", fact[1]));
      item.appendChild(el("dd", "", fact[0]));
      els.facts.appendChild(item);
    });

    if (totals.available === totals.listed) {
      els.scope.textContent = "All " + plural(totals.listed, "listed bank is", "listed banks are") + " available.";
    } else {
      els.scope.textContent =
        formatNumber(totals.available) + " of " + plural(totals.listed, "listed bank is", "listed banks are") +
        " available in this release.";
    }
    els.countAvailable.textContent = formatNumber(totals.available);
    els.countAll.textContent = formatNumber(totals.listed);
  }

  /* ---------- Cards ---------- */

  function contextLabel(entry) {
    return [entry.collectionName].concat(entry.topicNames).join(" › ");
  }

  function buildBankCard(entry, options) {
    var showStatusBadge = options && options.showStatusBadge;
    var saved = entry.available ? progressById[entry.id] : null;

    var card = el("li", "bank " + (entry.available ? "bank--available" : "bank--unavailable"));
    card.setAttribute("data-bank-id", entry.id);
    card.setAttribute("data-available", entry.available ? "true" : "false");

    card.appendChild(el("p", "bank__context", contextLabel(entry)));

    var title = el("h3", "bank__title");
    if (entry.available) {
      var link = el("a", "bank__link", entry.name);
      link.href = Model.practiceHref(entry.id);
      title.appendChild(link);
    } else {
      // No anchor at all: nothing to tab to, open in a new tab, or copy.
      title.textContent = entry.name;
    }
    card.appendChild(title);

    if (entry.id) {
      var id = el("p", "bank__id");
      id.appendChild(el("span", "u-visually-hidden", "Bank ID: "));
      id.appendChild(doc.createTextNode(entry.id));
      card.appendChild(id);
    }

    var meta = el("p", "bank__meta");
    if (entry.available) {
      meta.appendChild(el("span", "bank__count", plural(entry.verifiedCount, "question", "questions")));
      if (showStatusBadge) meta.appendChild(el("span", "badge badge--ok", "Available"));
    } else {
      if (entry.listedCount != null) {
        meta.appendChild(el("span", "bank__count", plural(entry.listedCount, "question", "questions") + " listed"));
      }
      meta.appendChild(el("span", "badge badge--off", "Not available in this release"));
    }
    card.appendChild(meta);

    if (saved) {
      var text = plural(saved.answers, "answer", "answers") + " saved in this browser";
      if (options && options.showLastAnswered && saved.lastAnsweredAt) {
        var when = formatDate(saved.lastAnsweredAt);
        if (when) text += " · last answered " + when;
      }
      card.appendChild(el("p", "bank__progress", text));
    }

    if (entry.available) {
      var cta = el("span", "bank__cta", (saved ? "Continue practice" : "Start practice") + " →");
      cta.setAttribute("aria-hidden", "true");
      card.appendChild(cta);
    }
    return card;
  }

  function renderContinue() {
    if (!els.continueSection) return;
    clear(els.continueList);
    var items = recentProgress.slice(0, CONTINUE_LIMIT);
    if (!items.length) {
      els.continueSection.hidden = true;
      return;
    }
    items.forEach(function (item) {
      els.continueList.appendChild(buildBankCard(catalog.byId[item.id], { showLastAnswered: true }));
    });
    els.continueSection.hidden = false;
  }

  /* ---------- Collections + filter controls ---------- */

  function collectionHref(key) {
    return Model.toQuery({ q: "", collection: key, topic: "", show: state.show, page: 1 }) + "#catalog";
  }

  function renderCollections() {
    clear(els.collectionGrid);
    catalog.collections.forEach(function (collection) {
      var li = el("li");
      var link = el("a", "collection-card");
      link.href = collectionHref(collection.key);
      link.setAttribute("data-collection", collection.key);
      var selected = state.collection === collection.key;
      if (selected) link.setAttribute("aria-current", "true");

      link.appendChild(el("h3", "collection-card__name", collection.name));

      var countText = collection.available === collection.total
        ? plural(collection.total, "bank", "banks") + " available"
        : formatNumber(collection.available) + " of " + plural(collection.total, "bank", "banks") + " available";
      link.appendChild(el("span", "collection-card__count", countText));

      var detail = [];
      if (collection.verifiedQuestions > 0) detail.push(plural(collection.verifiedQuestions, "question", "questions"));
      var topLevelTopics = collection.topics.filter(function (t) { return t.depth === 1; }).length;
      if (topLevelTopics > 0) detail.push(plural(topLevelTopics, "topic", "topics"));
      if (detail.length) link.appendChild(el("span", "collection-card__detail", detail.join(" · ")));

      var stateLabel = el("span", "collection-card__state", selected ? "Showing in catalog" : "Browse →");
      link.appendChild(stateLabel);

      li.appendChild(link);
      els.collectionGrid.appendChild(li);
    });
  }

  function countFor(node) {
    return state.show === Model.SHOW_ALL ? node.total : node.available;
  }

  function addOption(select, value, label) {
    var option = el("option", "", label);
    option.value = value;
    select.appendChild(option);
    return option;
  }

  function renderCollectionOptions() {
    clear(els.collection);
    var allCount = state.show === Model.SHOW_ALL ? catalog.totals.listed : catalog.totals.available;
    addOption(els.collection, "", "All collections (" + formatNumber(allCount) + ")");
    catalog.collections.forEach(function (collection) {
      addOption(els.collection, collection.key, collection.name + " (" + formatNumber(countFor(collection)) + ")");
    });
    els.collection.value = state.collection;
    renderTopicOptions();
  }

  function renderTopicOptions() {
    clear(els.topic);
    var collection = state.collection ? catalog.collectionByKey[state.collection] : null;
    // A flat collection has no topics in the manifest, so no topic control
    // is shown for it — the UI never invents a hierarchy the data lacks.
    if (!collection || !collection.topics.length) {
      els.topicField.hidden = true;
      return;
    }
    addOption(els.topic, "", "All topics (" + formatNumber(countFor(collection)) + ")");
    if (collection.directTotal > 0) {
      var direct = state.show === Model.SHOW_ALL ? collection.directTotal : collection.directAvailable;
      addOption(els.topic, Model.TOPIC_DIRECT, "Not in a topic (" + formatNumber(direct) + ")");
    }
    collection.topics.forEach(function (topic) {
      var indent = topic.depth > 1 ? new Array(topic.depth).join("— ") : "";
      addOption(els.topic, topic.path, indent + topic.name + " (" + formatNumber(countFor(topic)) + ")");
    });
    els.topic.value = state.topic;
    els.topicField.hidden = false;
  }

  /* ---------- Results ---------- */

  function scopeLabel() {
    if (!state.collection) return "";
    var collection = catalog.collectionByKey[state.collection];
    var label = collection.name;
    if (state.topic === Model.TOPIC_DIRECT) label += " (not in a topic)";
    else if (state.topic && collection.topicByPath[state.topic]) label += " › " + collection.topicByPath[state.topic].label;
    return label;
  }

  function filtersAreDefault() {
    return !state.q && !state.collection && !state.topic && state.show === Model.SHOW_AVAILABLE;
  }

  function summaryText(result, pageInfo) {
    var onlyAvailable = state.show === Model.SHOW_AVAILABLE;
    var scope = scopeLabel();
    var tail = "";
    if (state.q) tail += " matching “" + state.q + "”";
    if (scope) tail += " in " + scope;

    if (!pageInfo.total) {
      return "No " + (onlyAvailable ? "available " : "") + "banks" + (tail || " to show") + ".";
    }
    var noun = (onlyAvailable ? "available " : "") + (pageInfo.total === 1 ? "bank" : "banks");
    var range = pageInfo.total === 1
      ? "Showing 1 " + noun
      : "Showing " + formatNumber(pageInfo.from) + "–" + formatNumber(pageInfo.to) + " of " + formatNumber(pageInfo.total) + " " + noun;
    var extra = "";
    if (!onlyAvailable && result.matchedUnavailable > 0) {
      extra = " (" + formatNumber(result.matchedAvailable) + " available, " +
        formatNumber(result.matchedUnavailable) + " not available in this release)";
    }
    return range + tail + extra + ".";
  }

  function showAllBanks() {
    state.show = Model.SHOW_ALL;
    state.page = 1;
    renderCollectionOptions();
    renderResults();
    syncUrl("push");
    focusWithoutScroll(els.summary);
  }

  function resetFilters(focusTarget) {
    state = Model.defaultState();
    window.clearTimeout(searchTimer);
    renderCollectionOptions();
    renderResults();
    syncUrl("push");
    if (focusTarget) focusWithoutScroll(focusTarget);
  }

  function clearSearch() {
    window.clearTimeout(searchTimer);
    state.q = "";
    state.page = 1;
    els.q.value = "";
    renderResults();
    syncUrl("replace");
    els.q.focus();
  }

  function renderEmpty(result) {
    var onlyAvailable = state.show === Model.SHOW_AVAILABLE;
    var hiddenMatches = onlyAvailable ? result.matchedUnavailable : 0;
    var title = hiddenMatches > 0 ? "No available banks match" : "No banks match";
    var text;
    if (hiddenMatches > 0) {
      text = plural(hiddenMatches, "bank matches", "banks match") +
        " your search and filters, but " + (hiddenMatches === 1 ? "it is" : "they are") +
        " not available in this release. You can still see what is listed.";
    } else if (state.q) {
      text = "Nothing in the catalog matches “" + state.q + "”" +
        (scopeLabel() ? " in " + scopeLabel() : "") +
        ". Search looks at bank names, IDs, collections and topics — not at the question text. Try a shorter or different word.";
    } else {
      text = "There are no banks for this combination of filters.";
    }
    var panel = buildPanel("", title, text);
    if (hiddenMatches > 0) addAction(panel, "Show all banks", "btn--primary", showAllBanks);
    if (state.q) addAction(panel, "Clear search", "btn--ghost", clearSearch);
    if (state.collection || state.topic || (state.q && state.show === Model.SHOW_ALL)) {
      addAction(panel, "Reset filters", "btn--ghost", function () { resetFilters(els.q); });
    }
    els.panel.appendChild(panel);
  }

  function renderNote(result) {
    clear(els.note);
    var hidden = state.show === Model.SHOW_AVAILABLE ? result.matchedUnavailable : 0;
    if (!hidden || !result.items.length) {
      els.note.hidden = true;
      return;
    }
    var matching = filtersAreDefault() ? "" : "matching ";
    els.note.appendChild(el(
      "span", "",
      plural(hidden, "more " + matching + "bank is", "more " + matching + "banks are") +
        " listed but not available in this release."
    ));
    var button = el("button", "btn btn--text", "Show all banks");
    button.type = "button";
    button.addEventListener("click", showAllBanks);
    els.note.appendChild(button);
    els.note.hidden = false;
  }

  function pageHref(page) {
    return Model.toQuery({ q: state.q, collection: state.collection, topic: state.topic, show: state.show, page: page }) || "./";
  }

  function renderPager(pageInfo) {
    clear(els.pager);
    if (pageInfo.pageCount <= 1) {
      els.pager.hidden = true;
      return;
    }

    function step(label, page, enabled, rel) {
      var node;
      if (enabled) {
        node = el("a", "pager__step", label);
        node.href = pageHref(page);
        node.setAttribute("data-page", String(page));
        node.setAttribute("rel", rel);
      } else {
        // Not a link at all at the ends of the range: nothing to activate.
        node = el("span", "pager__step pager__step--disabled", label);
        node.setAttribute("aria-disabled", "true");
      }
      return node;
    }

    els.pager.appendChild(step("← Previous", pageInfo.page - 1, pageInfo.page > 1, "prev"));

    var list = el("ol", "pager__list");
    Model.pageWindow(pageInfo.page, pageInfo.pageCount).forEach(function (item) {
      var li = el("li");
      if (item === "gap") {
        var gap = el("span", "pager__gap", "…");
        gap.setAttribute("aria-hidden", "true");
        li.appendChild(gap);
      } else {
        var link = el("a", "pager__link", formatNumber(item));
        link.href = pageHref(item);
        link.setAttribute("data-page", String(item));
        link.setAttribute("aria-label", "Page " + formatNumber(item));
        if (item === pageInfo.page) link.setAttribute("aria-current", "page");
        li.appendChild(link);
      }
      list.appendChild(li);
    });
    els.pager.appendChild(list);

    els.pager.appendChild(el(
      "span", "pager__status",
      "Page " + formatNumber(pageInfo.page) + " of " + formatNumber(pageInfo.pageCount)
    ));
    els.pager.appendChild(step("Next →", pageInfo.page + 1, pageInfo.page < pageInfo.pageCount, "next"));
    els.pager.hidden = false;
  }

  function syncControls() {
    // Never fight the caret while the person is typing: only rewrite the
    // box when its meaning differs from the state (Back/Forward, reset).
    if (Model.normalizeState({ q: els.q.value }, catalog).q !== state.q) els.q.value = state.q;
    els.qClear.hidden = els.q.value === "";
    if (els.collection.value !== state.collection) els.collection.value = state.collection;
    if (!els.topicField.hidden && els.topic.value !== state.topic) els.topic.value = state.topic;
    els.showAvailable.checked = state.show === Model.SHOW_AVAILABLE;
    els.showAll.checked = state.show === Model.SHOW_ALL;
    els.reset.hidden = filtersAreDefault();
  }

  function renderResults() {
    var result = Model.filterEntries(catalog, state);
    var pageInfo = Model.paginate(result.items, state.page, Model.PAGE_SIZE);
    state.page = pageInfo.page; // clamp: a filter change can never leave an out-of-range page

    clear(els.panel);
    clear(els.grid);
    var fragment = doc.createDocumentFragment();
    var badge = state.show === Model.SHOW_ALL;
    pageInfo.items.forEach(function (entry) {
      fragment.appendChild(buildBankCard(entry, { showStatusBadge: badge }));
    });
    els.grid.appendChild(fragment);
    els.grid.hidden = pageInfo.total === 0;

    if (!pageInfo.total) renderEmpty(result);
    renderNote(result);
    renderPager(pageInfo);
    renderCollections();
    syncControls();
    els.summary.textContent = summaryText(result, pageInfo);
  }

  /* ---------- URL / history ---------- */

  function syncUrl(mode, keepHash) {
    var query = Model.toQuery(state);
    var url = window.location.pathname + query + (keepHash ? window.location.hash : "");
    try {
      if (mode === "push") {
        // A real history entry per filter / page change, so Back steps
        // through them; skipped when nothing in the query changed.
        if (query !== window.location.search) window.history.pushState({ dynancaCatalog: true }, "", url);
      } else if (query !== window.location.search || (!keepHash && window.location.hash)) {
        window.history.replaceState({ dynancaCatalog: true }, "", url);
      }
    } catch (err) {
      /* history unavailable (sandboxed frame): the view still works */
    }
    sessionSet(RETURN_KEY, query);
  }

  /**
   * The single path for every user-driven change of search / filter / page.
   * @param {Function} mutate edits `state` in place
   * @param {"push"|"replace"} [mode] history behaviour (default "push")
   * @param {boolean} [refreshOptions] rebuild the collection/topic selects
   *        (needed when the collection or the availability mode changed)
   */
  function applyStateChange(mutate, mode, refreshOptions) {
    if (!catalog) return;
    mutate();
    state = Model.normalizeState(state, catalog);
    if (refreshOptions) renderCollectionOptions();
    renderResults();
    syncUrl(mode || "push");
  }

  /* ---------- Focus / scroll ---------- */

  function focusWithoutScroll(node) {
    if (!node) return;
    try { node.focus({ preventScroll: true }); } catch (err) { node.focus(); }
  }

  function revealCatalog() {
    if (!els.catalog) return;
    els.catalog.scrollIntoView();
    focusWithoutScroll(els.summary);
  }

  function saveScroll() {
    sessionSet(SCROLL_KEY, JSON.stringify({ search: window.location.search, y: Math.round(window.scrollY || 0) }));
  }

  function navigationType() {
    try {
      var entries = window.performance.getEntriesByType("navigation");
      return entries && entries[0] ? entries[0].type : "";
    } catch (err) {
      return "";
    }
  }

  function restoreViewport() {
    var type = navigationType();
    if (type === "back_forward" || type === "reload") {
      var saved = null;
      try { saved = JSON.parse(sessionGet(SCROLL_KEY)); } catch (err) { saved = null; }
      if (saved && saved.search === window.location.search && typeof saved.y === "number" && saved.y > 0) {
        try { window.scrollTo({ top: saved.y, left: 0, behavior: "instant" }); }
        catch (err) { window.scrollTo(0, saved.y); }
        return;
      }
    }
    // Arrived on "#catalog" (collection link, practice back link): the
    // content above has just been filled in, so line the target up again.
    var hash = window.location.hash;
    if (hash && hash.length > 1) {
      var target = null;
      try { target = doc.getElementById(decodeURIComponent(hash.slice(1))); } catch (err) { target = null; }
      if (target) {
        try { target.scrollIntoView({ behavior: "instant", block: "start" }); }
        catch (err) { target.scrollIntoView(); }
      }
    }
  }

  /* ---------- Events ---------- */

  function isPlainActivation(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented;
  }

  els.form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!catalog) return;
    window.clearTimeout(searchTimer);
    applyStateChange(function () { state.q = els.q.value; state.page = 1; }, "replace");
  });

  els.q.addEventListener("input", function () {
    els.qClear.hidden = els.q.value === "";
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      applyStateChange(function () { state.q = els.q.value; state.page = 1; }, "replace");
    }, SEARCH_DEBOUNCE_MS);
  });

  els.q.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && els.q.value !== "") {
      event.preventDefault();
      clearSearch();
    }
  });

  els.qClear.addEventListener("click", function () {
    if (catalog) clearSearch();
  });

  els.collection.addEventListener("change", function () {
    applyStateChange(function () {
      state.collection = els.collection.value;
      state.topic = "";
      state.page = 1;
    }, "push", true);
  });

  els.topic.addEventListener("change", function () {
    applyStateChange(function () { state.topic = els.topic.value; state.page = 1; });
  });

  [els.showAvailable, els.showAll].forEach(function (radio) {
    radio.addEventListener("change", function () {
      if (!radio.checked) return;
      applyStateChange(function () { state.show = radio.value; state.page = 1; }, "push", true);
    });
  });

  els.reset.addEventListener("click", function () {
    if (catalog) resetFilters(els.q);
  });

  // Collection cards are real links (?collection=…#catalog). A plain click
  // is handled in place; modified clicks / new tabs use the real href.
  els.collectionGrid.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a[data-collection]") : null;
    if (!link || !catalog || !isPlainActivation(event)) return;
    event.preventDefault();
    var key = link.getAttribute("data-collection");
    applyStateChange(function () {
      state.q = "";
      state.collection = key;
      state.topic = "";
      state.page = 1;
    }, "push", true);
    revealCatalog();
  });

  els.pager.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a[data-page]") : null;
    if (!link || !catalog || !isPlainActivation(event)) return;
    event.preventDefault();
    var page = parseInt(link.getAttribute("data-page"), 10);
    applyStateChange(function () { state.page = page; });
    revealCatalog();
  });

  // Leaving for a practice page: remember where the catalog was.
  doc.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a.bank__link") : null;
    if (link) saveScroll();
  });
  window.addEventListener("pagehide", saveScroll);

  window.addEventListener("popstate", function () {
    if (!catalog) return;
    window.clearTimeout(searchTimer);
    state = Model.normalizeState(Model.parseQuery(window.location.search), catalog);
    renderCollectionOptions();
    renderResults();
    sessionSet(RETURN_KEY, Model.toQuery(state));
  });

  // Returning through the back/forward cache: progress may have changed.
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted || !catalog) return;
    readProgress();
    renderContinue();
    renderResults();
  });

  /* ---------- Start ---------- */
  initHeaderOffset();
  if (!Model || !Traversal || typeof window.fetch !== "function") {
    showLoadError(failure("missing-traversal", "A required script did not load (catalog-model.js / manifest.js / fetch)."));
    return;
  }
  load();
})();
