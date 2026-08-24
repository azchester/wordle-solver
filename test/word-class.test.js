/**
 * Common-word + plural classification tests (shipped filter.js + common-words.js).
 * Run: node test/word-class.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");

var root = path.join(__dirname, "..");
var WORDS = require(path.join(root, "words.js"));
var common = require(path.join(root, "common-words.js"));
var filter = require(path.join(root, "filter.js"));

var COMMON_SET = common.COMMON_SET;
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

test("common set is official NYT answer list", function () {
  assert.strictEqual(common.COMMON_WORDS.length, 2437);
  assert.ok(COMMON_SET.DEATH);
  assert.ok(COMMON_SET.ABOUT);
  assert.ok(COMMON_SET.ABACK);
  assert.ok(COMMON_SET.GEODE); // NYT #1882, 2026-08-14
  assert.ok(COMMON_SET.ASPIC); // NYT #1884, 2026-08-16
  assert.ok(COMMON_SET.RUNNY); // NYT #1892, 2026-08-24
  assert.ok(COMMON_SET.BLING);
  assert.ok(COMMON_SET.LATKE);
  assert.ok(!COMMON_SET.NIKAU); // NYT allowed guess, not an answer
  assert.ok(!COMMON_SET.AAPAS); // NYT allowed guess, not an answer
  assert.ok(!COMMON_SET.SMURF); // local-only dict word, not NYT
});

test("NYT-added answers that were only on the allowed-guess list are categorized as answers", function () {
  var added = [
    "ALOHA", "ASPIC", "ATLAS", "ATRIA", "BALSA", "BEAUT", "CAROM", "CLUNK", "COLIC",
    "CUBIT", "DIVOT", "EMOJI", "GEODE", "GIZMO", "GOFER", "GRIFT", "GUANO",
    "GUNKY", "HYDRA", "INDIE", "KAZOO", "KEFIR", "KNELL", "LASER", "LORIS",
    "MATTE", "MAVEN", "MOMMY", "MOOCH", "MUGGY", "NERVY", "OASIS", "OOMPH",
    "PIOUS", "PRIMP", "PSHAW", "SHILL", "SHRED", "SITAR", "SNAFU", "SPATE",
    "SQUID", "SUEDE", "TAUPE", "TINGE", "TIZZY", "TOADY", "UVULA",
    "BLING", "LATKE", "ADIEU", "UMAMI", "MOCHI", "HAIKU", "OKAPI", "RUNNY"
  ];
  added.forEach(function (w) {
    assert.ok(COMMON_SET[w], w + " has been an official NYT answer");
  });
});

test("NYT-retired original answers are not in the answer set", function () {
  ["AGORA", "FIBRE", "LYNCH", "PUPAL", "SLAVE", "WENCH"].forEach(function (w) {
    assert.ok(!COMMON_SET[w], w + " was removed from the NYT answer list");
    assert.ok(WORDS.indexOf(w) >= 0, w + " remains an allowed guess");
  });
});

test("isLikelyPlural: TOOLS yes, GLASS no, FOCUS no, DEATH no", function () {
  assert.strictEqual(filter.isLikelyPlural("TOOLS"), true);
  assert.strictEqual(filter.isLikelyPlural("BEARS"), true);
  assert.strictEqual(filter.isLikelyPlural("GLASS"), false);
  assert.strictEqual(filter.isLikelyPlural("FOCUS"), false);
  assert.strictEqual(filter.isLikelyPlural("BASIS"), false);
  assert.strictEqual(filter.isLikelyPlural("DEATH"), false);
});

test("commonOnly filters to common set", function () {
  var c = filter.defaultConstraints();
  c.commonOnly = true;
  var rows = filter.filterWords(WORDS, c, COMMON_SET);
  assert.ok(rows.length > 0);
  assert.ok(rows.length < WORDS.length);
  rows.forEach(function (r) {
    assert.ok(COMMON_SET[r.word], r.word);
  });
  assert.ok(rows.some(function (r) {
    return r.word === "DEATH";
  }));
  assert.ok(
    !rows.some(function (r) {
      return r.word === "NIKAU"; // allowed guess only
    })
  );
  assert.ok(
    !rows.some(function (r) {
      return r.word === "SMURF";
    })
  );
});

test("excludePlurals removes -s forms from main", function () {
  var c = filter.defaultConstraints();
  c.excludePlurals = true;
  var rows = filter.filterWords(WORDS, c, COMMON_SET);
  rows.forEach(function (r) {
    assert.ok(!filter.isLikelyPlural(r.word), r.word);
  });
});

test("requirePlural keeps only plurals", function () {
  var c = filter.defaultConstraints();
  c.requirePlural = true;
  c.commonOnly = true;
  var rows = filter.filterWords(WORDS, c, COMMON_SET);
  assert.ok(rows.length > 0);
  rows.forEach(function (r) {
    assert.ok(filter.isLikelyPlural(r.word), r.word);
    assert.ok(COMMON_SET[r.word], r.word);
  });
});

test("common + exclude plurals default UI combo", function () {
  var c = filter.defaultConstraints();
  c.commonOnly = true;
  c.excludePlurals = true;
  var rows = filter.filterWords(WORDS, c, COMMON_SET);
  assert.ok(rows.length > 2000);
  assert.ok(rows.length <= 2437);
  assert.ok(rows.length < WORDS.length);
  rows.forEach(function (r) {
    assert.ok(COMMON_SET[r.word]);
    assert.ok(!filter.isLikelyPlural(r.word));
  });
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
