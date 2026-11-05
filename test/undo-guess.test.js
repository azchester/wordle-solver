/**
 * Undo guess restores the constraints from before the latest submission
 * and puts that word back in the guess row.
 * Run: node test/undo-guess.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");
var fs = require("fs");

var root = path.join(__dirname, "..");
var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS  " + name);
  } catch (e) {
    failed++;
    console.error("FAIL  " + name);
    console.error("      " + (e && e.stack ? e.stack : e));
  }
}

function find(node, pred) {
  var kids = node.children || [];
  for (var i = 0; i < kids.length; i++) {
    if (pred(kids[i])) return kids[i];
    var nested = find(kids[i], pred);
    if (nested) return nested;
  }
  return null;
}

function matchSel(sel) {
  if (sel.charAt(0) === ".") {
    var cls = sel.slice(1);
    return function (n) {
      return String(n.className || "")
        .split(/\s+/)
        .indexOf(cls) !== -1;
    };
  }
  var opt = sel.match(/^option\[value="(.*)"\]$/);
  if (opt) {
    return function (n) {
      return n.tagName === "option" && String(n.value) === opt[1];
    };
  }
  if (sel === "button") {
    return function (n) {
      return n.tagName === "button";
    };
  }
  return function () {
    return false;
  };
}

function createEl(tag) {
  var el = {
    tagName: String(tag || "").toLowerCase(),
    children: [],
    dataset: {},
    attributes: {},
    listeners: {},
    className: "",
    value: "",
    textContent: "",
    title: "",
    id: "",
    type: "",
    checked: false,
    disabled: false,
    hidden: false,
    readOnly: false,
    parentNode: null,
  };
  el.setAttribute = function (k, v) {
    el.attributes[k] = String(v);
    if (k.indexOf("data-") === 0) {
      var key = k
        .slice(5)
        .replace(/-([a-z])/g, function (_, c) {
          return c.toUpperCase();
        });
      el.dataset[key] = String(v);
    }
  };
  el.getAttribute = function (k) {
    return Object.prototype.hasOwnProperty.call(el.attributes, k)
      ? el.attributes[k]
      : null;
  };
  el.appendChild = function (child) {
    if (child && child.nodeType === 11) {
      var moved = child.children.slice();
      child.children = [];
      for (var i = 0; i < moved.length; i++) el.appendChild(moved[i]);
      return child;
    }
    child.parentNode = el;
    el.children.push(child);
    return child;
  };
  el.addEventListener = function (type, fn) {
    if (!el.listeners[type]) el.listeners[type] = [];
    el.listeners[type].push(fn);
  };
  el.focus = function () {
    el.focused = true;
  };
  el.querySelector = function (sel) {
    return find(el, matchSel(sel));
  };
  Object.defineProperty(el, "innerHTML", {
    configurable: true,
    get: function () {
      return el._html || "";
    },
    set: function (html) {
      el._html = String(html);
      el.children = [];
      if (!html) return;
      var re = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
      var m;
      while ((m = re.exec(html))) {
        var child = createEl(m[1]);
        var attrs = m[2] || "";
        var cm = /class="([^"]*)"/.exec(attrs);
        if (cm) child.className = cm[1];
        var tm = /type="([^"]*)"/.exec(attrs);
        if (tm) child.type = tm[1];
        child.textContent = m[3].replace(/<[^>]+>/g, "");
        el.appendChild(child);
      }
    },
  });
  return el;
}

function bootApp() {
  var ids = Object.create(null);
  function register(id, tag, extras) {
    var el = createEl(tag || "div");
    el.id = id;
    if (extras) {
      Object.keys(extras).forEach(function (k) {
        el[k] = extras[k];
      });
    }
    ids[id] = el;
    return el;
  }

  register("results-body", "tbody");
  register("plurals-body", "tbody");
  register("plurals-panel", "section");
  register("plurals-empty", "div");
  register("empty-msg", "div");
  register("remaining-count", "strong");
  register("removed-count", "strong");
  register("optimal-word", "div", { textContent: "—" });
  register("optimal-score", "strong");
  register("position-leaders", "div");
  register("posex-list", "ul");
  register("posex-letter", "select");
  register("posex-position", "select");
  register("min-unique", "input", { value: "0" });
  register("min-vowels", "input", { value: "0" });
  register("freq-weight", "input", { value: "65" });
  register("freq-label", "span", { textContent: "65%" });
  register("pos-label", "span", { textContent: "35%" });
  register("history-list", "ol");
  register("history-empty", "p");
  register("list-mode-hint", "p");
  register("toggle-common-only", "input", { checked: true });
  register("toggle-exclude-plurals", "input", { checked: true });
  register("toggle-show-plurals", "input", { checked: false });
  register("toggle-hard-mode", "input", { checked: true });
  register("ranking-hint", "p");
  register("guess-tiles", "div");
  register("known-letters", "div");
  register("letter-grid", "div");
  register("theme-toggle", "button");
  register("theme-color-meta", "meta");
  register("reset-btn", "button");
  register("guess-submit", "button");
  register("guess-clear", "button");
  register("guess-undo", "button", { disabled: true });
  register("fill-optimal-guess", "button");
  register("posex-add", "button");
  register("reset-weights", "button");

  var g = global;
  g.window = g;
  g.alert = function (msg) {
    g.__lastAlert = msg;
  };
  g.localStorage = {
    getItem: function () {
      return null;
    },
    setItem: function () {},
    removeItem: function () {},
  };
  g.document = {
    body: createEl("body"),
    documentElement: createEl("html"),
    getElementById: function (id) {
      return ids[id] || null;
    },
    createElement: function (tag) {
      return createEl(tag);
    },
    createDocumentFragment: function () {
      var frag = createEl("#fragment");
      frag.nodeType = 11;
      return frag;
    },
  };
  g.matchMedia = function () {
    return {
      matches: false,
      addEventListener: function () {},
      addListener: function () {},
    };
  };

  var filter = require(path.join(root, "filter.js"));
  filter.rankForPlay = function () {
    return {
      mode: "solve",
      rankedGuesses: [],
      candidates: [],
      answerCount: 0,
    };
  };
  filter.filterScoreWords = function () {
    return [];
  };
  filter.filterWords = function () {
    return [];
  };
  filter.positionLeaders = function () {
    return [0, 1, 2, 3, 4].map(function () {
      return { letter: "", count: 0 };
    });
  };
  g.WordleFilter = filter;
  g.WORDS = ["CRANE", "SHOUT", "SLATE"];
  g.COMMON_SET = { CRANE: true, SHOUT: true, SLATE: true };
  g.COMMON_WORDS = g.WORDS;

  delete g.__wordleApp;
  var appPath = path.join(root, "app.js");
  delete require.cache[require.resolve(appPath)];
  require(appPath);
  return {
    app: g.__wordleApp,
    undoBtn: ids["guess-undo"],
    history: ids["history-list"],
  };
}

test("Undo guess sits next to Clear free tiles", function () {
  var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  var start = html.indexOf('class="guess-actions"');
  var end = html.indexOf("</div>", start);
  var actions = html.slice(start, end);
  var clearAt = actions.indexOf('id="guess-clear"');
  var undoAt = actions.indexOf('id="guess-undo"');
  assert.ok(clearAt !== -1, "clear button present");
  assert.ok(undoAt !== -1, "undo button present");
  assert.ok(clearAt < undoAt, "undo button follows clear free tiles");
  assert.ok(actions.indexOf("Undo guess") !== -1);
});

test("undo is disabled until a guess is submitted", function () {
  var ui = bootApp();
  assert.strictEqual(ui.undoBtn.disabled, true);
  assert.strictEqual(ui.app.getHistory().length, 0);
  ui.app.undoGuess();
  assert.strictEqual(ui.app.getHistory().length, 0);
  assert.strictEqual(ui.undoBtn.disabled, true);
});

test("undo restores filters and puts the latest guess back in the row", function () {
  var ui = bootApp();
  ui.app.submitGuess("CRANE", ["green", "gray", "yellow", "gray", "gray"]);
  var after = ui.app.getState();
  assert.strictEqual(after.known[0], "C");
  assert.strictEqual(after.statuses.A, "HAS");
  assert.strictEqual(after.statuses.R, "NO");
  assert.strictEqual(after.statuses.N, "NO");
  assert.strictEqual(after.statuses.E, "NO");
  assert.strictEqual(ui.undoBtn.disabled, false);
  assert.deepStrictEqual(ui.app.getGuessLetters(), ["C", "", "", "", ""]);

  ui.app.undoGuess();
  var restored = ui.app.getState();
  assert.strictEqual(ui.app.getHistory().length, 0);
  assert.deepStrictEqual(restored.known, ["", "", "", "", ""]);
  assert.strictEqual(restored.statuses.C, "YES");
  assert.strictEqual(restored.statuses.A, "YES");
  assert.strictEqual(restored.statuses.R, "YES");
  assert.strictEqual(restored.positionExclusions.length, 0);
  assert.strictEqual(restored.minLetterCounts.A, undefined);
  assert.deepStrictEqual(ui.app.getGuessLetters(), ["C", "R", "A", "N", "E"]);
  assert.strictEqual(ui.undoBtn.disabled, true);
  assert.strictEqual(ui.history.children.length, 0);
});

test("undo removes only the latest guess", function () {
  var ui = bootApp();
  ui.app.submitGuess("CRANE", ["gray", "gray", "gray", "gray", "gray"]);
  ui.app.submitGuess("SHOUT", ["yellow", "gray", "gray", "gray", "gray"]);
  assert.strictEqual(ui.app.getHistory().length, 2);

  ui.app.undoGuess();
  var once = ui.app.getState();
  assert.deepStrictEqual(
    ui.app.getHistory().map(function (h) {
      return h.word;
    }),
    ["CRANE"]
  );
  assert.strictEqual(once.statuses.C, "NO");
  assert.strictEqual(once.statuses.S, "YES");
  assert.strictEqual(once.statuses.H, "YES");
  assert.deepStrictEqual(ui.app.getGuessLetters(), ["S", "H", "O", "U", "T"]);
  assert.strictEqual(ui.undoBtn.disabled, false);

  ui.app.undoGuess();
  var twice = ui.app.getState();
  assert.strictEqual(ui.app.getHistory().length, 0);
  assert.strictEqual(twice.statuses.C, "YES");
  assert.strictEqual(twice.statuses.S, "YES");
  assert.deepStrictEqual(ui.app.getGuessLetters(), ["C", "R", "A", "N", "E"]);
  assert.strictEqual(ui.undoBtn.disabled, true);
});

test("undo keeps a letter status set before the guess", function () {
  var ui = bootApp();
  ui.app.setStatus("Q", "NO");
  ui.app.submitGuess("CRANE", ["gray", "gray", "gray", "gray", "gray"]);
  ui.app.setStatus("Z", "NO");
  ui.app.undoGuess();
  var state = ui.app.getState();
  assert.strictEqual(state.statuses.Q, "NO");
  assert.strictEqual(state.statuses.Z, "YES");
  assert.strictEqual(state.statuses.C, "YES");
});

test("button click uses the same undo path", function () {
  var ui = bootApp();
  ui.app.submitGuess("SLATE", ["gray", "green", "gray", "gray", "gray"]);
  assert.strictEqual(ui.app.getState().known[1], "L");
  assert.ok(ui.undoBtn.listeners.click && ui.undoBtn.listeners.click.length > 0);
  ui.undoBtn.listeners.click[0]();
  assert.strictEqual(ui.app.getHistory().length, 0);
  assert.strictEqual(ui.app.getState().known[1], "");
  assert.deepStrictEqual(ui.app.getGuessLetters(), ["S", "L", "A", "T", "E"]);
});

test("reset clears undo history", function () {
  var ui = bootApp();
  ui.app.submitGuess("CRANE", ["gray", "gray", "gray", "gray", "gray"]);
  ui.app.reset();
  assert.strictEqual(ui.app.getHistory().length, 0);
  assert.strictEqual(ui.undoBtn.disabled, true);
  ui.app.undoGuess();
  assert.strictEqual(ui.app.getState().statuses.C, "YES");
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
