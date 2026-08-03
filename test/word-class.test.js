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

test("common set loaded and non-empty", function () {
  assert.ok(common.COMMON_WORDS.length > 14000);
  assert.ok(COMMON_SET.DEATH);
  assert.ok(COMMON_SET.ABOUT);
  assert.ok(COMMON_SET.NIKAU); // NYT allowed guess → common
  assert.ok(COMMON_SET.AAPAS); // NYT allowed guess → common
  assert.ok(!COMMON_SET.SMURF); // local-only dict word, not NYT
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
  assert.ok(rows.some(function (r) {
    return r.word === "NIKAU";
  }));
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
  assert.ok(rows.length > 500);
  assert.ok(rows.length < WORDS.length);
  rows.forEach(function (r) {
    assert.ok(COMMON_SET[r.word]);
    assert.ok(!filter.isLikelyPlural(r.word));
  });
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
