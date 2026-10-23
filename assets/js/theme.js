/* ==========================================================================
   DYNANCA — standalone theme module (light / dark / system)
   -------------------------------------------------------------------------
   One small file shared by the landing page and the practice page. It has
   NO dependency on PracticeEngine, PracticeState, the question banks or
   MathJax, so the theme works on every page and in every state — including
   when the catalog or a question bank fails to load.

   Loaded as a normal (blocking) script in <head> so the stored preference
   is applied before first paint; the buttons are wired up on
   DOMContentLoaded.

   Storage: the existing key "dynanca-mfc-theme-mode" (values "light",
   "dark", "system"), so a choice made on one page carries to the other.
   Every storage access is wrapped: if storage is blocked or throws, the
   page still renders and the choice simply lasts for the current page.

   Markup contract: any element with a data-theme-option="light|dark|system"
   attribute is a theme button; its aria-pressed is kept in sync.
   ========================================================================== */
(function (global) {
  "use strict";

  var THEME_KEY = "dynanca-mfc-theme-mode";
  var MODES = ["light", "dark", "system"];
  var doc = global.document;
  var root = doc.documentElement;
  var media = typeof global.matchMedia === "function"
    ? global.matchMedia("(prefers-color-scheme: dark)")
    : null;

  // Used when storage is unavailable, so a click still works for this page.
  var sessionMode = null;
  var initialised = false;

  function isMode(value) {
    return MODES.indexOf(value) !== -1;
  }

  function getMode() {
    if (sessionMode) return sessionMode;
    try {
      var stored = global.localStorage.getItem(THEME_KEY);
      return isMode(stored) ? stored : "system";
    } catch (err) {
      return "system";
    }
  }

  function storeMode(mode) {
    try {
      global.localStorage.setItem(THEME_KEY, mode);
      sessionMode = null;
    } catch (err) {
      sessionMode = mode; // storage refused: remember for this page only
    }
  }

  function resolve(mode) {
    if (mode === "system") return media && media.matches ? "dark" : "light";
    return mode;
  }

  function syncButtons(mode) {
    var buttons = doc.querySelectorAll("[data-theme-option]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute(
        "aria-pressed",
        String(buttons[i].getAttribute("data-theme-option") === mode)
      );
    }
  }

  function apply(mode) {
    if (!isMode(mode)) mode = "system";
    root.setAttribute("data-theme", resolve(mode));
    root.setAttribute("data-theme-mode", mode);
    syncButtons(mode);
  }

  function setMode(mode) {
    if (!isMode(mode)) return;
    storeMode(mode);
    apply(mode);
  }

  function onClick(event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("[data-theme-option]") : null;
    if (!button) return;
    setMode(button.getAttribute("data-theme-option"));
  }

  function onSystemChange() {
    if (getMode() === "system") apply("system");
  }

  /** Wire up the buttons and listeners. Safe to call more than once. */
  function init() {
    apply(getMode());
    if (initialised) return;
    initialised = true;

    doc.addEventListener("click", onClick);

    if (media) {
      if (typeof media.addEventListener === "function") media.addEventListener("change", onSystemChange);
      else if (typeof media.addListener === "function") media.addListener(onSystemChange);
    }

    // Another tab changed the preference: follow it.
    global.addEventListener("storage", function (event) {
      if (event && event.key === THEME_KEY) {
        sessionMode = null;
        apply(getMode());
      }
    });
  }

  // First paint: apply immediately (the buttons do not exist yet, which is
  // fine — init() syncs them once the DOM is ready).
  root.classList.add("js");
  apply(getMode());

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();

  global.DynancaTheme = {
    KEY: THEME_KEY,
    init: init,
    getMode: getMode,
    setMode: setMode,
    resolve: resolve
  };
})(window);
