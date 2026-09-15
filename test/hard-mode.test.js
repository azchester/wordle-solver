/**
 * Hard mode (remaining answers only) vs info-probe ranking.
 * Run: node test/hard-mode.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");
var fs = require("fs");

var root = path.join(__dirname, "..");
var filter = require(path.join(root, "filter.js"));
var appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");

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

var POOL = ["CRANE", "ATONE", "ALONE", "DUMPY", "CRONY", "LOUTS", "PLANE"];

function afterCrane() {
  var c = filter.defaultConstraints();
  c.commonOnly = false;
  c.excludePlurals = false;
  return filter.applyGuess(c, "CRANE", [
    "gray",
    "gray",
    "yellow",
    "green",
    "green",
  ]).constraints;
}

test("constraintsForProbePool keeps NO, drops HAS / known / posex", function () {
  var c = afterCrane();
  assert.strictEqual(c.statuses.C, "NO");
  assert.strictEqual(c.statuses.A, "HAS");
  assert.strictEqual(c.known[3], "N");
  assert.ok(
    c.positionExclusions.some(function (pe) {
      return pe.letter === "A" && pe.position === 2;
    })
  );

  var probe = filter.constraintsForProbePool(c);
  assert.strictEqual(probe.statuses.C, "NO");
  assert.strictEqual(probe.statuses.R, "NO");
  assert.strictEqual(probe.statuses.A, "YES");
  assert.strictEqual(probe.statuses.N, "YES");
  assert.strictEqual(probe.statuses.E, "YES");
  assert.deepStrictEqual(probe.known, ["", "", "", "", ""]);
  assert.deepStrictEqual(probe.positionExclusions, []);
  assert.ok(probe.excludes.indexOf("C") >= 0);
  assert.strictEqual(probe.contains.length, 0);
  assert.strictEqual(probe.commonOnly, false);
});

test("probe pool includes DUMPY/LOUTS/PLANE, excludes CRONY (NO letters)", function () {
  var probeC = filter.constraintsForProbePool(afterCrane());
  var rows = filter.filterWords(POOL, probeC, null);
  var words = rows.map(function (r) {
    return r.word;
  });
  ["DUMPY", "LOUTS", "PLANE", "ATONE", "ALONE"].forEach(function (w) {
    assert.ok(words.indexOf(w) >= 0, "expected probe " + w + " in " + words);
  });
  assert.ok(words.indexOf("CRONY") < 0);
  assert.ok(words.indexOf("CRANE") < 0);
});

test("rankForPlay default / hardMode true is solve (remaining answers only)", function () {
  var c = afterCrane();
  var ranked = filter.rankForPlay(POOL, c, null, { hasHistory: true });
  assert.strictEqual(ranked.mode, "solve");
  var words = ranked.rankedGuesses.map(function (r) {
    return r.word;
  });
  words.forEach(function (w) {
    assert.ok(filter.isViable(w, c), w + " must be a remaining answer");
  });
  assert.ok(words.indexOf("ATONE") >= 0);
  assert.ok(words.indexOf("ALONE") >= 0);
  assert.ok(words.indexOf("DUMPY") < 0);
  assert.ok(words.indexOf("PLANE") < 0);

  var explicit = filter.rankForPlay(POOL, c, null, {
    hasHistory: true,
    hardMode: true,
  });
  assert.strictEqual(explicit.mode, "solve");
});

test("rankForPlay hardMode false is probe: splits remaining answers", function () {
  var c = afterCrane();
  var ranked = filter.rankForPlay(POOL, c, null, {
    hasHistory: true,
    hardMode: false,
  });
  assert.strictEqual(ranked.mode, "probe");
  assert.strictEqual(ranked.answerCount, 2);
  assert.deepStrictEqual(
    ranked.candidates.map(function (r) {
      return r.word;
    }).sort(),
    ["ALONE", "ATONE"]
  );

  var byWord = Object.create(null);
  ranked.rankedGuesses.forEach(function (r) {
    byWord[r.word] = r;
  });
  assert.ok(byWord.DUMPY, "DUMPY is a valid probe");
  assert.ok(byWord.LOUTS, "LOUTS is a valid probe");
  assert.ok(byWord.PLANE, "PLANE allowed as easy-mode probe (yellow A reused)");
  assert.ok(!byWord.CRONY, "CRONY uses excluded C/R");
  assert.ok(!byWord.CRANE, "CRANE uses excluded C/R");

  // LOUTS distinguishes ATONE vs ALONE; DUMPY does not
  assert.ok(
    byWord.LOUTS.expectedRemaining < byWord.DUMPY.expectedRemaining,
    "LOUTS should split remaining answers better than DUMPY"
  );
  assert.ok(ranked.rankedGuesses[0].expectedRemaining <= 1);
  // Equal E[left] prefers a remaining answer over a same-score probe
  assert.ok(
    ranked.rankedGuesses[0].word === "ALONE" ||
      ranked.rankedGuesses[0].word === "ATONE",
    "tie-break remaining answers, got " + ranked.rankedGuesses[0].word
  );
});

test("hardMode off ranks a strictly better probe above remaining answers", function () {
  var c = filter.defaultConstraints();
  c.commonOnly = false;
  c.excludePlurals = false;
  c.known = ["S", "", "A", "K", "E"];
  c.statuses.S = "HAS";
  c.statuses.A = "HAS";
  c.statuses.K = "HAS";
  c.statuses.E = "HAS";
  c.contains = ["S", "A", "K", "E"];
  var pool = ["SNAKE", "SLAKE", "STAKE", "SHAKE", "PRINT", "DUMPY"];
  var hard = filter.rankForPlay(pool, c, null, {
    hasHistory: true,
    hardMode: true,
  });
  var easy = filter.rankForPlay(pool, c, null, {
    hasHistory: true,
    hardMode: false,
  });
  assert.strictEqual(hard.mode, "solve");
  assert.strictEqual(easy.mode, "probe");
  hard.rankedGuesses.forEach(function (r) {
    assert.ok("SHAKE SLAKE SNAKE STAKE".indexOf(r.word) >= 0, r.word);
  });
  var byWord = Object.create(null);
  easy.rankedGuesses.forEach(function (r) {
    byWord[r.word] = r;
  });
  assert.ok(byWord.PRINT.expectedRemaining < byWord.SNAKE.expectedRemaining);
  assert.strictEqual(easy.rankedGuesses[0].word, "PRINT");
});

test("single remaining answer stays solve even with hardMode false", function () {
  var c = afterCrane();
  var ranked = filter.rankForPlay(["ATONE"], c, null, {
    hasHistory: true,
    hardMode: false,
  });
  assert.strictEqual(ranked.mode, "solve");
  assert.strictEqual(ranked.rankedGuesses[0].word, "ATONE");
});

test("scoreGuessPool alwaysEval scores low-unique remaining answers", function () {
  var answers = ["LLAMA", "ABODE"];
  var pool = ["ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY", "LLAMA"];
  var scored = filter.scoreGuessPool(pool, answers, {
    maxGuessEval: 2,
    alwaysEval: ["LLAMA"],
  });
  var llama = scored.filter(function (r) {
    return r.word === "LLAMA";
  })[0];
  assert.ok(llama, "LLAMA stays in the pool");
  // Unscored rows get entropy 0 and expectedRemaining = |S|.
  // alwaysEval must actually partition, so entropy > 0 or E[left] < 2.
  assert.ok(
    llama.entropy > 0 || llama.expectedRemaining < answers.length,
    "LLAMA should be fully scored"
  );
});

test("fillGuessFromOptimal lockKnown false keeps probe letters", function () {
  var known = ["N", "", "", "", "E"];
  var locked = filter.fillGuessFromOptimal("DUMPY", known);
  assert.strictEqual(locked[0], "N");
  assert.strictEqual(locked[4], "E");
  var unlocked = filter.fillGuessFromOptimal("DUMPY", known, false);
  assert.deepStrictEqual(unlocked, ["D", "U", "M", "P", "Y"]);
});

test("UI: hard mode checkbox default on; app.js ranks with hardMode", function () {
  assert.ok(html.indexOf('id="toggle-hard-mode"') !== -1);
  assert.ok(/id="toggle-hard-mode"[^>]*checked/.test(html));
  assert.ok(appSrc.indexOf("toggle-hard-mode") !== -1);
  assert.ok(appSrc.indexOf("function isHardMode") !== -1);
  assert.ok(appSrc.indexOf("function isSlotLocked") !== -1);
  assert.ok(appSrc.indexOf("hardMode: isHardMode()") !== -1);
  assert.ok(appSrc.indexOf("fillGuessFromOptimal(word, state.known, lockKnown)") !== -1);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
