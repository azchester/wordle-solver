/**
 * Hybrid opener (greenfield probe) vs solve-mode ranking.
 * Run: node test/opener.test.js
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

function answerConstraints() {
  var c = filter.defaultConstraints();
  c.commonOnly = true;
  c.excludePlurals = true;
  return c;
}

test("isGreenfield: default open board", function () {
  assert.strictEqual(filter.isGreenfield(filter.defaultConstraints()), true);
  assert.strictEqual(filter.isGreenfield(answerConstraints()), true);
});

test("isGreenfield: false after letter/position constraints", function () {
  var c = answerConstraints();
  c.known[0] = "C";
  assert.strictEqual(filter.isGreenfield(c), false);

  c = answerConstraints();
  c.statuses.E = "HAS";
  c.contains = ["E"];
  assert.strictEqual(filter.isGreenfield(c), false);

  c = answerConstraints();
  c.statuses.Q = "NO";
  c.excludes = ["Q"];
  assert.strictEqual(filter.isGreenfield(c), false);

  c = answerConstraints();
  c.positionExclusions = [{ letter: "A", position: 0 }];
  assert.strictEqual(filter.isGreenfield(c), false);
});

test("rankForPlay greenfield: opener mode ranks full-dict probes", function () {
  var c = answerConstraints();
  var ranked = filter.rankForPlay(WORDS, c, COMMON_SET, { hasHistory: false });
  assert.strictEqual(ranked.mode, "opener");
  assert.ok(ranked.answerCount > 2000);
  assert.ok(ranked.answerCount <= 2436);
  assert.ok(ranked.rankedGuesses.length > ranked.answerCount);
  assert.ok(ranked.rankedGuesses[0].expectedRemaining < 100);
  // Best one-ply openers on this list include ROATE (guess-only)
  var top = ranked.rankedGuesses.slice(0, 20).map(function (r) {
    return r.word;
  });
  assert.ok(
    top.indexOf("ROATE") >= 0 || ranked.rankedGuesses[0].word === "ROATE",
    "expected ROATE among top openers, got " + top.slice(0, 5).join(",")
  );
  assert.strictEqual(COMMON_SET.ROATE, undefined);
  assert.ok(ranked.rankedGuesses.some(function (r) {
    return r.word === "ROATE" && r.common === false;
  }));
});

test("rankForPlay with history: solve mode (answers only)", function () {
  var c = answerConstraints();
  var ranked = filter.rankForPlay(WORDS, c, COMMON_SET, { hasHistory: true });
  assert.strictEqual(ranked.mode, "solve");
  ranked.rankedGuesses.forEach(function (r) {
    assert.ok(COMMON_SET[r.word], r.word + " should be an answer");
  });
  assert.ok(!ranked.rankedGuesses.some(function (r) {
    return r.word === "ROATE";
  }));
});

test("rankForPlay after applyGuess: solve mode", function () {
  var c = answerConstraints();
  var applied = filter.applyGuess(c, "ROATE", [
    "gray",
    "yellow",
    "gray",
    "yellow",
    "gray",
  ]);
  c = applied.constraints;
  assert.strictEqual(filter.isGreenfield(c), false);
  var ranked = filter.rankForPlay(WORDS, c, COMMON_SET, { hasHistory: true });
  assert.strictEqual(ranked.mode, "solve");
  assert.ok(ranked.answerCount < 2436);
  ranked.rankedGuesses.forEach(function (r) {
    assert.ok(COMMON_SET[r.word], r.word);
  });
});

test("scoreGuessPool: lower E[left] sorts first", function () {
  var answers = ["AAAAA", "BBBBB", "CCCCC", "DDDDD", "EEEEE"];
  var scored = filter.scoreGuessPool(
    ["AAAAA", "FGHIJ"],
    answers,
    { maxGuessEval: 10 }
  );
  assert.ok(scored[0].expectedRemaining <= scored[scored.length - 1].expectedRemaining);
  // Perfect hit on one answer leaves smaller expected remaining than a total miss... 
  // actually total miss puts all in one bucket of 5; perfect hit buckets 1+4.
  // E = sum c^2 / n: miss = 25/5=5, hit = (1+16)/5=3.4
  var byWord = Object.create(null);
  scored.forEach(function (r) {
    byWord[r.word] = r.expectedRemaining;
  });
  assert.ok(byWord.AAAAA < byWord.FGHIJ);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
