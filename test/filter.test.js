/**
 * Unit tests against shipped filter.js + words.js (official NYT Wordle dictionary).
 * Run: node test/filter.test.js
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

function allYes() {
  return filter.defaultConstraints();
}

test("dictionary has 14857 five-letter words (prior list + NYT additions)", function () {
  assert.strictEqual(WORDS.length, 14857);
  for (var i = 0; i < WORDS.length; i++) {
    assert.strictEqual(WORDS[i].length, 5);
    assert.match(WORDS[i], /^[A-Z]{5}$/);
  }
});

test("dictionary includes WOMEN, NIKAU, DEATH, ASTRO, SMURF, AAPAS, CIGAR", function () {
  ["WOMEN", "NIKAU", "DEATH", "ASTRO", "SMURF", "AAPAS", "CIGAR"].forEach(function (w) {
    assert.ok(WORDS.indexOf(w) >= 0, w);
  });
});

test("WOMEN → 5 unique letters, 2 unique vowels, 2 vowel occurrences", function () {
  assert.strictEqual(filter.uniqueLetterCount("WOMEN"), 5);
  assert.strictEqual(filter.uniqueVowelCount("WOMEN"), 2);
  assert.strictEqual(filter.vowelOccurrenceCount("WOMEN"), 2);
});

test("QUEUE → 3 unique, 2 unique vowels (U,E), 4 vowel occurrences", function () {
  assert.strictEqual(filter.uniqueLetterCount("QUEUE"), 3);
  assert.strictEqual(filter.uniqueVowelCount("QUEUE"), 2);
  assert.strictEqual(filter.vowelOccurrenceCount("QUEUE"), 4);
});

test("MYTHS → 5 unique, 0 vowels (Y not vowel)", function () {
  assert.strictEqual(filter.uniqueLetterCount("MYTHS"), 5);
  assert.strictEqual(filter.uniqueVowelCount("MYTHS"), 0);
  assert.strictEqual(filter.vowelOccurrenceCount("MYTHS"), 0);
});

test("(a) all-open → full list", function () {
  var results = filter.filterWords(WORDS, allYes());
  assert.strictEqual(results.length, WORDS.length);
});

test("(b) letter E = NO → every remaining word lacks E", function () {
  var c = allYes();
  c.statuses.E = "NO";
  var results = filter.filterWords(WORDS, c);
  assert.ok(results.length > 0 && results.length < WORDS.length);
  results.forEach(function (r) {
    assert.ok(r.word.indexOf("E") === -1, r.word);
  });
});

test("(c) letter Z = HAS → every remaining word contains Z", function () {
  var c = allYes();
  c.statuses.Z = "HAS";
  var results = filter.filterWords(WORDS, c);
  assert.ok(results.length > 0);
  results.forEach(function (r) {
    assert.ok(r.word.indexOf("Z") >= 0, r.word);
  });
});

test("(d) known W____ → every remaining starts with W", function () {
  var c = allYes();
  c.known = ["W", "", "", "", ""];
  var results = filter.filterWords(WORDS, c);
  assert.ok(results.length > 0);
  results.forEach(function (r) {
    assert.strictEqual(r.word.charAt(0), "W");
  });
  assert.ok(results.some(function (r) {
    return r.word === "WOMEN";
  }));
});

test("(e) combined known + HAS + NO", function () {
  var c = allYes();
  c.known = ["W", "", "", "", ""];
  c.statuses.O = "HAS";
  c.statuses.E = "NO";
  var results = filter.filterWords(WORDS, c);
  assert.ok(results.length > 0);
  results.forEach(function (r) {
    assert.strictEqual(r.word.charAt(0), "W");
    assert.ok(r.word.indexOf("O") >= 0);
    assert.ok(r.word.indexOf("E") === -1);
  });
  assert.ok(
    !results.some(function (r) {
      return r.word === "WOMEN";
    })
  );
});

test("position exclusion: HAS E but not at index 1", function () {
  var c = allYes();
  c.statuses.E = "HAS";
  c.positionExclusions = [{ letter: "E", position: 1 }];
  var results = filter.filterWords(WORDS, c);
  assert.ok(results.length > 0);
  results.forEach(function (r) {
    assert.ok(r.word.indexOf("E") >= 0, r.word);
    assert.notStrictEqual(r.word.charAt(1), "E", r.word);
  });
});

test("min unique letters filters", function () {
  var c = allYes();
  c.minUniqueLetters = 5;
  var results = filter.filterWords(WORDS, c);
  assert.ok(results.length > 0);
  results.forEach(function (r) {
    assert.ok(r.unique >= 5, r.word + " unique=" + r.unique);
  });
  // QUEUE has 3 unique → excluded
  assert.ok(
    !results.some(function (r) {
      return r.word === "QUEUE";
    })
  );
});

test("min unique vowels filters", function () {
  var c = allYes();
  c.minUniqueVowels = 4;
  var results = filter.filterWords(WORDS, c);
  results.forEach(function (r) {
    assert.ok(r.uniqueVowels >= 4, r.word);
  });
});

test("scoreAndSort ranks by expected remaining (lower better)", function () {
  var c = allYes();
  c.statuses.Z = "HAS";
  var scored = filter.filterScoreWords(WORDS, c);
  assert.ok(scored.length > 1);
  assert.ok(typeof scored[0].score === "number");
  assert.ok(scored[0].expectedRemaining != null);
  assert.ok(scored[0].entropy != null);
  for (var i = 1; i < scored.length; i++) {
    assert.ok(
      scored[i - 1].score <= scored[i].score + 1e-9,
      scored[i - 1].word +
        " score " +
        scored[i - 1].score +
        " then " +
        scored[i].word +
        " " +
        scored[i].score
    );
  }
});

test("feedbackId: all green and gray", function () {
  assert.strictEqual(filter.feedbackId("DEATH", "DEATH"), 2 + 6 + 18 + 54 + 162); // all green = 2*(1+3+9+27+81)=242
  assert.strictEqual(filter.feedbackId("ABCDE", "FGHIJ"), 0);
});

test("feedbackId: yellow not green", function () {
  // A in answer but wrong position
  var id = filter.feedbackId("AXXXX", "YYYAY");
  // pos0 yellow=1, rest gray
  assert.strictEqual(id, 1);
});

test("expectedRemaining: guessing the only answer leaves 1", function () {
  var answers = ["DEATH"];
  assert.strictEqual(filter.expectedRemaining("DEATH", answers), 1);
});

test("expectedRemaining: better splitter has lower E[left]", function () {
  // Small set where one guess distinguishes more
  var answers = ["AAAAA", "BBBBB", "CCCCC", "DDDDD", "EEEEE"];
  // Guessing a member: one green-all bucket size 1, four all-gray size 1 each? 
  // Actually AAAAA vs BBBBB is all gray; AAAAA vs AAAAA all green.
  // So buckets: 1 of size 1 (match), 4 of size 1 (all gray same pattern for all non-matches)
  // Wait all non-matches give same all-gray pattern → bucket sizes 1 and 4
  // E = (1+16)/5 = 3.4
  var eMember = filter.expectedRemaining("AAAAA", answers);
  assert.ok(Math.abs(eMember - 3.4) < 1e-9, "got " + eMember);
});

test("Java-style lists contains/excludes without statuses", function () {
  var c = allYes();
  c.statuses = null;
  c.strictAvailable = false;
  c.contains = ["D", "E", "A", "T", "H"];
  c.excludes = ["Q", "Z"];
  c.known = ["D", "", "", "", "H"];
  var results = filter.filterWords(WORDS, c);
  assert.ok(results.some(function (r) {
    return r.word === "DEATH";
  }));
  results.forEach(function (r) {
    assert.strictEqual(r.word.charAt(0), "D");
    assert.strictEqual(r.word.charAt(4), "H");
  });
});

test("D___H + HAS E,A,T + NO Q,Z → DEATH via filterScoreWords", function () {
  var c = allYes();
  c.known = ["D", "", "", "", "H"];
  c.statuses.E = "HAS";
  c.statuses.A = "HAS";
  c.statuses.T = "HAS";
  c.statuses.Q = "NO";
  c.statuses.Z = "NO";
  var results = filter.filterScoreWords(WORDS, c);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].word, "DEATH");
  assert.strictEqual(results[0].unique, 5);
  assert.strictEqual(results[0].uniqueVowels, 2);
});

test("defaultConstraints all YES empty known", function () {
  var c = filter.defaultConstraints();
  filter.LETTERS.forEach(function (L) {
    assert.strictEqual(c.statuses[L], "YES");
  });
  assert.deepStrictEqual(c.known, ["", "", "", "", ""]);
  assert.strictEqual(c.frequencyWeight, 0.65);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
