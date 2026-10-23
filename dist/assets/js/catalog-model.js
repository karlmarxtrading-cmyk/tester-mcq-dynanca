/* ==========================================================================
   DYNANCA — catalog view model (read-only, no DOM)
   -------------------------------------------------------------------------
   Turns the two static inputs of the landing page

     master-manifest.json            what the catalog LISTS (final contract)
     assets/data/bank-index.json     what this build can actually OPEN

   into a flat, searchable list for the UI. Nothing here ever mutates the
   manifest object, the index object, or browser storage.

   The manifest is walked ONLY through the shared traversal in
   assets/js/manifest.js (DynancaManifest.eachNode / eachPracticeFile), so
   direct subject-level files, nested topics, nested subtopics and mixed
   nodes (files AND children) are all handled by the same generic code and
   no collection or topic name is ever special-cased.

   Works in the browser (window.DynancaCatalogModel) and under Node
   (module.exports) so tools/tests can exercise the exact code that ships.
   ========================================================================== */
(function (global) {
  "use strict";

  var PAGE_SIZE = 24;
  var SHOW_AVAILABLE = "available";
  var SHOW_ALL = "all";
  /** Topic filter value for "files that sit directly on a collection that also has topics". */
  var TOPIC_DIRECT = ".";

  function CatalogDataError(code, message) {
    var err = new Error(message);
    err.name = "CatalogDataError";
    err.code = code;
    return err;
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  /** Lower-case, trim and strip diacritics so "Álgebra" matches "algebra". */
  function normalizeText(value) {
    var s = String(value == null ? "" : value).toLowerCase();
    if (typeof s.normalize === "function") {
      s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    }
    return s.replace(/\s+/g, " ").trim();
  }

  function displayName(node, fallback) {
    var name = node && node.name != null ? String(node.name).trim() : "";
    if (name) return name;
    var id = node && node.id != null ? String(node.id).trim() : "";
    return id || fallback;
  }

  /**
   * Build the catalog from a manifest and an availability index.
   * @param {object} manifest parsed master-manifest.json
   * @param {object} index parsed assets/data/bank-index.json
   * @param {object} traversal DynancaManifest (eachNode, eachPracticeFile)
   */
  function buildCatalog(manifest, index, traversal) {
    if (!isPlainObject(manifest) || !Array.isArray(manifest.subjects)) {
      throw CatalogDataError("malformed-manifest", "The manifest has no subjects array.");
    }
    if (!isPlainObject(index) || !isPlainObject(index.available)) {
      throw CatalogDataError("malformed-index", "The availability index has no \"available\" map.");
    }
    if (!traversal || typeof traversal.eachNode !== "function" || typeof traversal.eachPracticeFile !== "function") {
      throw CatalogDataError("missing-traversal", "The shared manifest traversal is not loaded.");
    }

    var collections = [];
    var collectionByNode = new Map();
    var topicByNode = new Map();
    var usedCollectionKeys = Object.create(null);

    // Pass 1 — register every collection and topic node, in manifest order.
    traversal.eachNode(manifest.subjects, function (node, trail) {
      if (!isPlainObject(node)) return;
      if (trail.length === 1) {
        var key = String(node.id == null ? "" : node.id);
        if (!key || usedCollectionKeys[key]) key = key + "~" + collections.length;
        usedCollectionKeys[key] = true;
        var collection = {
          key: key,
          name: displayName(node, "Collection " + (collections.length + 1)),
          total: 0,
          available: 0,
          listedQuestions: 0,
          verifiedQuestions: 0,
          directTotal: 0,
          directAvailable: 0,
          topics: []
        };
        collections.push(collection);
        collectionByNode.set(node, collection);
        return;
      }
      var owner = collectionByNode.get(trail[0]);
      if (!owner) return;
      var topicNodes = trail.slice(1);
      var topic = {
        path: topicNodes.map(function (n) { return encodeURIComponent(String(n.id == null ? "" : n.id)); }).join("/"),
        names: topicNodes.map(function (n, i) { return displayName(n, "Topic " + (i + 1)); }),
        depth: topicNodes.length,
        total: 0,      // includes every descendant topic
        available: 0
      };
      topic.name = topic.names[topic.names.length - 1];
      topic.label = topic.names.join(" › ");
      owner.topics.push(topic);
      topicByNode.set(node, topic);
    });

    // Pass 2 — every practice file, wherever it sits in the tree.
    var entries = [];
    var seenIds = Object.create(null);
    var byId = Object.create(null);

    traversal.eachPracticeFile(manifest.subjects, function (file, trail) {
      var collection = collectionByNode.get(trail[0]);
      if (!collection || !isPlainObject(file)) return;

      var idIsUsable = typeof file.id === "string" && file.id !== "";
      var id = idIsUsable ? file.id : "";
      // The practice page resolves an id to its FIRST manifest entry, so a
      // repeated id can never open the later entry: only the first is live.
      var firstWithThisId = idIsUsable && !seenIds[id];
      if (idIsUsable) seenIds[id] = true;

      var indexed = firstWithThisId && hasOwn(index.available, id) ? index.available[id] : null;
      var available = typeof indexed === "number" && isFinite(indexed) && indexed > 0;
      var listedCount = typeof file.questionCount === "number" && isFinite(file.questionCount) && file.questionCount >= 0
        ? file.questionCount
        : null;

      var topicNodes = trail.slice(1);
      var topic = topicNodes.length ? topicByNode.get(topicNodes[topicNodes.length - 1]) || null : null;

      var entry = {
        position: entries.length,
        id: id,
        name: displayName(file, "Untitled bank"),
        collectionKey: collection.key,
        collectionName: collection.name,
        topicPath: topic ? topic.path : "",
        topicNames: topic ? topic.names.slice() : [],
        available: available,
        verifiedCount: available ? indexed : null,
        listedCount: listedCount
      };
      entry.haystack = normalizeText(
        [entry.name, entry.id, entry.collectionName].concat(entry.topicNames).join(" \n ")
      );
      entries.push(entry);
      if (firstWithThisId) byId[id] = entry;

      collection.total += 1;
      if (listedCount != null) collection.listedQuestions += listedCount;
      if (available) {
        collection.available += 1;
        collection.verifiedQuestions += entry.verifiedCount;
      }
      if (!topic) {
        collection.directTotal += 1;
        if (available) collection.directAvailable += 1;
      }
      // Count the file on its own topic and on every ancestor topic.
      for (var i = 0; i < topicNodes.length; i++) {
        var ancestor = topicByNode.get(topicNodes[i]);
        if (!ancestor) continue;
        ancestor.total += 1;
        if (available) ancestor.available += 1;
      }
    });

    var totals = { collections: collections.length, listed: entries.length, available: 0, listedQuestions: 0, verifiedQuestions: 0 };
    collections.forEach(function (c) {
      totals.available += c.available;
      totals.listedQuestions += c.listedQuestions;
      totals.verifiedQuestions += c.verifiedQuestions;
    });

    var collectionByKey = Object.create(null);
    collections.forEach(function (c) {
      collectionByKey[c.key] = c;
      c.topicByPath = Object.create(null);
      c.topics.forEach(function (t) { c.topicByPath[t.path] = t; });
    });

    return {
      collections: collections,
      collectionByKey: collectionByKey,
      entries: entries,
      byId: byId,
      totals: totals,
      // Sanity information for maintainers; the UI only logs it.
      indexMismatch: describeIndexMismatch(index, entries, byId)
    };
  }

  function describeIndexMismatch(index, entries, byId) {
    var unknown = 0;
    Object.keys(index.available).forEach(function (id) {
      if (!byId[id]) unknown += 1;
    });
    var declared = isPlainObject(index.summary) && typeof index.summary.listedBanks === "number"
      ? index.summary.listedBanks
      : null;
    if (!unknown && (declared == null || declared === entries.length)) return null;
    return { unknownIds: unknown, indexListedBanks: declared, manifestEntries: entries.length };
  }

  /* ---------- Filter state ---------- */

  function defaultState() {
    return { q: "", collection: "", topic: "", show: SHOW_AVAILABLE, page: 1 };
  }

  /** Parse a location.search string into a raw (not yet validated) state. */
  function parseQuery(search) {
    var state = defaultState();
    var text = String(search || "").replace(/^\?/, "");
    if (!text) return state;
    text.split("&").forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf("=");
      var rawKey = eq === -1 ? pair : pair.slice(0, eq);
      var rawValue = eq === -1 ? "" : pair.slice(eq + 1);
      var key, value;
      try {
        key = decodeURIComponent(rawKey.replace(/\+/g, " "));
        value = decodeURIComponent(rawValue.replace(/\+/g, " "));
      } catch (err) {
        return; // malformed escape: ignore this parameter
      }
      if (key === "q") state.q = value;
      else if (key === "collection") state.collection = value;
      else if (key === "topic") state.topic = value;
      else if (key === "show") state.show = value;
      else if (key === "page") state.page = value;
    });
    return state;
  }

  /** Serialize a state to a query string ("" when everything is default). */
  function toQuery(state) {
    var parts = [];
    function add(key, value) {
      parts.push(key + "=" + encodeURIComponent(value));
    }
    var q = String(state.q || "").trim();
    if (q) add("q", q);
    if (state.collection) add("collection", state.collection);
    if (state.collection && state.topic) add("topic", state.topic);
    if (state.show === SHOW_ALL) add("show", SHOW_ALL);
    if (state.page > 1) add("page", String(state.page));
    return parts.length ? "?" + parts.join("&") : "";
  }

  /**
   * Validate a raw state against the catalog: unknown collections/topics
   * fall back to "all", the page is clamped later by paginate().
   */
  function normalizeState(raw, catalog) {
    var state = defaultState();
    raw = raw || {};
    state.q = String(raw.q == null ? "" : raw.q).replace(/\s+/g, " ").trim().slice(0, 200);
    var collection = catalog.collectionByKey[String(raw.collection || "")];
    if (collection) {
      state.collection = collection.key;
      var topic = String(raw.topic || "");
      if (topic === TOPIC_DIRECT) {
        if (collection.topics.length && collection.directTotal > 0) state.topic = TOPIC_DIRECT;
      } else if (topic && collection.topicByPath[topic]) {
        state.topic = topic;
      }
    }
    state.show = raw.show === SHOW_ALL ? SHOW_ALL : SHOW_AVAILABLE;
    var page = parseInt(raw.page, 10);
    state.page = isFinite(page) && page >= 1 ? page : 1;
    return state;
  }

  function matchesTopic(entry, topic) {
    if (!topic) return true;
    if (topic === TOPIC_DIRECT) return entry.topicPath === "";
    return entry.topicPath === topic || entry.topicPath.indexOf(topic + "/") === 0;
  }

  /**
   * Apply query + collection + topic (+ availability) in manifest order.
   * Returns the visible items and both counts so the UI can always tell
   * "available" and "listed" apart.
   */
  function filterEntries(catalog, state) {
    var tokens = normalizeText(state.q).split(" ").filter(Boolean);
    var matched = [];
    var matchedAvailable = 0;
    for (var i = 0; i < catalog.entries.length; i++) {
      var entry = catalog.entries[i];
      if (state.collection && entry.collectionKey !== state.collection) continue;
      if (!matchesTopic(entry, state.topic)) continue;
      var ok = true;
      for (var t = 0; t < tokens.length; t++) {
        if (entry.haystack.indexOf(tokens[t]) === -1) { ok = false; break; }
      }
      if (!ok) continue;
      matched.push(entry);
      if (entry.available) matchedAvailable += 1;
    }
    var items = state.show === SHOW_ALL
      ? matched
      : matched.filter(function (entry) { return entry.available; });
    return {
      items: items,
      matchedAll: matched.length,
      matchedAvailable: matchedAvailable,
      matchedUnavailable: matched.length - matchedAvailable
    };
  }

  function paginate(items, page, pageSize) {
    var size = pageSize || PAGE_SIZE;
    var pageCount = Math.max(1, Math.ceil(items.length / size));
    var current = Math.min(Math.max(1, page || 1), pageCount);
    var start = (current - 1) * size;
    var pageItems = items.slice(start, start + size);
    return {
      page: current,
      pageCount: pageCount,
      pageSize: size,
      total: items.length,
      from: items.length ? start + 1 : 0,
      to: start + pageItems.length,
      items: pageItems
    };
  }

  /** Page numbers to show, with "gap" markers: 1 … 4 5 6 … 20 */
  function pageWindow(page, pageCount) {
    var wanted = [1, pageCount, page - 1, page, page + 1];
    if (page <= 3) wanted.push(2, 3, 4);
    if (page >= pageCount - 2) wanted.push(pageCount - 1, pageCount - 2, pageCount - 3);
    var pages = wanted
      .filter(function (n, i, all) { return n >= 1 && n <= pageCount && all.indexOf(n) === i; })
      .sort(function (a, b) { return a - b; });
    var out = [];
    pages.forEach(function (n, i) {
      if (i > 0) {
        var prev = pages[i - 1];
        if (n - prev === 2) out.push(prev + 1);
        else if (n - prev > 2) out.push("gap");
      }
      out.push(n);
    });
    return out;
  }

  /** The one canonical way a bank is opened: the exact manifest entry id. */
  function practiceHref(id, basePath) {
    return (basePath || "") + "practice/index.html?quiz=" + encodeURIComponent(id);
  }

  /* ---------- Saved progress (strictly read-only) ---------- */

  var ATTEMPT_PREFIX = "dynanca-mcq-";
  var ATTEMPT_SUFFIX = "-v2";

  /**
   * Read — never write, migrate or delete — the per-bank attempt records
   * that practice/practice-state.js stores under "dynanca-mcq-<id>-v2".
   * Only records for banks that are in the catalog are reported, and only
   * what is really stored: how many answers and the newest answer time.
   *
   * @param {Storage|null} storage window.localStorage (or a stub)
   * @param {object} catalog result of buildCatalog()
   * @returns {Array<{id: string, answers: number, lastAnsweredAt: number|null}>}
   *          newest first
   */
  function readSavedProgress(storage, catalog) {
    var found = [];
    if (!storage) return found;
    var keys = [];
    try {
      var length = storage.length;
      for (var i = 0; i < length; i++) {
        var key = storage.key(i);
        if (typeof key === "string") keys.push(key);
      }
    } catch (err) {
      return found; // storage blocked: simply no progress to show
    }
    keys.forEach(function (key) {
      if (key.indexOf(ATTEMPT_PREFIX) !== 0) return;
      if (key.slice(-ATTEMPT_SUFFIX.length) !== ATTEMPT_SUFFIX) return;
      var id = key.slice(ATTEMPT_PREFIX.length, key.length - ATTEMPT_SUFFIX.length);
      if (!id || !catalog.byId[id]) return;
      var records;
      try {
        records = JSON.parse(storage.getItem(key));
      } catch (err) {
        return; // corrupt entry: ignore it, never repair it from here
      }
      if (!isPlainObject(records)) return;
      var answers = 0;
      var last = null;
      Object.keys(records).forEach(function (questionId) {
        var rec = records[questionId];
        if (!isPlainObject(rec)) return;
        if (rec.status !== "answered_correct" && rec.status !== "answered_wrong") return;
        if (!rec.selectedLabel) return;
        answers += 1;
        if (typeof rec.answeredAt === "number" && isFinite(rec.answeredAt) && (last === null || rec.answeredAt > last)) {
          last = rec.answeredAt;
        }
      });
      if (answers > 0) found.push({ id: id, answers: answers, lastAnsweredAt: last });
    });
    found.sort(function (a, b) {
      var at = a.lastAnsweredAt === null ? -1 : a.lastAnsweredAt;
      var bt = b.lastAnsweredAt === null ? -1 : b.lastAnsweredAt;
      if (bt !== at) return bt - at;
      return catalog.byId[a.id].position - catalog.byId[b.id].position;
    });
    return found;
  }

  var api = {
    PAGE_SIZE: PAGE_SIZE,
    SHOW_AVAILABLE: SHOW_AVAILABLE,
    SHOW_ALL: SHOW_ALL,
    TOPIC_DIRECT: TOPIC_DIRECT,
    buildCatalog: buildCatalog,
    defaultState: defaultState,
    parseQuery: parseQuery,
    toQuery: toQuery,
    normalizeState: normalizeState,
    normalizeText: normalizeText,
    filterEntries: filterEntries,
    paginate: paginate,
    pageWindow: pageWindow,
    practiceHref: practiceHref,
    readSavedProgress: readSavedProgress
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.DynancaCatalogModel = api;
  }
})(typeof window !== "undefined" ? window : this);
