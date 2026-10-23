/* ==========================================================================
   DYNANCA — canonical master-manifest traversal utility
   -------------------------------------------------------------------------
   A manifest subject node can legitimately take two shapes (both defined
   by the master-manifest schema, not a bug):

     CASE A: subject -> topics[] -> practice_files[]   (e.g. Mathematics)
     CASE B: subject -> practice_files[] directly       (e.g. Quiz)

   Any node (subject, topic, or subtopic) may have EITHER `practice_files`,
   OR `topics`/`subtopics`, OR both, OR neither. This module is the single
   place that understands how to walk that structure, so the homepage
   catalog renderer (index.html) and the practice-page data loader
   (practice/data-loader.js) can never disagree about how a manifest is
   read or how a practice-file id resolves to an entry.

   Works both in the browser (exposes `window.DynancaManifest`) and under
   Node (exposes `module.exports`), so the same file can be exercised by
   the automated test suite in tools/tests/.
   ========================================================================== */
(function (global) {
  "use strict";

  /**
   * Visit every node (subject, topic, subtopic, ...) in the manifest tree,
   * depth-first. `visit(node, trail)` is called for each node, where
   * `trail` is the array of ancestor nodes from the subject down to (and
   * including) `node` itself. Recurses into both `topics` and `subtopics`
   * at any depth, so future hierarchy levels are supported for free.
   * @param {Array} nodes
   * @param {(node: object, trail: object[]) => void} visit
   * @param {object[]} [trail]
   */
  function eachNode(nodes, visit, trail) {
    trail = trail || [];
    (nodes || []).forEach(function (node) {
      var nextTrail = trail.concat([node]);
      visit(node, nextTrail);
      eachNode(node.topics, visit, nextTrail);
      eachNode(node.subtopics, visit, nextTrail);
    });
  }

  /**
   * Visit every practice_file entry anywhere in the manifest, regardless of
   * whether it sits directly on a subject (Case B) or under nested
   * topics/subtopics (Case A).
   * @param {Array} subjects
   * @param {(practiceFile: object, trail: object[]) => void} visit
   */
  function eachPracticeFile(subjects, visit) {
    eachNode(subjects, function (node, trail) {
      (node.practice_files || []).forEach(function (p) {
        visit(p, trail);
      });
    });
  }

  /**
   * Find a practice_file entry by its manifest id, searching the whole
   * tree (direct subject-level files and files nested under any depth of
   * topics/subtopics). Returns null if not found.
   * @param {Array} subjects
   * @param {string} id
   * @returns {object|null}
   */
  function findPracticeFile(subjects, id) {
    var found = null;
    eachPracticeFile(subjects, function (p) {
      if (!found && p.id === id) found = p;
    });
    return found;
  }

  /**
   * A manifest `path` must stay a plain, relative, forward-slash path that
   * lives under questions/ — never an absolute path, a URL, a backslash
   * (Windows-style) path, or anything containing a ".." traversal segment.
   * This is the same rule the manifest generator and validator enforce, so
   * a hand-edited CSV row can't smuggle a path that would resolve outside
   * the project.
   * @param {string} p
   * @returns {boolean}
   */
  function isSafeRelativePath(p) {
    if (typeof p !== "string" || !p) return false;
    // Paths are filesystem names, not pre-encoded URLs. Reject characters
    // that URL parsing would reinterpret before the request reaches a host.
    if (/[\u0000-\u001f\u007f%?#]/.test(p)) return false;
    if (p.indexOf("\\") !== -1) return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(p)) return false;
    if (p.charAt(0) === "/") return false;
    var parts = p.split("/");
    if (parts.some(function (part) { return !part || part === "." || part === ".."; })) return false;
    if (parts[0] !== "questions") return false;
    return /\.json$/.test(p);
  }

  var api = {
    eachNode: eachNode,
    eachPracticeFile: eachPracticeFile,
    findPracticeFile: findPracticeFile,
    isSafeRelativePath: isSafeRelativePath,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.DynancaManifest = api;
  }
})(typeof window !== "undefined" ? window : this);
