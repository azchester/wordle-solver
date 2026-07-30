/**
 * Unit tests for guess tile fill/prefill helpers (shipped filter.js).
 * Run: node test/guess-ui.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");

var root = path.join(__dirname, "..");
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

// (a) known D,,,,H
test("(a) known D,,, ,H → tiles 0 and 4 are D and H", function () {
  var known = ["D", "", "", "", "H"];
  var tiles = filter.prefillGuessFromKnown(["", "", "", "", ""], known);
  assert.deepStrictEqual(tiles, ["D", "", "", "", "H"]);
  assert.strictEqual(tiles[0], "D");
  assert.strictEqual(tiles[4], "H");
  assert.strictEqual(tiles[1], "");
  assert.strictEqual(tiles[2], "");
  assert.strictEqual(tiles[3], "");
});

// (b) all-empty known
test("(b) all-empty known → no forced letters; keeps free typed letters", function () {
  var known = ["", "", "", "", ""];
  var empty = filter.prefillGuessFromKnown(["", "", "", "", ""], known);
  assert.deepStrictEqual(empty, ["", "", "", "", ""]);
  var kept = filter.prefillGuessFromKnown(["C", "R", "A", "N", "E"], known);
  assert.deepStrictEqual(kept, ["C", "R", "A", "N", "E"]);
});

// (c) fill from optimal word
test("(c) lettersFromWord / fillGuessFromOptimal yield five tiles", function () {
  var fromWord = filter.lettersFromWord("DEATH");
  assert.deepStrictEqual(fromWord, ["D", "E", "A", "T", "H"]);
  var filled = filter.fillGuessFromOptimal("CRANE", ["", "", "", "", ""]);
  assert.deepStrictEqual(filled, ["C", "R", "A", "N", "E"]);
  assert.strictEqual(filled.join(""), "CRANE");
});

test("known wins over optimal at confirmed positions", function () {
  // Optimal might differ but known greens override
  var tiles = filter.fillGuessFromOptimal("CRANE", ["D", "", "", "", "H"]);
  assert.strictEqual(tiles[0], "D");
  assert.strictEqual(tiles[4], "H");
  assert.strictEqual(tiles[1], "R");
  assert.strictEqual(tiles[2], "A");
  assert.strictEqual(tiles[3], "N");
});

test("prefill overwrites free slot when known gains a letter", function () {
  var before = filter.prefillGuessFromKnown(["X", "Y", "Z", "Q", "W"], [
    "",
    "",
    "",
    "",
    "",
  ]);
  assert.deepStrictEqual(before, ["X", "Y", "Z", "Q", "W"]);
  var after = filter.prefillGuessFromKnown(before, ["D", "", "", "", ""]);
  assert.strictEqual(after[0], "D");
  assert.strictEqual(after[1], "Y");
});

test("lettersFromKnown normalizes case and junk", function () {
  assert.deepStrictEqual(filter.lettersFromKnown(["d", "1", "a!", "", null]), [
    "D",
    "",
    "A",
    "",
    "",
  ]);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
