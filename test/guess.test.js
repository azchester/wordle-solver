/**
 * Unit tests for shipped applyGuess (filter.js) — not a re-implementation.
 * Run: node test/guess.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");

var root = path.join(__dirname, "..");
var WORDS = require(path.join(root, "words.js"));
var filter = require(path.join(root, "filter.js"));

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

function open() {
  return filter.defaultConstraints();
}

// (a) all-green
test("(a) all-green DEATH → known slots + each letter HAS", function () {
  var r = filter.applyGuess(open(), "DEATH", [
    "green",
    "green",
    "green",
    "green",
    "green",
  ]);
  assert.deepStrictEqual(r.constraints.known, ["D", "E", "A", "T", "H"]);
  "DEATH".split("").forEach(function (ch) {
    assert.strictEqual(r.constraints.statuses[ch], "HAS", ch);
  });
  assert.strictEqual(r.historyEntry.word, "DEATH");
  assert.deepStrictEqual(r.historyEntry.tiles, [
    "green",
    "green",
    "green",
    "green",
    "green",
  ]);
  var remaining = filter.filterWords(WORDS, r.constraints);
  assert.ok(remaining.some(function (x) {
    return x.word === "DEATH";
  }));
  assert.ok(remaining.every(function (x) {
    return x.word === "DEATH";
  }));
});

// (b) one yellow
test("(b) yellow E at index 1 → HAS + pos exclude, known[1] empty", function () {
  var r = filter.applyGuess(open(), "BEAST", [
    "gray",
    "yellow",
    "gray",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r.constraints.statuses.E, "HAS");
  assert.strictEqual(r.constraints.known[1], "");
  assert.ok(
    r.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "E" && pe.position === 1;
    })
  );
  var remaining = filter.filterWords(WORDS, r.constraints);
  remaining.forEach(function (row) {
    assert.ok(row.word.indexOf("E") >= 0, row.word);
    assert.notStrictEqual(row.word.charAt(1), "E", row.word);
  });
});

// (c) gray excludes
test("(c) gray Q only → Q is NO; no remaining word contains Q", function () {
  var r = filter.applyGuess(open(), "QUACK", [
    "gray",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r.constraints.statuses.Q, "NO");
  assert.strictEqual(r.constraints.statuses.U, "NO");
  var remaining = filter.filterWords(WORDS, r.constraints);
  assert.ok(remaining.length > 0);
  remaining.forEach(function (row) {
    assert.ok(row.word.indexOf("Q") === -1, row.word);
    assert.ok(row.word.indexOf("U") === -1, row.word);
  });
});

// (d) mixed green+yellow+gray
test("(d) mixed green+yellow+gray coherent for filterWords", function () {
  // C R A N E: C gray, R yellow, A green, N gray, E yellow
  var r = filter.applyGuess(open(), "CRANE", [
    "gray",
    "yellow",
    "green",
    "gray",
    "yellow",
  ]);
  assert.strictEqual(r.constraints.known[2], "A");
  assert.strictEqual(r.constraints.statuses.A, "HAS");
  assert.strictEqual(r.constraints.statuses.R, "HAS");
  assert.strictEqual(r.constraints.statuses.E, "HAS");
  assert.strictEqual(r.constraints.statuses.C, "NO");
  assert.strictEqual(r.constraints.statuses.N, "NO");
  assert.ok(
    r.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "R" && pe.position === 1;
    })
  );
  assert.ok(
    r.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "E" && pe.position === 4;
    })
  );
  var remaining = filter.filterWords(WORDS, r.constraints);
  remaining.forEach(function (row) {
    var w = row.word;
    assert.strictEqual(w.charAt(2), "A");
    assert.ok(w.indexOf("R") >= 0);
    assert.ok(w.indexOf("E") >= 0);
    assert.ok(w.indexOf("C") === -1);
    assert.ok(w.indexOf("N") === -1);
    assert.notStrictEqual(w.charAt(1), "R");
    assert.notStrictEqual(w.charAt(4), "E");
  });
});

// (e) sequential accumulates
test("(e) two sequential applies accumulate; second does not wipe first greens", function () {
  var r1 = filter.applyGuess(open(), "SLATE", [
    "gray",
    "gray",
    "green",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r1.constraints.known[2], "A");
  assert.strictEqual(r1.constraints.statuses.A, "HAS");

  var r2 = filter.applyGuess(r1.constraints, "CRANE", [
    "gray",
    "yellow",
    "green",
    "gray",
    "yellow",
  ]);
  // first green preserved
  assert.strictEqual(r2.constraints.known[2], "A");
  assert.strictEqual(r2.constraints.statuses.A, "HAS");
  // second guess adds
  assert.strictEqual(r2.constraints.statuses.R, "HAS");
  assert.strictEqual(r2.constraints.statuses.E, "HAS");
  assert.strictEqual(r2.constraints.statuses.C, "NO");
});

test("gray does not demote prior HAS/green", function () {
  var r1 = filter.applyGuess(open(), "AUDIO", [
    "green",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r1.constraints.known[0], "A");
  assert.strictEqual(r1.constraints.statuses.A, "HAS");
  // later guess with gray A elsewhere must not exclude A
  var r2 = filter.applyGuess(r1.constraints, "BRAIN", [
    "gray",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  // A was not in BRAIN — but if we gray a word that has A:
  var r3 = filter.applyGuess(r1.constraints, "ABBEY", [
    "gray",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  // A is gray on this guess but already HAS from prior green → stay HAS
  assert.strictEqual(r3.constraints.statuses.A, "HAS");
  assert.strictEqual(r3.constraints.known[0], "A");
});

test("same-guess green+gray duplicate letter: gray does not fully exclude", function () {
  // Word with double letter: first green, second gray → still HAS
  var r = filter.applyGuess(open(), "LLAMA", [
    "green",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r.constraints.known[0], "L");
  assert.strictEqual(r.constraints.statuses.L, "HAS");
  // second L is gray but L required on guess via green → not NO
  assert.notStrictEqual(r.constraints.statuses.L, "NO");
  // gray L at index 1 must still add a position exclusion
  assert.ok(
    r.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "L" && pe.position === 1;
    }),
    "expected position exclusion L@1"
  );
});

test("duplicate green+gray R (CURRY): pos exclude gray R, keep HAS", function () {
  // Real game (answer SHRUG): IRATE → R yellow; CURRY → U yellow, R green, R gray
  // SHRUG has one R at index 2; second R in CURRY is correctly gray (excess).
  var c = open();
  var r1 = filter.applyGuess(c, "IRATE", [
    "gray",
    "yellow",
    "gray",
    "gray",
    "gray",
  ]);
  var r2 = filter.applyGuess(r1.constraints, "CURRY", [
    "gray",
    "yellow",
    "green",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r2.constraints.known[2], "R");
  assert.strictEqual(r2.constraints.statuses.R, "HAS");
  assert.strictEqual(r2.constraints.statuses.U, "HAS");
  // Yellow R from IRATE → R not at index 1
  assert.ok(
    r2.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "R" && pe.position === 1;
    }),
    "expected R@1 exclusion from IRATE yellow"
  );
  // Gray second R in CURRY → R not at index 3 (bug: was missing)
  assert.ok(
    r2.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "R" && pe.position === 3;
    }),
    "expected R@3 exclusion from gray duplicate R"
  );
  // Yellow U → U not at index 1
  assert.ok(
    r2.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "U" && pe.position === 1;
    }),
    "expected U@1 exclusion"
  );
  // Answer still matches; no remaining word may place R at the gray slot
  var remaining = filter.filterWords(WORDS, r2.constraints).map(function (row) {
    return row.word;
  });
  assert.ok(remaining.indexOf("SHRUG") !== -1, "SHRUG must remain a candidate");
  remaining.forEach(function (w) {
    assert.notStrictEqual(w.charAt(3), "R", "no candidate with R@3: " + w);
    assert.strictEqual(w.charAt(2), "R", "known green R@2: " + w);
    assert.ok(w.indexOf("U") !== -1, "must contain U: " + w);
  });
});

test("same-guess yellow+gray duplicate: both positions excluded, still HAS", function () {
  // Two L's: one yellow, one gray → L must appear, not at either of those slots
  var r = filter.applyGuess(open(), "LLAMA", [
    "yellow",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r.constraints.statuses.L, "HAS");
  assert.ok(
    r.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "L" && pe.position === 0;
    }),
    "yellow L@0"
  );
  assert.ok(
    r.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "L" && pe.position === 1;
    }),
    "gray L@1"
  );
});

test("prior HAS + later gray at a slot: position exclusion, not demote", function () {
  var r1 = filter.applyGuess(open(), "RAISE", [
    "yellow",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  assert.strictEqual(r1.constraints.statuses.R, "HAS");
  // Probe with extra R that is gray (only one R in answer already accounted as HAS)
  var r2 = filter.applyGuess(r1.constraints, "BERRY", [
    "gray",
    "gray",
    "gray",
    "gray",
    "gray",
  ]);
  // Wait — if all gray including R, and R was HAS, should keep HAS + pos-exclude R slots
  assert.strictEqual(r2.constraints.statuses.R, "HAS");
  assert.ok(
    r2.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "R" && pe.position === 2;
    }),
    "gray R@2 from BERRY"
  );
  assert.ok(
    r2.constraints.positionExclusions.some(function (pe) {
      return pe.letter === "R" && pe.position === 3;
    }),
    "gray R@3 from BERRY"
  );
});

test("historyEntry tiles normalized from aliases", function () {
  var r = filter.applyGuess(open(), "APPLE", [
    "correct",
    "present",
    "absent",
    "y",
    "g",
  ]);
  assert.deepStrictEqual(r.historyEntry.tiles, [
    "green",
    "yellow",
    "gray",
    "yellow",
    "green",
  ]);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
