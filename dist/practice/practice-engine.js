/* ==========================================================================
   DYNANCA — UNIVERSAL PRACTICE ENGINE
   --------------------------------------------------------------------------
   Content-first renderer. There is NO contract for category, learningObjective,
   difficulty, cognitiveLevel, hint, or explanation.

   Required:
     id + question
   Optional:
     options / choices, answer, hint, explanation, visual, image, images,
     code, metadata, and arbitrary additional fields.

   Supported MCQ:
     2, 3, 4, 5, ... choices
     labels may be A/B/C, 1/2/3, True/False, or any string.

   Supported question/answer:
     question + answer with no options -> "Reveal answer" flow.

   Supported visual content:
     MathJax in every text field
     existing Dynanca Venn renderer
     image / images
     graph / chart data
     code blocks and inline code
   ========================================================================== */
(function () {
  "use strict";

  let container = null;
  let mode = "stream";
  let currentId = null;
  let historyStack = [];
  // Deterministic completion state (see renderComplete()/advance()): once
  // every question in the current stream has an attempt record, the engine
  // stops trying to "advance" to somewhere — it explicitly marks itself
  // done instead of silently looping back to the last question forever.
  let isComplete = false;
  // Tracks which mistake ids have already been shown once during the
  // CURRENT review pass, so review mode has its own explicit end instead of
  // cycling through the mistake queue as an endless ring buffer.
  let reviewVisited = null;
  const MAX_HISTORY = 100;
  const VALID_STATUSES = ["unanswered", "answered_correct", "answered_wrong"];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------------------------------------------------------------------- */
  /* Bare-LaTeX auto-delimiting                                              */
  /* --------------------------------------------------------------------------
     Root-cause fix for question/hint/explanation authors typing LaTeX macros
     (\times, \frac{..}{..}, \approx, ...) inline in prose without wrapping
     them in MathJax's configured delimiters (\( \) / \[ \] / $$ $$). Without
     this, MathJax's tex input processor never sees that text as math at all
     — it's just literal backslash-prefixed text sitting outside any math
     region — so it renders as raw "\times" instead of "×".

     This is intentionally a RENDERER fix, not a per-record data edit: the
     same authoring mistake will keep happening in new content, and the
     rendering pipeline is the single place that can catch every instance
     (past and future) without hand-touching hundreds of question-bank
     fields. It never touches text that is already inside \( \), \[ \],
     $ $, $$ $$, fenced code blocks, or inline `code` spans.

     SYNCHRONIZED WITH assets/js/math-normalizer.js (GENERATOR - PR repo):
     this is the exact same command list and scanning algorithm the
     generator ports into the JSON at conversion time, so the two can never
     disagree about what counts as "bare math" (Master Task section B4/B7,
     2026-09 synchronization pass). If you add a command to one list, add
     it to the other.
     ========================================================================== */
  var LATEX_COMMAND_NAMES = [
    "times", "div", "frac", "dfrac", "tfrac", "sqrt", "neq", "leq", "geq", "approx", "to", "pm", "mp",
    "cdot", "sum", "prod", "int", "infty", "alpha", "beta", "gamma", "delta", "theta", "lambda", "mu",
    "pi", "rho", "sigma", "phi", "omega", "leftarrow", "rightarrow", "Rightarrow", "Leftarrow", "leftrightarrow",
    "Leftrightarrow", "in", "notin", "subset", "subseteq", "cup", "cap", "emptyset", "forall", "exists",
    "binom", "log", "ln", "lim", "partial", "vec", "hat", "bar", "overline", "underline", "left", "right",
    "text", "textdegree", "mathbf", "mathrm", "mathit", "ldots", "cdots", "vdots", "ddots", "circ", "propto", "equiv",
    "ne", "le", "ge", "angle", "perp", "parallel", "sin", "cos", "tan", "cot", "sec", "csc"
  ];
  var LATEX_COMMAND_RE = new RegExp("^\\\\(?:" + LATEX_COMMAND_NAMES.join("|") + ")");
  var HAS_LATEX_COMMAND_RE = new RegExp("\\\\(?:" + LATEX_COMMAND_NAMES.join("|") + ")\\b");

  function findProtectedRanges(s) {
    var ranges = [];
    var patterns = [
      /\\\((?:[^\\]|\\(?!\)))*\\\)/g,
      /\\\[(?:[^\\]|\\(?!\]))*\\\]/g,
      /\$\$[\s\S]*?\$\$/g,
      /\$(?:[^$\\]|\\.)*\$/g,
      /```[\s\S]*?```/g,
      /`[^`]*`/g
    ];
    patterns.forEach(function (re) {
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        ranges.push([m.index, m.index + m[0].length]);
        if (m[0].length === 0) re.lastIndex++;
      }
    });
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    return ranges;
  }

  function isInRanges(ranges, i) {
    for (var k = 0; k < ranges.length; k++) { if (i >= ranges[k][0] && i < ranges[k][1]) return true; }
    return false;
  }

  function matchCommandAt(s, i) {
    var m = /^\\[A-Za-z]+/.exec(s.slice(i));
    return m ? m[0] : null;
  }

  function consumeBraceGroups(s, i) {
    var j = i;
    while (s[j] === "{") {
      var depth = 0, k = j;
      do {
        if (s[k] === "{") depth++;
        else if (s[k] === "}") depth--;
        k++;
      } while (depth > 0 && k < s.length);
      j = k;
    }
    return j;
  }

  function isLetter(ch) { return !!ch && /[A-Za-z]/.test(ch); }

  function expandRight(s, start, limit) {
    var j = start;
    while (j < limit) {
      var ch = s[j];
      if (ch === "\\") {
        var cmd = matchCommandAt(s, j);
        if (!cmd) break;
        j = consumeBraceGroups(s, j + cmd.length);
        continue;
      }
      if (/[0-9.]/.test(ch)) { j++; continue; }
      if (ch === " ") {
        var k = j + 1;
        while (s[k] === " ") k++;
        if (s[k] === "\\") { j = k; continue; }
        var wordMatch = /^[A-Za-z]+/.exec(s.slice(k));
        if (wordMatch && wordMatch[0].length >= 2) break;
        if (k >= limit) break;
        j = k;
        continue;
      }
      if (/[+\-*/=^_(){}<>,]/.test(ch)) { j++; continue; }
      if (isLetter(ch)) {
        if (isLetter(s[j + 1])) break;
        j++; continue;
      }
      break;
    }
    while (j > start && /[\s,;:]/.test(s[j - 1])) j--;
    while (j > start && s[j - 1] === ".") {
      if (/[0-9]/.test(s[j - 2] || "") && /[0-9]/.test(s[j] || "")) break;
      j--;
    }
    return j;
  }

  function expandLeft(s, start, limit) {
    var j = start;
    while (j > limit) {
      var ch = s[j - 1];
      if (/[0-9.]/.test(ch)) { j--; continue; }
      if (ch === " ") {
        var k = j - 2;
        while (k >= limit && s[k] === " ") k--;
        var before = s.slice(Math.max(limit, k - 40), k + 1);
        var wordMatch = /([A-Za-z]+)$/.exec(before);
        if (wordMatch && wordMatch[1].length >= 2) break;
        j = k + 1;
        continue;
      }
      if (/[+\-*/=^_(){}<>,]/.test(ch)) { j--; continue; }
      if (isLetter(ch)) {
        if (isLetter(s[j - 2])) break;
        j--; continue;
      }
      break;
    }
    while (j < start && /[\s,;:]/.test(s[j])) j++;
    return j;
  }

  function autoWrapBareLatex(text) {
    if (typeof text !== "string" || text.indexOf("\\") === -1) return text;
    if (!HAS_LATEX_COMMAND_RE.test(text)) return text;
    var ranges = findProtectedRanges(text);
    var commandStarts = [];
    for (var i = 0; i < text.length; i++) {
      if (text[i] === "\\" && !isInRanges(ranges, i)) {
        var cmd = matchCommandAt(text, i);
        if (cmd && LATEX_COMMAND_RE.test(cmd)) { commandStarts.push(i); i += cmd.length - 1; }
      }
    }
    if (!commandStarts.length) return text;

    function limitLeftFor(pos) {
      var lim = 0;
      for (var k = 0; k < ranges.length; k++) { if (ranges[k][1] <= pos && ranges[k][1] > lim) lim = ranges[k][1]; }
      return lim;
    }
    function limitRightFor(pos) {
      var lim = text.length;
      for (var k = 0; k < ranges.length; k++) { if (ranges[k][0] >= pos && ranges[k][0] < lim) lim = ranges[k][0]; }
      return lim;
    }

    var spans = commandStarts.map(function (i) {
      var cmd = matchCommandAt(text, i);
      var afterCmd = consumeBraceGroups(text, i + cmd.length);
      var left = expandLeft(text, i, limitLeftFor(i));
      var right = expandRight(text, afterCmd, limitRightFor(i));
      return [left, right];
    });

    spans.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    spans.forEach(function (span) {
      if (merged.length && span[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], span[1]);
      } else {
        merged.push(span.slice());
      }
    });

    var out = "", cursor = 0;
    merged.forEach(function (span) {
      if (span[1] <= span[0]) return;
      out += text.slice(cursor, span[0]) + "\\(" + text.slice(span[0], span[1]) + "\\)";
      cursor = span[1];
    });
    out += text.slice(cursor);
    return out;
  }

  /* ---------------------------------------------------------------------- */
  /* Universal text formatter                                               */
  /* ---------------------------------------------------------------------- */
  function formatText(value) {
    if (value == null) return "";
    if (typeof value !== "string") {
      if (typeof value === "number" || typeof value === "boolean") return escapeHtml(value);
      return escapeHtml(JSON.stringify(value, null, 2));
    }

    // Protect fenced code before newline formatting. This prevents <br>
    // injection inside executable code while keeping ordinary prose readable.
    const blocks = [];
    let source = String(value).replace(/\r\n?/g, "\n");
    source = autoWrapBareLatex(source);
    source = source.replace(/```([A-Za-z0-9_+#.-]*)\n?([\s\S]*?)```/g,
      function (_, lang, code) {
        const token = "@@DYNANCA_CODE_" + blocks.length + "@@";
        const cls = lang ? ' class="practice-code practice-code--' + escapeHtml(lang) + '"' : ' class="practice-code"';
        blocks.push('<pre' + cls + '><code>' + escapeHtml(code) + '</code></pre>');
        return token;
      });

    let s = escapeHtml(source);
    s = s.replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
    s = s.replace(/\n/g, "<br>");

    blocks.forEach(function (html, i) {
      s = s.replace("@@DYNANCA_CODE_" + i + "@@", html);
    });
    return s;
  }

  function formatBlock(value) {
    return formatText(value);
  }

  // Rich content blocks are optional. They let authors mix prose, code,
  // images, and math without inventing a new schema contract for the engine.
  function renderContent(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(renderContent).join("");
    if (typeof value === "object") {
      if (value.type === "image") return renderImage(value.src || value.url, value.alt, value.caption);
      if (value.type === "code") {
        const lang = value.language ? escapeHtml(value.language) : "";
        return '<pre class="practice-code"><code' + (lang ? ' data-language="' + lang + '"' : '') + '>' +
          escapeHtml(value.code == null ? "" : value.code) + '</code></pre>';
      }
      if (value.type === "math") return '<div class="practice-rich-math">' + formatText(value.content || value.math || "") + '</div>';
      if (value.text !== undefined) return formatText(value.text);
      return formatText(JSON.stringify(value, null, 2));
    }
    return formatText(value);
  }

  /* ---------------------------------------------------------------------- */
  /* MathJax                                                                 */
  /* ---------------------------------------------------------------------- */
  var mathTypesetChain = Promise.resolve();

  function typesetMath(el) {
    if (!el || typeof window === "undefined") return;

    function run() {
      if (el.isConnected === false) return Promise.resolve();
      if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
        return window.MathJax.typesetPromise([el]).catch(function (err) {
          console.error("[PracticeEngine] MathJax typeset error:", err);
        });
      }
      window.__dynancaMathQueue = window.__dynancaMathQueue || [];
      if (!window.__dynancaMathQueue.includes(el)) window.__dynancaMathQueue.push(el);
      return Promise.resolve();
    }

    // Serialize dynamic typesetting calls. This prevents overlapping
    // MathJax operations while the learner moves quickly between questions.
    mathTypesetChain = mathTypesetChain.then(run, run);
  }

  function clearMath(el) {
    // MathJax retains MathItems until explicitly cleared. Replacing the
    // question DOM without this leaks every formula from earlier questions.
    if (typeof window !== "undefined" && window.MathJax && typeof window.MathJax.typesetClear === "function") {
      window.MathJax.typesetClear([el]);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Question normalization — intentionally permissive                         */
  /* ---------------------------------------------------------------------- */
  function optionList(q) {
    let raw = q && (Array.isArray(q.options) ? q.options : q.choices);
    if (raw && !Array.isArray(raw) && typeof raw === "object") {
      raw = Object.keys(raw).map(function (k) { return { label: k, text: raw[k] }; });
    }
    if (!raw && q && q.answers && typeof q.answers === "object" && !Array.isArray(q.answers)) {
      raw = Object.keys(q.answers).map(function (k) {
        return { label: k, text: q.answers[k] };
      });
    }
    if (!raw && q && q.options && typeof q.options === "object" && !Array.isArray(q.options)) {
      raw = Object.keys(q.options).map(function (k) {
        return { label: k, text: q.options[k] };
      });
    }
    if (!Array.isArray(raw)) return [];

    return raw.map(function (opt, i) {
      if (opt && typeof opt === "object") {
        const label = opt.label != null ? String(opt.label) :
          (opt.value != null ? String(opt.value) : String.fromCharCode(65 + i));
        const text = opt.text != null ? opt.text :
          (opt.value != null ? opt.value : opt.answer != null ? opt.answer : "");
        return { label: label, text: text, originalIndex: i };
      }
      return { label: String.fromCharCode(65 + i), text: opt, originalIndex: i };
    }).filter(function (opt) {
      return opt.text != null && String(opt.text).trim() !== "";
    });
  }

  function answerValue(q) {
    if (!q) return null;
    if (q.answer !== undefined && q.answer !== null) return q.answer;
    if (q.correctAnswer !== undefined) return q.correctAnswer;
    if (q.correct !== undefined) return q.correct;
    return null;
  }

  function optionIsCorrect(q, opt) {
    const a = answerValue(q);
    if (a == null) return false;
    const opts = optionList(q);
    // A label key takes precedence over an option's text. Numeric keys are
    // zero-based indexes. Resolve one option first so a distractor whose
    // text equals another option's label cannot also become correct.
    let correct = typeof a === "number" && Number.isInteger(a) ? opts[a] : null;
    const av = String(a).trim();
    if (!correct) correct = opts.find(function (o) { return String(o.label).trim() === av; });
    if (!correct) correct = opts.find(function (o) { return String(o.text).trim() === av; });
    return !!correct && correct.originalIndex === opt.originalIndex;
  }

  function validateBank(data) {
    if (!data || !Array.isArray(data.questions) || !data.questions.length) return "Missing or empty questions array.";
    const ids = new Set();
    for (const q of data.questions) {
      if (!isRenderableQuestion(q)) return "Each question requires an id and non-empty question content.";
      const id = String(q.id);
      if (ids.has(id)) return "Duplicate question id: " + id;
      ids.add(id);
      const opts = optionList(q);
      const raw = q.options || q.choices || q.answers;
      if (raw && !opts.length) return "Empty options for question " + id;
      if (Array.isArray(raw) && opts.length !== raw.length) return "Malformed options for question " + id;
      const labels = new Set(opts.map(function (o) { return o.label; }));
      if (labels.size !== opts.length) return "Duplicate option labels for question " + id;
      if (opts.length && !opts.some(function (o) { return optionIsCorrect(q, o); })) return "Answer does not identify an option for question " + id;
    }
    return null;
  }

  function isRenderableQuestion(q) {
    return !!(q && typeof q === "object" &&
      q.id !== undefined && String(q.id).trim() &&
      q.question !== undefined && (typeof q.question === "string" ? q.question.trim() : q.question != null));
  }

  let validatedQuestions = null;
  let validatedFromArray = null;
  let canonicalOrderCache = null;
  let questionMapCache = new Map();

  function getValidatedQuestions() {
    if (typeof PRACTICES === "undefined" || !Array.isArray(PRACTICES)) return [];
    if (validatedFromArray === PRACTICES) return validatedQuestions || [];

    const seen = new Set();
    const out = [];
    PRACTICES.forEach(function (q, index) {
      if (!isRenderableQuestion(q)) {
        console.warn("[PracticeEngine] Skipping entry at index " + index + ": requires only id + question.");
        return;
      }
      const id = String(q.id);
      if (seen.has(id)) {
        console.warn('[PracticeEngine] Skipping duplicate question ID: "' + id + '".');
        return;
      }
      seen.add(id);
      out.push(q);
    });

    validatedFromArray = PRACTICES;
    validatedQuestions = out;
    canonicalOrderCache = out.map(function (q) { return String(q.id); });
    questionMapCache = new Map(out.map(function (q) { return [String(q.id), q]; }));
    return out;
  }

  function getQuestion(questionId) {
    const id = String(questionId);
    getValidatedQuestions();
    return questionMapCache.get(id) || null;
  }

  function getAllQuestions() {
    return getValidatedQuestions().slice();
  }

  function getCanonicalOrder() {
    getValidatedQuestions();
    return canonicalOrderCache || [];
  }

  /* ---------------------------------------------------------------------- */
  /* Optional visual layer                                                   */
  /* ---------------------------------------------------------------------- */
  // Question data (image/images src) is content the site trusts today, but
  // it still flows in from JSON files rather than code, so the URL scheme
  // is checked before it ever reaches a `src` attribute — same principle as
  // escaping text, applied to URLs. Relative/HTTP(S) paths and image data:
  // URIs are allowed; javascript:, vbscript:, and anything else is not.
  function isSafeMediaUrl(url) {
    const s = String(url == null ? "" : url).trim();
    if (!s) return false;
    if (/[\u0000-\u0020\u007f]/.test(s.replace(/ /g, ""))) return false;
    if (/^(https?:)?\/\//i.test(s)) return true; // absolute http(s):// or protocol-relative //
    if (/^data:image\//i.test(s)) return true; // inline image data URI only
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return false; // any other URL scheme (javascript:, vbscript:, file:, ...)
    return true; // plain relative path
  }

  function renderImage(src, alt, caption) {
    if (!src || !isSafeMediaUrl(src)) return "";
    const safeSrc = escapeHtml(src);
    return '<figure class="practice-media">' +
      '<img class="practice-image" src="' + safeSrc + '" alt="' + escapeHtml(alt || "Question image") + '" loading="lazy">' +
      (caption ? '<figcaption>' + formatText(caption) + '</figcaption>' : '') +
      '</figure>';
  }

  function renderImages(images) {
    if (!Array.isArray(images)) return "";
    return images.map(function (item) {
      if (typeof item === "string") return renderImage(item, "Question image", "");
      if (item && typeof item === "object") return renderImage(item.src || item.url, item.alt, item.caption);
      return "";
    }).join("");
  }

  function renderGraph(visual, id) {
    const data = Array.isArray(visual.data) ? visual.data : [];
    if (data.length < 2) return "";
    const pts = data.map(function (p) {
      if (Array.isArray(p)) return { x: Number(p[0]), y: Number(p[1]) };
      return { x: Number(p.x), y: Number(p.y) };
    }).filter(function (p) { return Number.isFinite(p.x) && Number.isFinite(p.y); });
    if (pts.length < 2) return "";

    const xs = pts.map(function (p) { return p.x; });
    const ys = pts.map(function (p) { return p.y; });
    const xmin = Math.min.apply(Math, xs), xmax = Math.max.apply(Math, xs);
    const ymin = Math.min.apply(Math, ys), ymax = Math.max.apply(Math, ys);
    const padX = (xmax - xmin || 1) * 0.1, padY = (ymax - ymin || 1) * 0.1;
    const X0 = xmin - padX, X1 = xmax + padX, Y0 = ymin - padY, Y1 = ymax + padY;
    const sx = function (x) { return 45 + ((x - X0) / (X1 - X0)) * 310; };
    const sy = function (y) { return 180 - ((y - Y0) / (Y1 - Y0)) * 140; };
    const points = pts.map(function (p) { return sx(p.x).toFixed(2) + "," + sy(p.y).toFixed(2); }).join(" ");

    const axisX = (Y0 <= 0 && Y1 >= 0) ? sy(0) : 180;
    const axisY = (X0 <= 0 && X1 >= 0) ? sx(0) : 45;
    const titleId = "graph-title-" + escapeHtml(String(id).replace(/[^A-Za-z0-9_-]/g, ""));
    return '<figure class="practice-media practice-graph">' +
      '<svg viewBox="0 0 400 220" role="img" aria-labelledby="' + titleId + '">' +
      '<title id="' + titleId + '">' + escapeHtml(visual.title || "Graph") + '</title>' +
      '<line x1="45" y1="' + axisX + '" x2="355" y2="' + axisX + '" class="graph-axis"></line>' +
      '<line x1="' + axisY + '" y1="35" x2="' + axisY + '" y2="190" class="graph-axis"></line>' +
      '<polyline points="' + points + '" class="graph-line" fill="none"></polyline>' +
      pts.map(function (p) { return '<circle cx="' + sx(p.x).toFixed(2) + '" cy="' + sy(p.y).toFixed(2) + '" r="3.5" class="graph-point"></circle>'; }).join("") +
      '</svg>' +
      (visual.caption ? '<figcaption>' + formatText(visual.caption) + '</figcaption>' : '') +
      '</figure>';
  }

  function renderChart(visual, id) {
    if (visual.type === "graph") return renderGraph(visual, id);
    if (visual.type === "image") return renderImage(visual.src || visual.url, visual.alt, visual.caption);
    if (visual.type === "venn" && window.DynancaVenn && typeof window.DynancaVenn.render === "function") {
      return window.DynancaVenn.render(visual, id);
    }
    if (window.DynancaMathVisuals && typeof window.DynancaMathVisuals.render === "function") {
      return window.DynancaMathVisuals.render(visual, id) || "";
    }
    return "";
  }

  function renderVisuals(q) {
    let html = "";
    if (q.visual) html += renderChart(q.visual, q.id);
    if (q.image) html += renderImage(typeof q.image === "string" ? q.image : q.image.src, q.image.alt, q.image.caption);
    if (q.images) html += renderImages(q.images);
    return html;
  }

  /* ---------------------------------------------------------------------- */
  /* Selection / learning flow                                               */
  /* ---------------------------------------------------------------------- */
  function getMistakeQueue(excludeId) {
    if (typeof PracticeState === "undefined") return [];
    const ids = new Set(getCanonicalOrder());
    return PracticeState.getMistakeIds().filter(function (id) {
      return ids.has(String(id)) && String(id) !== String(excludeId);
    });
  }

  function getStreamNextId(fromId) {
    const order = getCanonicalOrder();
    if (!order.length) return null;
    const start = fromId ? order.indexOf(String(fromId)) : -1;
    for (let i = 1; i <= order.length; i++) {
      const candidate = order[(start + i) % order.length];
      if (!PracticeState.getRecord(candidate)) return candidate;
    }
    return null;
  }

  // Next NOT-YET-VISITED-THIS-PASS mistake, or null once every mistake in
  // the queue has been shown once. Deliberately NOT a ring buffer: without
  // an exit condition, a single-mistake review (idx+1 % 1 === idx) or a
  // multi-mistake review that's been fully stepped through would otherwise
  // cycle back to a question already shown, forever, with no way to know
  // the review pass is actually done.
  function getReviewNextId(fromId) {
    const ids = getMistakeQueue(null);
    if (!ids.length) return null;
    const idx = fromId ? ids.indexOf(String(fromId)) : -1;
    for (let i = 1; i <= ids.length; i++) {
      const candidate = ids[(idx + i) % ids.length];
      if (!reviewVisited || !reviewVisited.has(candidate)) return candidate;
    }
    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                                */
  /* ---------------------------------------------------------------------- */
  function buildQuestionHtml(q, ctx) {
    ctx = ctx || {};
    const opts = optionList(q);
    const prevHtml = ctx.canGoBack ?
      '<button type="button" class="practice-prev" data-action="prev">&larr; Previous question</button>' : "";

    const optionsHtml = opts.length ? '<div class="practice-options">' +
      opts.map(function (opt) {
        return '<button type="button" class="practice-option" data-question-id="' + escapeHtml(q.id) +
          '" data-label="' + escapeHtml(opt.label) + '">' +
          '<span class="practice-option-label">' + escapeHtml(opt.label) + '.</span>' +
          '<span class="practice-option-text">' + formatText(opt.text) + '</span></button>';
      }).join("") + '</div>' : "";

    const metadata = [];
    // Metadata is display-only and completely unrestricted. Unknown fields are
    // intentionally ignored rather than rejected. This is the key freedom:
    // category/difficulty/etc. are neither required nor enumerated.
    ["category", "concept", "difficulty", "cognitiveLevel", "learningObjective"].forEach(function (key) {
      if (q[key] !== undefined && q[key] !== null && String(q[key]).trim()) {
        metadata.push('<span class="practice-tag">' + formatText(q[key]) + '</span>');
      }
    });
    if (ctx.reviewMode) metadata.unshift('<span class="practice-tag practice-tag--review">Review</span>');
    const metaHtml = metadata.length ? '<div class="practice-meta">' + metadata.join("") + '</div>' : "";

    const hintHtml = q.hint !== undefined && q.hint !== null && String(q.hint).trim() !== "" ?
      '<div class="practice-hint"><button type="button" class="practice-hint-toggle" data-question-id="' +
      escapeHtml(q.id) + '" aria-expanded="false">Show hint</button><div class="practice-hint-text" hidden>' +
      renderContent(q.hint) + '</div></div>' : "";

    const explanationHtml = q.explanation !== undefined && q.explanation !== null && String(q.explanation).trim() !== "" ?
      '<div class="practice-explanation" hidden><p>' + renderContent(q.explanation) + '</p></div>' : "";

    const answerAvailable = answerValue(q) !== null && answerValue(q) !== undefined;
    const revealHtml = (!opts.length && answerAvailable) ?
      '<div class="practice-options"><button type="button" class="practice-option practice-reveal-answer" data-question-id="' +
      escapeHtml(q.id) + '" data-label="__answer__"><span class="practice-option-label">→</span>' +
      '<span class="practice-option-text">Reveal answer</span></button></div>' : "";

    return '<article class="practice-question" data-question-id="' + escapeHtml(q.id) + '" tabindex="-1">' +
      prevHtml + metaHtml + renderVisuals(q) +
      '<div class="practice-question-text">' + renderContent(q.question) + '</div>' +
      optionsHtml + revealHtml +
      (q.code !== undefined ? '<div class="practice-question-code">' + formatText(q.code) + '</div>' : "") +
      hintHtml +
      '<div class="practice-verdict" role="status" aria-live="polite" hidden></div>' +
      explanationHtml +
      '<div class="practice-controls" hidden><button type="button" class="practice-next" data-action="next">Next question &rarr;</button></div>' +
      '</article>';
  }

  function applyStateToDom(questionId, renderOpts) {
    renderOpts = renderOpts || {};
    if (!container) return;
    const el = container.querySelector('.practice-question[data-question-id="' + cssEscape(questionId) + '"]');
    if (!el) return;
    const q = getQuestion(questionId);
    if (!q) return;

    const record = PracticeState.getRecord(questionId);
    const verdict = el.querySelector(".practice-verdict");
    const explanation = el.querySelector(".practice-explanation");
    const controls = el.querySelector(".practice-controls");

    el.querySelectorAll(".practice-option").forEach(function (btn) {
      btn.classList.remove("is-selected", "is-correct", "is-wrong");
      btn.disabled = false;
    });

    if (!record) {
      if (verdict) { verdict.hidden = true; verdict.textContent = ""; }
      if (explanation) explanation.hidden = true;
      if (controls) controls.hidden = true;
      return;
    }

    el.querySelectorAll(".practice-option").forEach(function (btn) { btn.disabled = true; });

    const opts = optionList(q);
    const selected = el.querySelector('.practice-option[data-label="' + cssEscape(record.selectedLabel) + '"]');
    if (selected) {
      selected.classList.add("is-selected");
      if (record.isCorrect) selected.classList.add("is-correct");
      else selected.classList.add("is-wrong");
    }

    // Reveal-answer questions don't have choices to mark; show the answer as
    // safe formatted text after the learner explicitly reveals it.
    if (!opts.length && answerValue(q) !== null) {
      let answerEl = el.querySelector(".practice-revealed-answer");
      if (!answerEl) {
        answerEl = document.createElement("div");
        answerEl.className = "practice-revealed-answer";
        answerEl.innerHTML = "<strong>Answer</strong><div>" + renderContent(answerValue(q)) + "</div>";
        const verdictTarget = verdict || el.querySelector(".practice-question-text");
        if (verdictTarget) verdictTarget.parentNode.insertBefore(answerEl, verdictTarget);
      }
    } else if (!record.isCorrect) {
      const correct = opts.find(function (o) { return optionIsCorrect(q, o); });
      if (correct) {
        const correctBtn = el.querySelector('.practice-option[data-label="' + cssEscape(correct.label) + '"]');
        if (correctBtn) correctBtn.classList.add("is-correct");
      }
    }

    if (verdict) {
      verdict.hidden = false;
      verdict.textContent = record.isCorrect ? "Correct" : "Incorrect";
      verdict.className = "practice-verdict " + (record.isCorrect ? "is-correct" : "is-wrong");
    }
    if (explanation) explanation.hidden = false;
    if (controls) {
      controls.hidden = false;
      if (renderOpts.focusControls) {
        const next = controls.querySelector(".practice-next");
        if (next) next.focus();
      }
    }
    typesetMath(el);
  }

  function focusAndScrollToQuestion(animate) {
    if (!container) return;
    const el = container.querySelector(".practice-question");
    if (!el) return;
    el.scrollIntoView({ behavior: animate && !prefersReducedMotion() ? "smooth" : "auto", block: "start" });
    el.focus({ preventScroll: true });
  }

  // Deterministic end-of-stream / end-of-review screen. Rendered instead of
  // a question card so "every question answered" (or "every mistake
  // reviewed") is an explicit, visible state rather than the engine
  // quietly re-showing the last question with an active Next button.
  function buildCompleteHtml(reviewPass) {
    const stats = typeof PracticeState !== "undefined" ? PracticeState.getStats() : null;
    const mistakeCount = typeof PracticeState !== "undefined" ? PracticeState.getMistakeIds().length : 0;
    let summary = "";
    if (stats && stats.total) {
      summary = '<p class="practice-complete-summary">' +
        escapeHtml(stats.correct) + ' / ' + escapeHtml(stats.total) + ' correct.</p>';
    }
    const heading = reviewPass ? "Review complete." : "Quiz complete.";
    const body = reviewPass
      ? (mistakeCount ? "You’ve been through every question you missed." : "No more mistakes to review.")
      : (mistakeCount
          ? "All questions answered. Use “Review mistakes” above to go back over what you missed."
          : "All questions answered correctly.");
    return '<div class="practice-complete" role="status" aria-live="polite" tabindex="-1">' +
      '<h2 class="practice-complete-heading">' + escapeHtml(heading) + '</h2>' +
      '<p class="practice-complete-body">' + escapeHtml(body) + '</p>' +
      summary +
      '</div>';
  }

  function renderCurrent(opts) {
    opts = opts || {};
    if (!container) return;
    clearMath(container);
    if (isComplete) {
      container.innerHTML = buildCompleteHtml(opts.reviewPass);
      const el = container.querySelector(".practice-complete");
      if (el && !opts.initial) el.focus({ preventScroll: true });
      return;
    }
    if (!currentId) {
      container.innerHTML = '<div class="practice-missing">No questions available yet.</div>';
      return;
    }
    const q = getQuestion(currentId);
    if (!q) {
      container.innerHTML = '<div class="practice-missing">Question not found.</div>';
      return;
    }
    container.innerHTML = buildQuestionHtml(q, {
      canGoBack: historyStack.length > 0,
      reviewMode: mode === "review"
    });
    typesetMath(container);
    applyStateToDom(currentId, { focusControls: false });
    if (mode === "stream" && typeof PracticeState !== "undefined") PracticeState.setCurrentQuestionId(currentId);
    if (!opts.initial) focusAndScrollToQuestion(true);
  }

  function handleAnswer(questionId, selectedLabel) {
    const q = getQuestion(questionId);
    if (!q || typeof PracticeState === "undefined") return;
    if (String(questionId) !== String(currentId) || isComplete) return;
    if (PracticeState.getRecord(questionId)) return;

    const opts = optionList(q);
    let isCorrect = false;

    if (selectedLabel === "__answer__" && !opts.length) {
      // "Question + answer" format is intentionally supported without forcing
      // an MCQ schema. Reveal is a completed learning interaction, not a
      // fabricated correctness claim.
      isCorrect = true;
    } else {
      const selected = opts.find(function (o) { return String(o.label) === String(selectedLabel); });
      if (!selected) return;
      isCorrect = optionIsCorrect(q, selected);
    }

    PracticeState.saveAttempt(questionId, selectedLabel, isCorrect, q.category || null);
    applyStateToDom(questionId, { focusControls: true });
    if (container) container.dispatchEvent(new CustomEvent("practice:answered", {
      bubbles: true, detail: { questionId: questionId, isCorrect: isCorrect }
    }));
  }

  function toggleHint(questionId) {
    if (!container) return;
    const el = container.querySelector('.practice-question[data-question-id="' + cssEscape(questionId) + '"]');
    if (!el) return;
    const text = el.querySelector(".practice-hint-text");
    const btn = el.querySelector(".practice-hint-toggle");
    if (!text || !btn) return;
    text.hidden = !text.hidden;
    btn.textContent = text.hidden ? "Show hint" : "Hide hint";
    btn.setAttribute("aria-expanded", String(!text.hidden));
    typesetMath(el);
  }

  // Resolves where the main stream should land: the learner's saved
  // position if it's still unanswered, otherwise the next unanswered
  // question from there, otherwise null (every question has an attempt —
  // the stream itself is complete).
  function computeStreamResumeTarget() {
    const order = getCanonicalOrder();
    if (!order.length) return null;
    const saved = typeof PracticeState !== "undefined" && PracticeState.getCurrentQuestionId ?
      PracticeState.getCurrentQuestionId() : null;
    const base = saved && order.includes(String(saved)) ? String(saved) : order[0];
    if (typeof PracticeState !== "undefined" && !PracticeState.getRecord(base)) return base;
    return getStreamNextId(base);
  }

  function enterCompleteState(reviewPass, initial) {
    isComplete = true;
    currentId = null;
    renderCurrent({ reviewPass: reviewPass, initial: !!initial });
    if (container) container.dispatchEvent(new CustomEvent("practice:complete", {
      bubbles: true, detail: { mode: reviewPass ? "review" : "stream" }
    }));
  }

  function advance() {
    if (isComplete) return; // already at a deterministic end state — nothing to advance to
    if (!currentId) return;
    historyStack.push(String(currentId));
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    persistHistoryStack();

    if (mode === "review") {
      if (!reviewVisited) reviewVisited = new Set();
      reviewVisited.add(String(currentId));
      const next = getReviewNextId(currentId);
      if (next) {
        currentId = String(next);
        renderCurrent();
        if (container) container.dispatchEvent(new CustomEvent("practice:advanced", {
          bubbles: true, detail: { questionId: currentId, mode: mode }
        }));
        return;
      }
      // Every queued mistake has been shown once this pass — review has an
      // explicit end. Hand back to the main stream (or the stream's own
      // completion state, if that was already fully answered too).
      mode = "stream";
      reviewVisited = null;
      const resumeTarget = computeStreamResumeTarget();
      if (!resumeTarget) { enterCompleteState(false); return; }
      currentId = resumeTarget;
      renderCurrent();
      if (container) container.dispatchEvent(new CustomEvent("practice:advanced", {
        bubbles: true, detail: { questionId: currentId, mode: mode }
      }));
      return;
    }

    const next = getStreamNextId(currentId);
    if (!next) { enterCompleteState(false); return; }
    currentId = String(next);
    renderCurrent();
    if (container) container.dispatchEvent(new CustomEvent("practice:advanced", {
      bubbles: true, detail: { questionId: currentId, mode: mode }
    }));
  }

  function goBack() {
    if (!historyStack.length) return;
    isComplete = false; // stepping back to a real question leaves the completion screen
    currentId = String(historyStack.pop());
    persistHistoryStack();
    renderCurrent();
    if (container) container.dispatchEvent(new CustomEvent("practice:advanced", {
      bubbles: true, detail: { questionId: currentId, mode: mode }
    }));
  }

  function canGoBack() { return historyStack.length > 0; }

  function persistHistoryStack() {
    if (typeof PracticeState !== "undefined" && PracticeState.setHistoryStack) PracticeState.setHistoryStack(historyStack);
  }

  function loadPersistedHistoryStack() {
    if (typeof PracticeState === "undefined" || !PracticeState.getHistoryStack) return [];
    const valid = new Set(getCanonicalOrder());
    return PracticeState.getHistoryStack().map(String).filter(function (id) { return valid.has(id); }).slice(-MAX_HISTORY);
  }

  function getMode() { return mode; }

  function enterReviewMode() {
    const ids = getMistakeQueue(null);
    if (!ids.length) return false;
    mode = "review";
    isComplete = false;
    reviewVisited = new Set();
    historyStack = [];
    persistHistoryStack();
    currentId = String(ids[0]);
    renderCurrent();
    return true;
  }

  function exitReviewMode() {
    if (mode !== "review" && !isComplete) return;
    mode = "stream";
    reviewVisited = null;
    historyStack = [];
    persistHistoryStack();
    const resumeTarget = computeStreamResumeTarget();
    if (!resumeTarget) { enterCompleteState(false); return; }
    currentId = resumeTarget;
    renderCurrent();
  }

  function render(questionId) {
    isComplete = false;
    currentId = String(questionId);
    renderCurrent();
  }

  function start() {
    const order = getCanonicalOrder();
    if (!order.length) { currentId = null; isComplete = false; renderCurrent({ initial: true }); return; }
    mode = "stream";
    isComplete = false;
    reviewVisited = null;
    historyStack = loadPersistedHistoryStack();
    const resumeTarget = computeStreamResumeTarget();
    if (!resumeTarget) { enterCompleteState(false, true); return; }
    currentId = resumeTarget;
    renderCurrent({ initial: true });
  }

  function refresh(questionId) { applyStateToDom(questionId, { focusControls: false }); }

  function onContainerClick(event) {
    const target = event.target.closest ? event.target : event.target.parentElement;
    const next = target && target.closest('[data-action="next"]');
    if (next && container.contains(next)) { advance(); return; }

    const prev = target && target.closest('[data-action="prev"]');
    if (prev && container.contains(prev)) { goBack(); return; }

    const hint = target && target.closest(".practice-hint-toggle");
    if (hint && container.contains(hint)) { toggleHint(hint.getAttribute("data-question-id")); return; }

    const opt = target && target.closest(".practice-option");
    if (!opt || !container.contains(opt)) return;
    const qid = opt.getAttribute("data-question-id");
    const label = opt.getAttribute("data-label");
    if (qid && label) handleAnswer(qid, label);
  }

  function init(containerId) {
    if (typeof PracticeState === "undefined") {
      console.error("[PracticeEngine] practice-state.js must be loaded first.");
      return;
    }
    const el = document.getElementById(containerId);
    if (!el) { console.error("[PracticeEngine] Container #" + containerId + " not found."); return; }
    if (container === el) return;
    container = el;
    container.addEventListener("click", onContainerClick);
  }

  const PracticeEngine = {
    init, start, advance, goBack, canGoBack, getMode,
    enterReviewMode, exitReviewMode, render, refresh, handleAnswer,
    getQuestion, getAllQuestions, optionList, formatText,
    // Exposed for the automated test suite (regression coverage for the
    // bare-LaTeX auto-delimiting fix and the image/visual URL-scheme
    // allowlist) — not part of the DOM-facing API.
    autoWrapBareLatex, isSafeMediaUrl, optionIsCorrect, validateBank
  };

  if (typeof window !== "undefined") window.PracticeEngine = PracticeEngine;
  if (typeof module !== "undefined" && module.exports) module.exports = PracticeEngine;
})();
